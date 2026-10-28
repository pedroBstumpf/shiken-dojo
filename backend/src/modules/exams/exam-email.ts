import multipart from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { z } from 'zod';
import { withTransaction } from '../../infra/db/pool.js';
import { escapeHtml, type MailMessage } from '../../infra/mail/mailer.js';
import { countRecentEmails, enqueueEmail } from '../../infra/mail/outbox.repository.js';
import { tooManyRequests, validationFailed } from '../../shared/http/app-error.js';
import { idParamsSchema } from '../../shared/validation/common.js';
import { recordAudit } from '../audit/audit.repository.js';
import { authOf, requestMeta } from '../auth/auth.guard.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import { findTeacher } from '../teachers/teachers.repository.js';
import { findExam } from './exams.repository.js';
import { EXAM_NOT_FOUND } from './exams.service.js';

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
/** Envios de PDF por hora, por professor que envia e por professor que recebe. */
export const EMAILS_PER_HOUR = 10;
const EMAIL_KIND = 'exam.pdf';

const VARIANT_LABELS = {
  filled: 'com as notas lançadas',
  blank: 'em branco, para preencher à mão',
} as const;
type Variant = keyof typeof VARIANT_LABELS;

export const emailDeliverySchema = z.object({
  recipientEmail: z.string(),
  sentAt: z.iso.datetime(),
  simulated: z.boolean(),
});
type EmailDeliveryDto = z.infer<typeof emailDeliverySchema>;

const fieldsSchema = z.object({
  teacherId: z.uuid({ error: 'Escolha um professor ativo.' }),
  variant: z.enum(['filled', 'blank'], { error: 'Versão inválida.' }),
});

interface PdfUpload {
  readonly teacherId: string;
  readonly variant: Variant;
  readonly pdf: Buffer;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function buildExamEmail(params: {
  readonly to: string;
  readonly recipientName: string;
  readonly templateName: string;
  readonly date: string;
  readonly variant: Variant;
  readonly pdf: Buffer;
}): MailMessage {
  const date = formatDate(params.date);
  const summary = `a prova "${params.templateName}" de ${date}, ${VARIANT_LABELS[params.variant]}`;
  return {
    to: params.to,
    subject: `Prova de faixa — ${params.templateName} (${date})`,
    text: `Olá, ${params.recipientName}!\n\nSegue em anexo, em PDF, ${summary}.\n\nShiken Dojo`,
    html: `<!doctype html><html lang="pt-BR"><body style="font-family:sans-serif;line-height:1.5">
<p>Olá, ${escapeHtml(params.recipientName)}!</p>
<p>Segue em anexo, em PDF, ${escapeHtml(summary)}.</p>
<p>Shiken Dojo</p></body></html>`,
    // Nome gerado pelo servidor: o nome enviado pelo cliente nunca é usado.
    attachment: {
      filename: `prova-${params.date}-${params.variant === 'filled' ? 'notas' : 'em-branco'}.pdf`,
      content: params.pdf,
    },
  };
}

export class ExamEmailService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly simulated: boolean,
  ) {}

  /**
   * Enfileira o PDF para o e-mail cadastrado do professor escolhido. O cliente nunca informa o
   * endereço: isso impede usar o sistema para mandar spam ou vazar dados para terceiros.
   */
  async send(
    auth: AuthContext,
    examId: string,
    upload: PdfUpload,
    meta: RequestMeta,
  ): Promise<EmailDeliveryDto> {
    return withTransaction(this.pool, async (client) => {
      const exam = await findExam(client, auth.dojoId, examId);
      if (!exam) throw EXAM_NOT_FOUND();
      const recipient = await findTeacher(client, auth.dojoId, upload.teacherId);
      if (!recipient?.active) throw validationFailed({ teacherId: 'Escolha um professor ativo.' });

      // Trava por professor que envia: duas requisições simultâneas não furam o limite.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [auth.teacherId]);
      for (const filter of [
        { requestedBy: auth.teacherId },
        { recipientTeacherId: recipient.id },
      ]) {
        const recent = await countRecentEmails(client, EMAIL_KIND, filter);
        if (recent.count >= EMAILS_PER_HOUR) throw tooManyRequests(recent.windowResetsInSeconds);
      }

      const queued = await enqueueEmail(client, {
        dojoId: auth.dojoId,
        kind: EMAIL_KIND,
        requestedBy: auth.teacherId,
        recipientTeacherId: recipient.id,
        message: buildExamEmail({
          to: recipient.email,
          recipientName: recipient.fullName,
          templateName: exam.templateName,
          date: exam.date,
          variant: upload.variant,
          pdf: upload.pdf,
        }),
      });
      // Auditoria sem o PDF nem dados pessoais: só quem, para quem e quando.
      await recordAudit(client, {
        dojoId: auth.dojoId,
        actorId: auth.teacherId,
        action: 'exam.emailed',
        targetId: exam.id,
        metadata: { recipientTeacherId: recipient.id, variant: upload.variant },
        ip: meta.ip,
      });
      return {
        recipientEmail: recipient.email,
        sentAt: queued.createdAt.toISOString(),
        simulated: this.simulated,
      };
    });
  }
}

/** Lê o multipart com limites rígidos e valida o anexo pelo conteúdo, não só pelo tipo. */
async function readUpload(request: FastifyRequest): Promise<PdfUpload> {
  const fields: Record<string, string> = {};
  let file: { mimetype: string; content: Buffer } | null = null;
  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'file' || file)
          throw validationFailed({ file: 'Envie um único PDF.' });
        file = { mimetype: part.mimetype, content: await part.toBuffer() };
      } else if (typeof part.value === 'string') {
        fields[part.fieldname] = part.value;
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      throw validationFailed({ file: 'O PDF passa do limite de 5 MB.' });
    }
    throw error;
  }

  const parsed = fieldsSchema.safeParse(fields);
  const errors: Record<string, string> = {};
  for (const issue of parsed.error?.issues ?? []) {
    errors[String(issue.path[0])] ??= issue.message;
  }
  const isPdf =
    file?.mimetype === 'application/pdf' &&
    file.content.subarray(0, 5).toString('latin1') === '%PDF-';
  if (!isPdf) errors['file'] = 'O anexo precisa ser um PDF.';
  if (!parsed.success || !file || !isPdf) throw validationFailed(errors);
  return { ...parsed.data, pdf: file.content };
}

export const examEmailRoutes: FastifyPluginAsyncZod<{ service: ExamEmailService }> = async (
  app,
  options,
) => {
  await app.register(multipart, {
    limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 4, fieldSize: 100, parts: 5 },
  });

  app.post(
    '/exams/:id/email',
    {
      schema: {
        tags: ['exams'],
        summary: 'Enviar o PDF da prova ao e-mail cadastrado de um professor',
        description:
          'multipart/form-data com teacherId, variant (filled | blank) e file (PDF até 5 MB).',
        consumes: ['multipart/form-data'],
        params: idParamsSchema,
        response: { 202: emailDeliverySchema },
      },
      config: { rateLimit: { max: 20, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      const auth = authOf(request);
      const upload = await readUpload(request);
      const delivery = await options.service.send(
        auth,
        request.params.id,
        upload,
        requestMeta(request),
      );
      return reply.code(202).send(delivery);
    },
  );
};

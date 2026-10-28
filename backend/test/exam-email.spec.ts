import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, deliverEmails, type TestContext } from './support/app.js';
import type { TestClient } from './support/client.js';
import { createTeacher } from './support/factories.js';
import { loggedIn } from './support/session.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF');

/** Monta o multipart/form-data como o FormData do navegador. */
function multipart(fields: Record<string, string>, file: { type: string; content: Buffer } | null) {
  const boundary = '----shikendojo' + Math.random().toString(16).slice(2);
  const parts: Buffer[] = Object.entries(fields).map(([name, value]) =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ),
  );
  if (file) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../etc/passwd.pdf"\r\n` +
          `Content-Type: ${file.type}\r\n\r\n`,
      ),
      file.content,
      Buffer.from('\r\n'),
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

async function sendPdf(
  client: TestClient,
  examId: string,
  fields: Record<string, string>,
  file: { type: string; content: Buffer } | null = { type: 'application/pdf', content: PDF },
) {
  const { payload, headers } = multipart(fields, file);
  return client.request('POST', `/api/v1/exams/${examId}/email`, undefined, { payload, headers });
}

async function setup() {
  const session = await loggedIn(ctx);
  const student = await session.client.post('/api/v1/students', {
    fullName: 'Ana Beatriz Carvalho',
    belt: 'branca',
  });
  const exam = await session.client.post('/api/v1/exams', {
    templateId: '01929b2c-5e00-7000-8000-000000000001',
    date: '2026-06-20',
    examinerId: session.teacher.id,
    passingGrade: 2,
    studentIds: [student.json<{ id: string }>().id],
  });
  return { ...session, examId: exam.json<{ id: string }>().id };
}

describe('envio do PDF da prova por e-mail', () => {
  it('enfileira para o e-mail cadastrado do professor e responde 202', async () => {
    const { client, teacher, examId } = await setup();

    const response = await sendPdf(client, examId, { teacherId: teacher.id, variant: 'filled' });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      recipientEmail: teacher.email,
      sentAt: expect.any(String),
      simulated: true,
    });

    await deliverEmails(ctx);
    const sent = ctx.mailer.sent.find((message) => message.to === teacher.email);
    expect(sent?.subject).toBe('Prova de faixa — Exame de faixa — Branca a Laranja (20/06/2026)');
    // Nome do anexo gerado pelo servidor, nunca o enviado pelo cliente.
    expect(sent?.attachment?.filename).toBe('prova-2026-06-20-notas.pdf');
    expect(sent?.attachment?.content.equals(PDF)).toBe(true);

    const { rows } = await ctx.pool.query(
      "SELECT metadata FROM audit_log WHERE action = 'exam.emailed' AND target_id = $1",
      [examId],
    );
    expect(rows[0]).toEqual({ metadata: { recipientTeacherId: teacher.id, variant: 'filled' } });
  });

  it('recusa arquivo que não é PDF, mesmo com Content-Type de PDF', async () => {
    const { client, teacher, examId } = await setup();

    const fake = await sendPdf(
      client,
      examId,
      { teacherId: teacher.id, variant: 'blank' },
      { type: 'application/pdf', content: Buffer.from('MZ\x90\x00 executável') },
    );
    const missing = await sendPdf(client, examId, { teacherId: teacher.id, variant: 'x' }, null);

    expect(fake.statusCode).toBe(422);
    expect(fake.json()).toMatchObject({ errors: { file: 'O anexo precisa ser um PDF.' } });
    expect(missing.json()).toMatchObject({
      errors: { file: 'O anexo precisa ser um PDF.', variant: 'Versão inválida.' },
    });
  });

  it('recusa PDF acima de 5 MB', async () => {
    const { client, teacher, examId } = await setup();
    const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);

    const response = await sendPdf(
      client,
      examId,
      { teacherId: teacher.id, variant: 'filled' },
      { type: 'application/pdf', content: big },
    );

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ errors: { file: 'O PDF passa do limite de 5 MB.' } });
  });

  it('só envia para professor ativo do mesmo dojo', async () => {
    const { client, teacher, examId } = await setup();
    const inactive = await createTeacher(ctx.pool, teacher.dojoId, { active: false });
    const outsider = await loggedIn(ctx);

    for (const teacherId of [inactive.id, outsider.teacher.id]) {
      const response = await sendPdf(client, examId, { teacherId, variant: 'filled' });
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        errors: { teacherId: 'Escolha um professor ativo.' },
      });
    }
  });

  it('não envia prova de outro dojo', async () => {
    const owner = await setup();
    const intruder = await loggedIn(ctx);

    const response = await sendPdf(intruder.client, owner.examId, {
      teacherId: intruder.teacher.id,
      variant: 'filled',
    });

    expect(response.statusCode).toBe(404);
  });

  it('limita a 10 envios por hora com 429 e Retry-After', async () => {
    const { client, teacher, examId } = await setup();
    const fields = { teacherId: teacher.id, variant: 'blank' };

    for (let i = 0; i < 10; i++) {
      expect((await sendPdf(client, examId, fields)).statusCode).toBe(202);
    }
    const blocked = await sendPdf(client, examId, fields);

    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(3500);
  });
});

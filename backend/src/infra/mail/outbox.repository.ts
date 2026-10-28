import type { Queryable } from '../db/pool.js';
import type { MailMessage } from './mailer.js';

export interface OutboxEntry {
  readonly dojoId: string | null;
  /** objeto.ação, ex.: 'teacher.invitation', 'exam.pdf'. */
  readonly kind: string;
  readonly requestedBy: string | null;
  readonly recipientTeacherId: string | null;
  readonly message: MailMessage;
}

/** Enfileira a mensagem. Chame dentro da transação da ação que a originou. */
export async function enqueueEmail(
  db: Queryable,
  entry: OutboxEntry,
): Promise<{ id: string; createdAt: Date }> {
  const { message } = entry;
  const { rows } = await db.query<{ id: string; createdAt: Date }>(
    `INSERT INTO email_outbox (dojo_id, kind, requested_by, recipient_teacher_id, recipient_email,
                               subject, text_body, html_body, attachment_name, attachment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, created_at AS "createdAt"`,
    [
      entry.dojoId,
      entry.kind,
      entry.requestedBy,
      entry.recipientTeacherId,
      message.to,
      message.subject,
      message.text,
      message.html,
      message.attachment?.filename ?? null,
      message.attachment?.content ?? null,
    ],
  );
  return rows[0]!;
}

/**
 * Quantos e-mails do tipo foram enfileirados na última hora (por quem pediu ou para quem) e
 * em quantos segundos o mais antigo deles sai da janela. Contado no banco, o limite vale
 * mesmo com várias instâncias da API.
 */
export async function countRecentEmails(
  db: Queryable,
  kind: string,
  filter: { readonly requestedBy: string } | { readonly recipientTeacherId: string },
): Promise<{ count: number; windowResetsInSeconds: number }> {
  const [column, value] =
    'requestedBy' in filter
      ? ['requested_by', filter.requestedBy]
      : ['recipient_teacher_id', filter.recipientTeacherId];
  const { rows } = await db.query<{ count: number; resetsIn: number | null }>(
    `SELECT count(*) AS count,
            ceil(extract(epoch FROM min(created_at) + interval '1 hour' - now()))::int AS "resetsIn"
       FROM email_outbox
      WHERE kind = $1 AND ${column} = $2 AND created_at > now() - interval '1 hour'`,
    [kind, value],
  );
  return { count: rows[0]!.count, windowResetsInSeconds: rows[0]!.resetsIn ?? 0 };
}

export interface ClaimedEmail {
  readonly id: string;
  readonly kind: string;
  readonly attempts: number;
  readonly message: MailMessage;
}

/** Tempo que uma mensagem fica reservada para um worker antes de outro poder retomá-la. */
const LEASE = "interval '2 minutes'";

/**
 * Reserva mensagens vencidas para envio. FOR UPDATE SKIP LOCKED permite várias instâncias
 * rodando o worker sem enviar a mesma mensagem duas vezes.
 */
export async function claimDueEmails(db: Queryable, limit: number): Promise<ClaimedEmail[]> {
  const { rows } = await db.query<{
    id: string;
    kind: string;
    attempts: number;
    to: string;
    subject: string;
    text: string;
    html: string | null;
    attachmentName: string | null;
    attachment: Buffer | null;
  }>(
    `UPDATE email_outbox o
        SET status = 'sending', attempts = o.attempts + 1, locked_until = now() + ${LEASE}
      WHERE o.id IN (
        SELECT id FROM email_outbox
         WHERE (status = 'pending' AND next_attempt_at <= now())
            OR (status = 'sending' AND locked_until < now())
         ORDER BY next_attempt_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING o.id, o.kind, o.attempts, o.recipient_email AS "to", o.subject,
                o.text_body AS "text", o.html_body AS "html",
                o.attachment_name AS "attachmentName", o.attachment`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    attempts: row.attempts,
    message: {
      to: row.to,
      subject: row.subject,
      text: row.text,
      html: row.html,
      attachment:
        row.attachmentName && row.attachment
          ? { filename: row.attachmentName, content: row.attachment }
          : null,
    },
  }));
}

/** Concluído (enviado ou desistido): apaga o conteúdo e mantém só o registro do envio. */
export async function finishEmail(
  db: Queryable,
  id: string,
  status: 'sent' | 'dead',
  error: string | null,
): Promise<void> {
  await db.query(
    `UPDATE email_outbox
        SET status = $2, last_error = $3, locked_until = NULL,
            sent_at = CASE WHEN $2 = 'sent' THEN now() END,
            recipient_email = NULL, subject = NULL, text_body = NULL, html_body = NULL,
            attachment_name = NULL, attachment = NULL
      WHERE id = $1`,
    [id, status, error],
  );
}

export async function scheduleRetry(
  db: Queryable,
  id: string,
  delaySeconds: number,
  error: string,
): Promise<void> {
  await db.query(
    `UPDATE email_outbox
        SET status = 'pending', locked_until = NULL, last_error = $3,
            next_attempt_at = now() + make_interval(secs => $2)
      WHERE id = $1`,
    [id, delaySeconds, error],
  );
}

/** Registros antigos de envio já concluído (sem conteúdo) não são mais necessários. */
export async function purgeFinishedEmails(db: Queryable): Promise<number> {
  const result = await db.query(
    `DELETE FROM email_outbox
      WHERE status IN ('sent', 'dead') AND created_at < now() - interval '90 days'`,
  );
  return result.rowCount ?? 0;
}

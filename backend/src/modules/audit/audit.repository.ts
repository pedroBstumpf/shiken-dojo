import type { Queryable } from '../../infra/db/pool.js';

export interface AuditEntry {
  readonly dojoId: string | null;
  readonly actorId: string | null;
  /** objeto.ação no passado, ex.: 'student.deleted', 'auth.login_failed'. */
  readonly action: string;
  readonly targetId?: string | null;
  /** Só IDs e códigos. Nunca nomes, e-mails, notas ou outros dados pessoais. */
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
  readonly ip?: string | null;
}

/**
 * Registro append-only de eventos de segurança e ações sensíveis (BACKEND.md §16).
 * Use o mesmo client da transação da ação, para os dois serem gravados juntos.
 */
export async function recordAudit(db: Queryable, entry: AuditEntry): Promise<void> {
  await db.query(
    `INSERT INTO audit_log (dojo_id, actor_id, action, target_id, metadata, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.dojoId,
      entry.actorId,
      entry.action,
      entry.targetId ?? null,
      entry.metadata ?? {},
      entry.ip ?? null,
    ],
  );
}

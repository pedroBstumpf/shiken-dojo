import type { Queryable } from '../../infra/db/pool.js';

/**
 * Cria um convite e invalida os anteriores ainda não usados do mesmo professor:
 * só o link mais recente funciona.
 */
export async function replaceInvitation(
  db: Queryable,
  invitation: {
    readonly teacherId: string;
    readonly tokenHash: Buffer;
    readonly createdBy: string | null;
    readonly validHours: number;
  },
): Promise<void> {
  await db.query('DELETE FROM teacher_invitations WHERE teacher_id = $1 AND used_at IS NULL', [
    invitation.teacherId,
  ]);
  await db.query(
    `INSERT INTO teacher_invitations (token_hash, teacher_id, created_by, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [invitation.tokenHash, invitation.teacherId, invitation.createdBy, invitation.validHours],
  );
}

/**
 * Consome o convite (uso único) e devolve o professor, se o convite for válido.
 * O UPDATE ... RETURNING garante que dois envios simultâneos não usem o mesmo token.
 */
export async function consumeInvitation(
  db: Queryable,
  tokenHash: Buffer,
): Promise<{ teacherId: string; dojoId: string } | null> {
  const { rows } = await db.query<{ teacherId: string; dojoId: string }>(
    `UPDATE teacher_invitations i
        SET used_at = now()
       FROM teachers t
      WHERE i.token_hash = $1
        AND i.used_at IS NULL
        AND i.expires_at > now()
        AND t.id = i.teacher_id
        AND t.active
      RETURNING t.id AS "teacherId", t.dojo_id AS "dojoId"`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function deleteStaleInvitations(db: Queryable): Promise<number> {
  const result = await db.query(
    `DELETE FROM teacher_invitations
      WHERE expires_at <= now() - interval '30 days'
         OR used_at <= now() - interval '30 days'`,
  );
  return result.rowCount ?? 0;
}

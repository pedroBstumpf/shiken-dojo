import type { Queryable } from '../../infra/db/pool.js';
import type { TeacherRole } from './auth.types.js';

export interface SessionRow {
  readonly id: string;
  readonly teacherId: string;
  readonly dojoId: string;
  readonly role: TeacherRole;
  readonly lastSeenAt: Date;
}

export interface SessionListRow {
  readonly id: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly userAgent: string;
}

export async function insertSession(
  db: Queryable,
  session: {
    readonly tokenHash: Buffer;
    readonly teacherId: string;
    readonly dojoId: string;
    readonly absoluteHours: number;
    readonly userAgent: string;
    readonly ip: string;
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (token_hash, teacher_id, dojo_id, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4), $5, $6)
     RETURNING id`,
    [
      session.tokenHash,
      session.teacherId,
      session.dojoId,
      session.absoluteHours,
      session.userAgent,
      session.ip,
    ],
  );
  return rows[0]!.id;
}

/** Sessão válida: não expirou, não ficou inativa demais e o professor continua ativo. */
export async function findValidSession(
  db: Queryable,
  tokenHash: Buffer,
  idleMinutes: number,
): Promise<SessionRow | null> {
  const { rows } = await db.query<SessionRow>(
    `SELECT s.id, s.teacher_id AS "teacherId", s.dojo_id AS "dojoId", t.role,
            s.last_seen_at AS "lastSeenAt"
       FROM sessions s
       JOIN teachers t ON t.id = s.teacher_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND s.last_seen_at > now() - make_interval(mins => $2)
        AND t.active`,
    [tokenHash, idleMinutes],
  );
  return rows[0] ?? null;
}

export async function touchSession(db: Queryable, sessionId: string): Promise<void> {
  await db.query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [sessionId]);
}

export async function deleteSessionByTokenHash(
  db: Queryable,
  tokenHash: Buffer,
): Promise<{ id: string; teacherId: string; dojoId: string } | null> {
  const { rows } = await db.query<{ id: string; teacherId: string; dojoId: string }>(
    `DELETE FROM sessions WHERE token_hash = $1
     RETURNING id, teacher_id AS "teacherId", dojo_id AS "dojoId"`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function listTeacherSessions(
  db: Queryable,
  teacherId: string,
  idleMinutes: number,
): Promise<SessionListRow[]> {
  const { rows } = await db.query<SessionListRow>(
    `SELECT id, created_at AS "createdAt", last_seen_at AS "lastSeenAt", user_agent AS "userAgent"
       FROM sessions
      WHERE teacher_id = $1
        AND expires_at > now()
        AND last_seen_at > now() - make_interval(mins => $2)
      ORDER BY last_seen_at DESC
      LIMIT 50`,
    [teacherId, idleMinutes],
  );
  return rows;
}

export async function deleteTeacherSession(
  db: Queryable,
  teacherId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await db.query('DELETE FROM sessions WHERE id = $1 AND teacher_id = $2', [
    sessionId,
    teacherId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

/** Encerra todas as sessões do professor (troca de senha, desativação, exclusão). */
export async function deleteAllTeacherSessions(db: Queryable, teacherId: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE teacher_id = $1', [teacherId]);
}

export async function deleteExpiredSessions(db: Queryable, idleMinutes: number): Promise<number> {
  const result = await db.query(
    `DELETE FROM sessions
      WHERE expires_at <= now() OR last_seen_at <= now() - make_interval(mins => $1)`,
    [idleMinutes],
  );
  return result.rowCount ?? 0;
}

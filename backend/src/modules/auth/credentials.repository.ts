import type { Queryable } from '../../infra/db/pool.js';
import type { TeacherRole } from './auth.types.js';

export interface TeacherCredentials {
  readonly id: string;
  readonly dojoId: string;
  readonly role: TeacherRole;
  readonly active: boolean;
  readonly passwordHash: string | null;
  readonly lockedUntil: Date | null;
}

export async function findCredentialsByEmail(
  db: Queryable,
  email: string,
): Promise<TeacherCredentials | null> {
  const { rows } = await db.query<TeacherCredentials>(
    `SELECT id, dojo_id AS "dojoId", role, active, password_hash AS "passwordHash",
            locked_until AS "lockedUntil"
       FROM teachers
      WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export const MAX_FAILED_ATTEMPTS = 5;
export const MAX_LOCK_MINUTES = 60;

/**
 * Conta a falha de forma atômica. A partir da 5ª falha seguida, bloqueia por 1, 2, 4, 8…
 * minutos (até 60): bloqueio progressivo contra força bruta (BACKEND.md §4).
 */
export async function registerFailedLogin(db: Queryable, teacherId: string): Promise<void> {
  await db.query(
    `UPDATE teachers
        SET failed_login_count = failed_login_count + 1,
            locked_until = CASE
              WHEN failed_login_count + 1 >= $2
              THEN now() + make_interval(
                     mins => least($3, power(2, failed_login_count + 1 - $2))::int)
              ELSE locked_until
            END
      WHERE id = $1`,
    [teacherId, MAX_FAILED_ATTEMPTS, MAX_LOCK_MINUTES],
  );
}

export async function registerSuccessfulLogin(
  db: Queryable,
  teacherId: string,
  newPasswordHash: string | null,
): Promise<void> {
  await db.query(
    `UPDATE teachers
        SET failed_login_count = 0,
            locked_until = NULL,
            password_hash = coalesce($2, password_hash)
      WHERE id = $1`,
    [teacherId, newPasswordHash],
  );
}

export async function setPassword(
  db: Queryable,
  teacherId: string,
  passwordHash: string,
): Promise<void> {
  await db.query(
    `UPDATE teachers
        SET password_hash = $2, failed_login_count = 0, locked_until = NULL
      WHERE id = $1`,
    [teacherId, passwordHash],
  );
}

export interface SessionProfile {
  readonly teacher: {
    readonly id: string;
    readonly fullName: string;
    readonly email: string;
    readonly role: TeacherRole;
  };
  readonly dojo: { readonly id: string; readonly name: string };
}

export async function findSessionProfile(
  db: Queryable,
  teacherId: string,
): Promise<SessionProfile | null> {
  const { rows } = await db.query<{
    id: string;
    fullName: string;
    email: string;
    role: TeacherRole;
    dojoId: string;
    dojoName: string;
  }>(
    `SELECT t.id, t.full_name AS "fullName", t.email, t.role,
            d.id AS "dojoId", d.name AS "dojoName"
       FROM teachers t
       JOIN dojos d ON d.id = t.dojo_id
      WHERE t.id = $1`,
    [teacherId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    teacher: { id: row.id, fullName: row.fullName, email: row.email, role: row.role },
    dojo: { id: row.dojoId, name: row.dojoName },
  };
}

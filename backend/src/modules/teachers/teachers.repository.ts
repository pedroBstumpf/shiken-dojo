import type { Queryable } from '../../infra/db/pool.js';
import type { Belt } from '../../shared/validation/common.js';
import type { TeacherRole } from '../auth/auth.types.js';
import type { TeacherWrite } from './teachers.schemas.js';

export interface TeacherRow {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly role: TeacherRole;
  readonly belt: Belt;
  readonly dan: number | null;
  readonly federationId: string;
  readonly active: boolean;
  readonly invitationPending: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// password_hash nunca sai deste módulo: só o indicador de convite pendente.
const COLUMNS = `id, full_name AS "fullName", email, phone, role, belt, dan,
  federation_id AS "federationId", active, (password_hash IS NULL) AS "invitationPending",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function listTeachers(
  db: Queryable,
  dojoId: string,
  limit: number,
  after: { readonly fullName: string; readonly id: string } | null,
): Promise<TeacherRow[]> {
  const { rows } = await db.query<TeacherRow>(
    `SELECT ${COLUMNS}
       FROM teachers
      WHERE dojo_id = $1
        AND ($2::text IS NULL OR (full_name, id) > ($2, $3::uuid))
      ORDER BY full_name, id
      LIMIT $4`,
    [dojoId, after?.fullName ?? null, after?.id ?? null, limit],
  );
  return rows;
}

export async function findTeacher(
  db: Queryable,
  dojoId: string,
  id: string,
  options: { readonly forUpdate?: boolean } = {},
): Promise<TeacherRow | null> {
  const { rows } = await db.query<TeacherRow>(
    `SELECT ${COLUMNS} FROM teachers WHERE id = $1 AND dojo_id = $2
     ${options.forUpdate ? 'FOR UPDATE' : ''}`,
    [id, dojoId],
  );
  return rows[0] ?? null;
}

export async function isEmailTaken(
  db: Queryable,
  email: string,
  exceptId: string | null,
): Promise<boolean> {
  const { rows } = await db.query(
    'SELECT 1 FROM teachers WHERE email = $1 AND ($2::uuid IS NULL OR id <> $2)',
    [email, exceptId],
  );
  return rows.length > 0;
}

export async function insertTeacher(
  db: Queryable,
  dojoId: string,
  input: TeacherWrite,
): Promise<TeacherRow> {
  const { rows } = await db.query<TeacherRow>(
    `INSERT INTO teachers (dojo_id, full_name, email, phone, role, belt, dan, federation_id, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COLUMNS}`,
    [
      dojoId,
      input.fullName,
      input.email,
      input.phone,
      input.role,
      input.belt,
      input.dan,
      input.federationId,
      input.active,
    ],
  );
  return rows[0]!;
}

export async function updateTeacher(
  db: Queryable,
  dojoId: string,
  id: string,
  input: TeacherWrite,
): Promise<TeacherRow | null> {
  const { rows } = await db.query<TeacherRow>(
    `UPDATE teachers
        SET full_name = $3, email = $4, phone = $5, role = $6, belt = $7, dan = $8,
            federation_id = $9, active = $10
      WHERE id = $1 AND dojo_id = $2
      RETURNING ${COLUMNS}`,
    [
      id,
      dojoId,
      input.fullName,
      input.email,
      input.phone,
      input.role,
      input.belt,
      input.dan,
      input.federationId,
      input.active,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteTeacher(db: Queryable, dojoId: string, id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM teachers WHERE id = $1 AND dojo_id = $2', [
    id,
    dojoId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * IDs dos senseis responsáveis ativos do dojo, travando as linhas: duas alterações
 * simultâneas não conseguem, juntas, deixar o dojo sem responsável.
 */
export async function lockActiveHeadInstructors(db: Queryable, dojoId: string): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM teachers
      WHERE dojo_id = $1 AND role = 'head_instructor' AND active
      ORDER BY id
      FOR UPDATE`,
    [dojoId],
  );
  return rows.map((row) => row.id);
}

export async function findInvitationContext(
  db: Queryable,
  dojoId: string,
  inviterId: string,
): Promise<{ dojoName: string; inviterName: string }> {
  const { rows } = await db.query<{ dojoName: string; inviterName: string }>(
    `SELECT d.name AS "dojoName", t.full_name AS "inviterName"
       FROM dojos d JOIN teachers t ON t.dojo_id = d.id
      WHERE d.id = $1 AND t.id = $2`,
    [dojoId, inviterId],
  );
  return rows[0] ?? { dojoName: 'Shiken Dojo', inviterName: 'O sensei responsável' };
}

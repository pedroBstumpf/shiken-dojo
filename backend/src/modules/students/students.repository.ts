import type { Queryable } from '../../infra/db/pool.js';
import type { Belt } from '../../shared/validation/common.js';
import type { StudentWrite } from './students.schemas.js';

export interface StudentRow {
  readonly id: string;
  readonly fullName: string;
  readonly belt: Belt;
  readonly birthDate: string | null;
  readonly enrollmentDate: string | null;
  readonly notes: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Toda consulta filtra por dojo_id, que vem da sessão (prevenção de BOLA, BACKEND.md §5).

const COLUMNS = `id, full_name AS "fullName", belt, birth_date AS "birthDate",
  enrollment_date AS "enrollmentDate", notes, created_at AS "createdAt",
  updated_at AS "updatedAt"`;

export async function listStudents(
  db: Queryable,
  dojoId: string,
  limit: number,
  after: { readonly fullName: string; readonly id: string } | null,
): Promise<StudentRow[]> {
  const { rows } = await db.query<StudentRow>(
    `SELECT ${COLUMNS}
       FROM students
      WHERE dojo_id = $1
        AND ($2::text IS NULL OR (full_name, id) > ($2, $3::uuid))
      ORDER BY full_name, id
      LIMIT $4`,
    [dojoId, after?.fullName ?? null, after?.id ?? null, limit],
  );
  return rows;
}

export async function findStudent(
  db: Queryable,
  dojoId: string,
  id: string,
): Promise<StudentRow | null> {
  const { rows } = await db.query<StudentRow>(
    `SELECT ${COLUMNS} FROM students WHERE id = $1 AND dojo_id = $2`,
    [id, dojoId],
  );
  return rows[0] ?? null;
}

export async function insertStudent(
  db: Queryable,
  dojoId: string,
  input: StudentWrite,
): Promise<StudentRow> {
  const { rows } = await db.query<StudentRow>(
    `INSERT INTO students (dojo_id, full_name, belt, birth_date, enrollment_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [dojoId, input.fullName, input.belt, input.birthDate, input.enrollmentDate, input.notes],
  );
  return rows[0]!;
}

export async function updateStudent(
  db: Queryable,
  dojoId: string,
  id: string,
  input: StudentWrite,
): Promise<StudentRow | null> {
  const { rows } = await db.query<StudentRow>(
    `UPDATE students
        SET full_name = $3, belt = $4, birth_date = $5, enrollment_date = $6, notes = $7
      WHERE id = $1 AND dojo_id = $2
      RETURNING ${COLUMNS}`,
    [id, dojoId, input.fullName, input.belt, input.birthDate, input.enrollmentDate, input.notes],
  );
  return rows[0] ?? null;
}

export async function deleteStudent(db: Queryable, dojoId: string, id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM students WHERE id = $1 AND dojo_id = $2', [
    id,
    dojoId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

/** Alunos do dojo entre os IDs pedidos (usado ao montar o retrato de uma prova). */
export async function findStudentsByIds(
  db: Queryable,
  dojoId: string,
  ids: readonly string[],
): Promise<StudentRow[]> {
  const { rows } = await db.query<StudentRow>(
    `SELECT ${COLUMNS} FROM students WHERE dojo_id = $1 AND id = ANY($2::uuid[])`,
    [dojoId, ids],
  );
  return rows;
}

import type { Queryable } from '../../infra/db/pool.js';
import type { Belt } from '../../shared/validation/common.js';
import type { ExamSection } from './exam-templates.js';

export type ExamStatus = 'draft' | 'completed';

export interface ExamRow {
  readonly id: string;
  readonly status: ExamStatus;
  readonly templateId: string;
  readonly templateName: string;
  readonly fromBelt: Belt;
  readonly toBelt: Belt;
  readonly sections: ExamSection[];
  readonly date: string;
  readonly location: string;
  readonly examinerId: string | null;
  readonly examinerName: string;
  readonly passingGrade: number;
  readonly notes: string;
  readonly createdAt: Date;
  /** created_at com precisão de microssegundos, para o cursor da listagem. */
  readonly createdAtKey: string;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

export interface ParticipantRow {
  readonly examId: string;
  readonly position: number;
  readonly studentId: string;
  readonly fullName: string;
  readonly belt: Belt;
}

const COLUMNS = `id, status, template_id AS "templateId", template_name AS "templateName",
  from_belt AS "fromBelt", to_belt AS "toBelt", sections, exam_date AS "date", location,
  examiner_id AS "examinerId", examiner_name AS "examinerName",
  passing_grade AS "passingGrade", notes, created_at AS "createdAt",
  created_at::text AS "createdAtKey", updated_at AS "updatedAt",
  completed_at AS "completedAt"`;

export async function listExams(
  db: Queryable,
  dojoId: string,
  limit: number,
  after: { readonly date: string; readonly createdAt: string; readonly id: string } | null,
): Promise<ExamRow[]> {
  // Mais recentes primeiro; o cursor continua de onde a página anterior parou.
  const { rows } = await db.query<ExamRow>(
    `SELECT ${COLUMNS}
       FROM exams
      WHERE dojo_id = $1
        AND ($2::date IS NULL OR (exam_date, created_at, id) < ($2, $3::timestamptz, $4::uuid))
      ORDER BY exam_date DESC, created_at DESC, id DESC
      LIMIT $5`,
    [dojoId, after?.date ?? null, after?.createdAt ?? null, after?.id ?? null, limit],
  );
  return rows;
}

export async function findExam(
  db: Queryable,
  dojoId: string,
  id: string,
  options: { readonly forUpdate?: boolean } = {},
): Promise<ExamRow | null> {
  const { rows } = await db.query<ExamRow>(
    `SELECT ${COLUMNS} FROM exams WHERE id = $1 AND dojo_id = $2
     ${options.forUpdate ? 'FOR UPDATE' : ''}`,
    [id, dojoId],
  );
  return rows[0] ?? null;
}

export async function insertExam(
  db: Queryable,
  exam: {
    readonly dojoId: string;
    readonly templateId: string;
    readonly templateName: string;
    readonly fromBelt: Belt;
    readonly toBelt: Belt;
    readonly sections: readonly ExamSection[];
    readonly date: string;
    readonly location: string;
    readonly examinerId: string;
    readonly examinerName: string;
    readonly passingGrade: number;
    readonly notes: string;
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO exams (dojo_id, template_id, template_name, from_belt, to_belt, sections,
                        exam_date, location, examiner_id, examiner_name, passing_grade, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      exam.dojoId,
      exam.templateId,
      exam.templateName,
      exam.fromBelt,
      exam.toBelt,
      JSON.stringify(exam.sections),
      exam.date,
      exam.location,
      exam.examinerId,
      exam.examinerName,
      exam.passingGrade,
      exam.notes,
    ],
  );
  return rows[0]!.id;
}

export async function insertParticipants(
  db: Queryable,
  examId: string,
  participants: readonly { studentId: string; fullName: string; belt: Belt }[],
): Promise<void> {
  await db.query(
    `INSERT INTO exam_participants (exam_id, position, student_id, full_name, belt)
     SELECT $1, ord - 1, student_id, full_name, belt
       FROM unnest($2::uuid[], $3::text[], $4::text[]) WITH ORDINALITY
            AS p(student_id, full_name, belt, ord)`,
    [
      examId,
      participants.map((p) => p.studentId),
      participants.map((p) => p.fullName),
      participants.map((p) => p.belt),
    ],
  );
}

export async function findParticipants(
  db: Queryable,
  examIds: readonly string[],
): Promise<ParticipantRow[]> {
  const { rows } = await db.query<ParticipantRow>(
    `SELECT exam_id AS "examId", position, student_id AS "studentId", full_name AS "fullName", belt
       FROM exam_participants
      WHERE exam_id = ANY($1::uuid[])
      ORDER BY exam_id, position`,
    [examIds],
  );
  return rows;
}

/** Planilhas de notas das provas pedidas, indexadas por aluno (studentId). Uma consulta só. */
export async function findGradeSheets(
  db: Queryable,
  examIds: readonly string[],
): Promise<Map<string, Record<string, Record<string, number>>>> {
  const { rows } = await db.query<{
    examId: string;
    studentId: string;
    itemId: string;
    grade: number;
  }>(
    `SELECT g.exam_id AS "examId", p.student_id AS "studentId", g.item_id AS "itemId", g.grade
       FROM exam_grades g
       JOIN exam_participants p ON p.exam_id = g.exam_id AND p.position = g.position
      WHERE g.exam_id = ANY($1::uuid[])`,
    [examIds],
  );
  const sheets = new Map<string, Record<string, Record<string, number>>>();
  for (const row of rows) {
    const sheet = sheets.get(row.examId) ?? {};
    (sheet[row.studentId] ??= {})[row.itemId] = row.grade;
    sheets.set(row.examId, sheet);
  }
  return sheets;
}

/** Substitui a planilha inteira (PUT idempotente). */
export async function replaceGrades(
  db: Queryable,
  examId: string,
  grades: readonly { position: number; itemId: string; grade: number }[],
): Promise<void> {
  await db.query('DELETE FROM exam_grades WHERE exam_id = $1', [examId]);
  if (grades.length === 0) return;
  await db.query(
    `INSERT INTO exam_grades (exam_id, position, item_id, grade)
     SELECT $1, position, item_id, grade
       FROM unnest($2::smallint[], $3::text[], $4::numeric[]) AS g(position, item_id, grade)`,
    [
      examId,
      grades.map((g) => g.position),
      grades.map((g) => g.itemId),
      grades.map((g) => g.grade),
    ],
  );
}

export async function bumpExamVersion(db: Queryable, examId: string): Promise<void> {
  await db.query('UPDATE exams SET version = version + 1 WHERE id = $1', [examId]);
}

export async function markExamCompleted(db: Queryable, examId: string): Promise<void> {
  await db.query(
    `UPDATE exams SET status = 'completed', completed_at = now(), version = version + 1
      WHERE id = $1 AND status = 'draft'`,
    [examId],
  );
}

export async function deleteExam(db: Queryable, examId: string): Promise<void> {
  await db.query("DELETE FROM exams WHERE id = $1 AND status = 'draft'", [examId]);
}

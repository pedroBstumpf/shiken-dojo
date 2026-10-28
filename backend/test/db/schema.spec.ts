import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requireEnv } from '../support/env.js';

// Regras que o próprio banco garante, independentemente do código da aplicação.

const CHECK_VIOLATION = '23514';
const INSUFFICIENT_PRIVILEGE = '42501';

let runtime: pg.Client;

beforeAll(async () => {
  runtime = new pg.Client({ connectionString: requireEnv('TEST_DATABASE_URL') });
  await runtime.connect();
});

afterAll(async () => {
  await runtime.end();
});

async function createCompletedExam(): Promise<{ examId: string; studentId: string }> {
  const dojo = await runtime.query<{ id: string }>(
    "INSERT INTO dojos (name) VALUES ('Dojo de teste') RETURNING id",
  );
  const dojoId = dojo.rows[0]!.id;
  const template = await runtime.query<{ id: string }>(
    `INSERT INTO exam_templates (dojo_id, name, from_belt, to_belt, sections)
     VALUES ($1, 'Tabela', 'branca', 'amarela', '[]') RETURNING id`,
    [dojoId],
  );
  const exam = await runtime.query<{ id: string }>(
    `INSERT INTO exams (dojo_id, template_id, template_name, from_belt, to_belt, sections,
                        exam_date, examiner_name, passing_grade)
     VALUES ($1, $2, 'Tabela', 'branca', 'amarela', '[]', '2026-06-20', 'Sensei', 2)
     RETURNING id`,
    [dojoId, template.rows[0]!.id],
  );
  const examId = exam.rows[0]!.id;
  const studentId = crypto.randomUUID();
  await runtime.query(
    `INSERT INTO exam_participants (exam_id, position, student_id, full_name, belt)
     VALUES ($1, 0, $2, 'Aluno', 'branca')`,
    [examId, studentId],
  );
  await runtime.query(
    "INSERT INTO exam_grades (exam_id, position, item_id, grade) VALUES ($1, 0, 'k1-01', 2.5)",
    [examId],
  );
  await runtime.query("UPDATE exams SET status = 'completed', completed_at = now() WHERE id = $1", [
    examId,
  ]);
  return { examId, studentId };
}

describe('schema do banco', () => {
  it('impede alterar notas de uma prova concluída', async () => {
    const { examId } = await createCompletedExam();

    await expect(
      runtime.query('UPDATE exam_grades SET grade = 3 WHERE exam_id = $1', [examId]),
    ).rejects.toThrow('EXAM_LOCKED');
    await expect(runtime.query('DELETE FROM exams WHERE id = $1', [examId])).rejects.toThrow(
      'EXAM_LOCKED',
    );
    await expect(
      runtime.query("UPDATE exams SET notes = 'alterado' WHERE id = $1", [examId]),
    ).rejects.toThrow('EXAM_LOCKED');
  });

  it('permite anonimizar o nome do participante de uma prova concluída (LGPD)', async () => {
    const { examId } = await createCompletedExam();

    await runtime.query(
      "UPDATE exam_participants SET full_name = 'Aluno removido' WHERE exam_id = $1",
      [examId],
    );
    await expect(
      runtime.query("UPDATE exam_participants SET belt = 'preta' WHERE exam_id = $1", [examId]),
    ).rejects.toThrow('EXAM_LOCKED');
  });

  it('rejeita notas fora da escala de 0 a 3', async () => {
    await expect(
      runtime.query(
        "INSERT INTO exam_grades (exam_id, position, item_id, grade) VALUES ($1, 0, 'x', 3.5)",
        [crypto.randomUUID()],
      ),
    ).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it('mantém a auditoria append-only para o papel da API', async () => {
    await runtime.query("INSERT INTO audit_log (action) VALUES ('test.inserted')");

    await expect(runtime.query('DELETE FROM audit_log')).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
    await expect(runtime.query("UPDATE audit_log SET action = 'x.y'")).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it('não deixa o papel da API alterar o schema', async () => {
    await expect(runtime.query('CREATE TABLE hack (id int)')).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
    await expect(runtime.query('DROP TABLE students')).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it('exige grau (dan) somente para faixa preta', async () => {
    const dojo = await runtime.query<{ id: string }>(
      "INSERT INTO dojos (name) VALUES ('Dojo') RETURNING id",
    );
    await expect(
      runtime.query(
        `INSERT INTO teachers (dojo_id, full_name, email, role, belt, dan)
         VALUES ($1, 'Sensei', $2, 'instructor', 'verde', 2)`,
        [dojo.rows[0]!.id, `${crypto.randomUUID()}@dojo.test`],
      ),
    ).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });
});

/**
 * Dados fictícios para desenvolvimento (os mesmos que a API simulada do front-end usava).
 * Nunca use dados reais de alunos aqui (BACKEND.md §9). Recusa rodar em produção.
 *
 *   npm run db:seed
 */
import { createPool, withTransaction } from '../infra/db/pool.js';
import { hashPassword } from '../modules/auth/password.js';

const TEMPLATE_ID = '01929b2c-5e00-7000-8000-000000000001';
const HEAD_EMAIL = 'okada@dojo.exemplo';

const STUDENTS: readonly [string, string, string | null, string | null][] = [
  ['Ana Beatriz Carvalho', 'branca', '2014-03-12', '2025-02-10'],
  ['Bruno Henrique Lima', 'branca', '2012-07-25', '2025-03-03'],
  ['Carla Mendes', 'branca', '2010-11-02', '2025-02-17'],
  ['Diego Fernandes Rocha', 'amarela', '2013-01-30', '2024-08-05'],
  ['Eduarda Nogueira', 'branca', '2015-06-18', '2025-04-07'],
  ['Felipe Augusto Martins', 'vermelha', '2009-09-09', '2024-03-11'],
  ['Gabriela Tanaka', 'laranja', '2011-04-21', '2023-09-04'],
  ['Henrique Sato', 'branca', '2013-12-05', '2025-05-12'],
  ['Isabela Costa Ribeiro', 'amarela', '2012-02-14', '2024-10-21'],
  ['João Pedro Almeida', 'branca', '2014-08-27', '2025-02-24'],
  ['Larissa Yamamoto', 'verde', '2008-05-03', '2022-07-18'],
  ['Mateus Oliveira', 'branca', null, '2025-06-02'],
];

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('O seed de demonstração não roda em produção. Use npm run bootstrap.');
  }
  const connectionString = process.env['DATABASE_URL'];
  const password = process.env['SEED_PASSWORD'];
  if (!connectionString) throw new Error('Defina DATABASE_URL (veja npm run db:setup).');
  if (!password || password.length < 10) {
    throw new Error('Defina SEED_PASSWORD (10+ caracteres) para os professores de demonstração.');
  }

  const pool = createPool({ connectionString, applicationName: 'shiken-dojo-seed', max: 1 });
  try {
    const existing = await pool.query('SELECT 1 FROM teachers WHERE email = $1', [HEAD_EMAIL]);
    if (existing.rowCount) {
      console.log('Os dados de demonstração já existem. Nada a fazer.');
      return;
    }
    const passwordHash = await hashPassword(password);

    await withTransaction(pool, async (client) => {
      const dojo = await client.query<{ id: string }>(
        "INSERT INTO dojos (name) VALUES ('Dojo Hien (demonstração)') RETURNING id",
      );
      const dojoId = dojo.rows[0]!.id;

      const teachers = await client.query<{ id: string; fullName: string }>(
        `INSERT INTO teachers (dojo_id, full_name, email, phone, role, belt, dan, federation_id,
                               password_hash)
         VALUES ($1, 'Hiroshi Okada', $2, '11987654321', 'head_instructor', 'preta', 4,
                 'HKK-0042', $3),
                ($1, 'Mariana Costa', 'mariana@dojo.exemplo', '', 'instructor', 'preta', 1, '', $3)
         RETURNING id, full_name AS "fullName"`,
        [dojoId, HEAD_EMAIL, passwordHash],
      );
      const examiner = teachers.rows[0]!;

      const students = await client.query<{ id: string; fullName: string; belt: string }>(
        `INSERT INTO students (dojo_id, full_name, belt, birth_date, enrollment_date)
         SELECT $1, * FROM unnest($2::text[], $3::text[], $4::date[], $5::date[])
         RETURNING id, full_name AS "fullName", belt`,
        [
          dojoId,
          STUDENTS.map((s) => s[0]),
          STUDENTS.map((s) => s[1]),
          STUDENTS.map((s) => s[2]),
          STUDENTS.map((s) => s[3]),
        ],
      );

      // Uma prova já finalizada, para o histórico não começar vazio.
      const template = await client.query<{
        name: string;
        sections: { items: { id: string }[] }[];
      }>('SELECT name, sections FROM exam_templates WHERE id = $1', [TEMPLATE_ID]);
      const { name, sections } = template.rows[0]!;
      const exam = await client.query<{ id: string }>(
        `INSERT INTO exams (dojo_id, template_id, template_name, from_belt, to_belt, sections,
                            exam_date, location, examiner_id, examiner_name, passing_grade, notes)
         VALUES ($1, $2, $3, 'branca', 'laranja', $4, '2026-06-20', 'Dojo central', $5, $6, 2,
                 'Exame semestral de junho.')
         RETURNING id`,
        [dojoId, TEMPLATE_ID, name, JSON.stringify(sections), examiner.id, examiner.fullName],
      );
      const examId = exam.rows[0]!.id;
      const participants = students.rows.filter((s) => ['amarela', 'vermelha'].includes(s.belt));
      const items = sections.flatMap((section) => section.items.map((item) => item.id));
      for (const [position, student] of participants.entries()) {
        await client.query(
          `INSERT INTO exam_participants (exam_id, position, student_id, full_name, belt)
           VALUES ($1, $2, $3, $4, 'branca')`,
          [examId, position, student.id, student.fullName],
        );
        // Notas determinísticas entre 1 e 3 para a demonstração.
        await client.query(
          `INSERT INTO exam_grades (exam_id, position, item_id, grade)
           SELECT $1, $2, item_id, grade FROM unnest($3::text[], $4::numeric[]) AS g(item_id, grade)`,
          [
            examId,
            position,
            items,
            items.map((_, i) => 1 + (((position + 1) * 7 + i * 3) % 5) * 0.5),
          ],
        );
      }
      await client.query(
        "UPDATE exams SET status = 'completed', completed_at = now() WHERE id = $1",
        [examId],
      );
    });

    console.log('Dados de demonstração criados. Entre com:');
    console.log(`  ${HEAD_EMAIL} (sensei responsável) ou mariana@dojo.exemplo (instrutora)`);
    console.log('  senha: o valor de SEED_PASSWORD no seu .env');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

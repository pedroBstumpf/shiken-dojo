import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestContext } from './support/app.js';
import type { TestClient } from './support/client.js';
import { createTeacher } from './support/factories.js';
import { type LoggedIn, loggedIn } from './support/session.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

const TEMPLATE_ID = '01929b2c-5e00-7000-8000-000000000001';
const ALL_ITEMS = [
  ...Array.from({ length: 8 }, (_, i) => `k1-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `k2-${String(i + 1).padStart(2, '0')}`),
  'kt-01',
  'kt-02',
];

interface Exam {
  id: string;
  status: string;
  examinerId: string | null;
  examinerName: string;
  participants: { studentId: string; fullName: string; belt: string }[];
  grades: Record<string, Record<string, number>>;
}

async function createStudent(client: TestClient, fullName: string, belt = 'branca') {
  const response = await client.post('/api/v1/students', { fullName, belt });
  return response.json<{ id: string }>().id;
}

async function setup(): Promise<LoggedIn & { studentIds: string[] }> {
  const session = await loggedIn(ctx);
  const studentIds = [
    await createStudent(session.client, 'Ana Beatriz Carvalho'),
    await createStudent(session.client, 'Bruno Henrique Lima'),
  ];
  return { ...session, studentIds };
}

function examInput(examinerId: string, studentIds: string[]) {
  return {
    templateId: TEMPLATE_ID,
    date: '2026-06-20',
    location: 'Dojo central',
    examinerId,
    passingGrade: 2,
    notes: 'Exame semestral.',
    studentIds,
  };
}

function fullSheet(studentIds: string[], grade: (studentIndex: number) => number) {
  return Object.fromEntries(
    studentIds.map((id, index) => [
      id,
      Object.fromEntries(ALL_ITEMS.map((item) => [item, grade(index)])),
    ]),
  );
}

describe('provas', () => {
  it('aplica, lança notas, finaliza e resume a prova', async () => {
    const { client, teacher, studentIds } = await setup();

    const created = await client.post('/api/v1/exams', examInput(teacher.id, studentIds));
    expect(created.statusCode).toBe(201);
    const exam = created.json<Exam>();
    expect(exam).toMatchObject({
      status: 'draft',
      examinerId: teacher.id,
      examinerName: 'Sensei de Teste',
      participants: [
        { studentId: studentIds[0], fullName: 'Ana Beatriz Carvalho', belt: 'branca' },
        { studentId: studentIds[1], fullName: 'Bruno Henrique Lima', belt: 'branca' },
      ],
      grades: {},
    });

    const incomplete = await client.post(`/api/v1/exams/${exam.id}/complete`);
    expect(incomplete.statusCode).toBe(422);
    expect(incomplete.json()).toMatchObject({
      code: 'EXAM_INCOMPLETE',
      detail: 'Ainda faltam 36 notas.',
    });

    // Ana: 2,5 em tudo (aprovada); Bruno: 1,5 em tudo (reprovado).
    const sheet = fullSheet(studentIds, (index) => (index === 0 ? 2.5 : 1.5));
    const saved = await client.put(`/api/v1/exams/${exam.id}/grades`, { grades: sheet });
    expect(saved.statusCode).toBe(200);
    expect(saved.json<Exam>().grades).toEqual(sheet);

    const completed = await client.post(`/api/v1/exams/${exam.id}/complete`);
    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toMatchObject({
      status: 'completed',
      completedAt: expect.any(String),
    });

    const list = await client.get('/api/v1/exams');
    expect(list.json<{ items: unknown[] }>().items[0]).toMatchObject({
      id: exam.id,
      status: 'completed',
      participantCount: 2,
      approvedCount: 1,
      gradedCount: 36,
      totalCount: 36,
    });
  });

  it('salvar notas é idempotente e descarta alunos e técnicas de fora da prova', async () => {
    const { client, teacher, studentIds } = await setup();
    const exam = (
      await client.post('/api/v1/exams', examInput(teacher.id, studentIds))
    ).json<Exam>();

    const body = {
      grades: {
        [studentIds[0]!]: { 'k1-01': 3, 'nao-existe': 2 },
        '00000000-0000-7000-8000-000000000000': { 'k1-01': 1 },
      },
    };
    const first = await client.put(`/api/v1/exams/${exam.id}/grades`, body);
    const second = await client.put(`/api/v1/exams/${exam.id}/grades`, body);

    expect(first.json<Exam>().grades).toEqual({ [studentIds[0]!]: { 'k1-01': 3 } });
    expect(second.json<Exam>().grades).toEqual(first.json<Exam>().grades);
  });

  it('recusa notas fora da escala de 0 a 3', async () => {
    const { client, teacher, studentIds } = await setup();
    const exam = (
      await client.post('/api/v1/exams', examInput(teacher.id, studentIds))
    ).json<Exam>();

    for (const grade of [3.5, -1, 2.25]) {
      const response = await client.put(`/api/v1/exams/${exam.id}/grades`, {
        grades: { [studentIds[0]!]: { 'k1-01': grade } },
      });
      expect(response.statusCode).toBe(422);
    }
  });

  it('prova finalizada é imutável e não pode ser excluída', async () => {
    const { client, teacher, studentIds } = await setup();
    const exam = (
      await client.post('/api/v1/exams', examInput(teacher.id, studentIds))
    ).json<Exam>();
    await client.put(`/api/v1/exams/${exam.id}/grades`, { grades: fullSheet(studentIds, () => 2) });
    await client.post(`/api/v1/exams/${exam.id}/complete`);

    const edit = await client.put(`/api/v1/exams/${exam.id}/grades`, { grades: {} });
    const remove = await client.delete(`/api/v1/exams/${exam.id}`);
    const again = await client.post(`/api/v1/exams/${exam.id}/complete`);

    for (const response of [edit, remove, again]) {
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: 'EXAM_LOCKED' });
    }
  });

  it('exclui rascunhos', async () => {
    const { client, teacher, studentIds } = await setup();
    const exam = (
      await client.post('/api/v1/exams', examInput(teacher.id, studentIds))
    ).json<Exam>();

    expect((await client.delete(`/api/v1/exams/${exam.id}`)).statusCode).toBe(204);
    expect((await client.get(`/api/v1/exams/${exam.id}`)).statusCode).toBe(404);
  });

  it('guarda o retrato: mudar ou excluir aluno e professor não muda o histórico', async () => {
    const { client, teacher, studentIds } = await setup();
    const examiner = await createTeacher(ctx.pool, teacher.dojoId, {
      role: 'instructor',
      fullName: 'Hiroshi Okada',
    });
    const exam = (
      await client.post('/api/v1/exams', examInput(examiner.id, studentIds))
    ).json<Exam>();
    // Mesmo com a prova já finalizada (imutável no banco).
    await client.put(`/api/v1/exams/${exam.id}/grades`, { grades: fullSheet(studentIds, () => 2) });
    expect((await client.post(`/api/v1/exams/${exam.id}/complete`)).statusCode).toBe(200);

    await client.put(`/api/v1/students/${studentIds[0]}`, {
      fullName: 'Outro Nome',
      belt: 'preta',
    });
    await client.delete(`/api/v1/students/${studentIds[1]}`);
    expect((await client.delete(`/api/v1/teachers/${examiner.id}`)).statusCode).toBe(204);

    const after = (await client.get(`/api/v1/exams/${exam.id}`)).json<Exam>();
    expect(after.participants.map((p) => [p.fullName, p.belt])).toEqual([
      ['Ana Beatriz Carvalho', 'branca'],
      ['Bruno Henrique Lima', 'branca'],
    ]);
    expect(after).toMatchObject({ examinerId: null, examinerName: 'Hiroshi Okada' });
  });

  it('valida tabela, examinador ativo e alunos do próprio dojo', async () => {
    const { client, teacher, studentIds } = await setup();
    const inactive = await createTeacher(ctx.pool, teacher.dojoId, { active: false });
    const other = await setup();

    const response = await client.post('/api/v1/exams', {
      ...examInput(inactive.id, [...studentIds, other.studentIds[0]!]),
      templateId: '00000000-0000-7000-8000-000000000000',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      errors: {
        templateId: 'Selecione uma tabela de avaliação.',
        examinerId: 'Selecione um professor ativo como examinador.',
        studentIds: 'Selecione alunos válidos.',
      },
    });

    const invalid = await client.post('/api/v1/exams', {
      ...examInput(teacher.id, []),
      passingGrade: 4,
      date: '20/06/2026',
    });
    expect(invalid.json()).toMatchObject({
      errors: {
        passingGrade: 'A nota mínima deve estar entre 0 e 3.',
        date: 'Data inválida.',
        studentIds: 'Selecione pelo menos um aluno.',
      },
    });
  });

  it('não deixa ver nem alterar provas de outro dojo', async () => {
    const owner = await setup();
    const intruder = await loggedIn(ctx);
    const exam = (
      await owner.client.post('/api/v1/exams', examInput(owner.teacher.id, owner.studentIds))
    ).json<Exam>();

    const attempts = [
      await intruder.client.get(`/api/v1/exams/${exam.id}`),
      await intruder.client.put(`/api/v1/exams/${exam.id}/grades`, { grades: {} }),
      await intruder.client.post(`/api/v1/exams/${exam.id}/complete`),
      await intruder.client.delete(`/api/v1/exams/${exam.id}`),
    ];
    expect(attempts.map((response) => response.statusCode)).toEqual([404, 404, 404, 404]);
    expect((await intruder.client.get('/api/v1/exams')).json()).toMatchObject({ items: [] });
  });

  it('lista as mais recentes primeiro, paginando por cursor', async () => {
    const { client, teacher, studentIds } = await setup();
    for (const date of ['2026-03-01', '2026-06-20', '2026-01-15']) {
      await client.post('/api/v1/exams', { ...examInput(teacher.id, studentIds), date });
    }

    const page1 = (await client.get('/api/v1/exams?limit=2')).json<{
      items: { date: string }[];
      nextCursor: string;
    }>();
    const page2 = (await client.get(`/api/v1/exams?limit=2&cursor=${page1.nextCursor}`)).json<{
      items: { date: string }[];
      hasMore: boolean;
    }>();

    expect([...page1.items, ...page2.items].map((exam) => exam.date)).toEqual([
      '2026-06-20',
      '2026-03-01',
      '2026-01-15',
    ]);
    expect(page2.hasMore).toBe(false);
  });
});

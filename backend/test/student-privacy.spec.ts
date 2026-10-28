import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestContext } from './support/app.js';
import { loggedIn } from './support/session.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

const ITEMS = [
  ...Array.from({ length: 8 }, (_, i) => `k1-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `k2-${String(i + 1).padStart(2, '0')}`),
  'kt-01',
  'kt-02',
];

/** Aluno com uma prova finalizada (todas as notas 2,5). */
async function studentWithCompletedExam() {
  const session = await loggedIn(ctx);
  const { client, teacher } = session;
  const studentId = (
    await client.post('/api/v1/students', { fullName: 'Ana Beatriz Carvalho', belt: 'branca' })
  ).json<{ id: string }>().id;
  const examId = (
    await client.post('/api/v1/exams', {
      templateId: '01929b2c-5e00-7000-8000-000000000001',
      date: '2026-06-20',
      examinerId: teacher.id,
      passingGrade: 2,
      studentIds: [studentId],
    })
  ).json<{ id: string }>().id;
  await client.put(`/api/v1/exams/${examId}/grades`, {
    grades: { [studentId]: Object.fromEntries(ITEMS.map((item) => [item, 2.5])) },
  });
  await client.post(`/api/v1/exams/${examId}/complete`);
  return { ...session, studentId, examId };
}

describe('LGPD — dados do aluno', () => {
  it('exporta cadastro e histórico de provas em JSON', async () => {
    const { client, studentId, examId } = await studentWithCompletedExam();

    const response = await client.get(`/api/v1/students/${studentId}/export`);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment');
    const data = response.json<{ exams: { grades: unknown[] }[] }>();
    expect(data).toMatchObject({
      student: { id: studentId, fullName: 'Ana Beatriz Carvalho' },
      exams: [
        {
          examId,
          status: 'completed',
          nameAtExam: 'Ana Beatriz Carvalho',
          average: 2.5,
          result: 'approved',
        },
      ],
    });
    expect(data.exams[0]?.grades).toHaveLength(18);
    expect(data.exams[0]?.grades[0]).toEqual({
      section: 'Kihon — parte 1',
      item: 'Shoku-zuki/Kibadachi',
      grade: 2.5,
    });
  });

  it('exclusão definitiva apaga o cadastro e anonimiza até provas finalizadas', async () => {
    const { client, studentId, examId } = await studentWithCompletedExam();

    expect((await client.post(`/api/v1/students/${studentId}/erasure`)).statusCode).toBe(204);

    expect((await client.get(`/api/v1/students/${studentId}`)).statusCode).toBe(404);
    const exam = (await client.get(`/api/v1/exams/${examId}`)).json<{
      participants: { fullName: string }[];
      status: string;
    }>();
    expect(exam.participants[0]?.fullName).toBe('Aluno removido');
    expect(exam.status).toBe('completed');
  });

  it('também anonimiza aluno que já tinha sido excluído do cadastro', async () => {
    const { client, studentId, examId } = await studentWithCompletedExam();
    await client.delete(`/api/v1/students/${studentId}`);

    expect((await client.post(`/api/v1/students/${studentId}/erasure`)).statusCode).toBe(204);

    const exam = (await client.get(`/api/v1/exams/${examId}`)).json<{
      participants: { fullName: string }[];
    }>();
    expect(exam.participants[0]?.fullName).toBe('Aluno removido');
  });

  it('só o sensei responsável pede a exclusão definitiva', async () => {
    const { teacher, studentId } = await studentWithCompletedExam();
    const instructor = await loggedIn(ctx, { role: 'instructor', dojoId: teacher.dojoId });

    const response = await instructor.client.post(`/api/v1/students/${studentId}/erasure`);

    expect(response.statusCode).toBe(403);
  });

  it('não exporta nem apaga dados de outro dojo', async () => {
    const { studentId } = await studentWithCompletedExam();
    const intruder = await loggedIn(ctx);

    expect((await intruder.client.get(`/api/v1/students/${studentId}/export`)).statusCode).toBe(
      404,
    );
    expect((await intruder.client.post(`/api/v1/students/${studentId}/erasure`)).statusCode).toBe(
      404,
    );
  });
});

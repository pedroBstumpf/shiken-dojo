import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestContext } from './support/app.js';
import { TestClient } from './support/client.js';
import { loggedIn } from './support/session.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

const validStudent = {
  fullName: '  Ana   Beatriz Carvalho ',
  belt: 'branca',
  birthDate: '2014-03-12',
  enrollmentDate: '2025-02-10',
  notes: '',
};

describe('alunos', () => {
  it('cadastra, lê, atualiza e exclui um aluno', async () => {
    const { client } = await loggedIn(ctx);

    const created = await client.post('/api/v1/students', validStudent);
    expect(created.statusCode).toBe(201);
    const student = created.json<{ id: string; fullName: string }>();
    expect(student.fullName).toBe('Ana Beatriz Carvalho');
    expect(created.headers.location).toBe(`/api/v1/students/${student.id}`);

    const read = await client.get(`/api/v1/students/${student.id}`);
    expect(read.json()).toMatchObject({ id: student.id, birthDate: '2014-03-12' });

    const updated = await client.put(`/api/v1/students/${student.id}`, {
      ...validStudent,
      belt: 'amarela',
      birthDate: null,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ belt: 'amarela', birthDate: null });

    expect((await client.delete(`/api/v1/students/${student.id}`)).statusCode).toBe(204);
    expect((await client.get(`/api/v1/students/${student.id}`)).statusCode).toBe(404);
  });

  it('valida os campos e responde 422 com erros por campo', async () => {
    const { client } = await loggedIn(ctx);

    const response = await client.post('/api/v1/students', {
      fullName: 'A',
      belt: 'azul',
      birthDate: '2099-01-01',
      enrollmentDate: '2025-02-30',
      notes: 'x'.repeat(501),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: {
        fullName: 'Informe o nome completo (2 a 120 caracteres).',
        belt: 'Faixa inválida.',
        birthDate: 'A data não pode ser no futuro.',
        enrollmentDate: 'Data inválida.',
        notes: 'Máximo de 500 caracteres.',
      },
    });
  });

  it('ignora campos que o cliente não pode gravar (mass assignment)', async () => {
    const { client, teacher } = await loggedIn(ctx);
    const other = await loggedIn(ctx);

    const response = await client.post('/api/v1/students', {
      ...validStudent,
      id: '00000000-0000-7000-8000-000000000000',
      dojoId: other.teacher.dojoId,
      createdAt: '2000-01-01T00:00:00Z',
    });

    const student = response.json<{ id: string; createdAt: string }>();
    expect(student.id).not.toBe('00000000-0000-7000-8000-000000000000');
    expect(student.createdAt).not.toContain('2000');
    const { rows } = await ctx.pool.query('SELECT dojo_id FROM students WHERE id = $1', [
      student.id,
    ]);
    expect(rows[0]).toEqual({ dojo_id: teacher.dojoId });
  });

  it('exige login', async () => {
    const response = await new TestClient(ctx.app).get('/api/v1/students');
    expect(response.statusCode).toBe(401);
  });

  it('não deixa ver nem alterar alunos de outro dojo (responde 404)', async () => {
    const owner = await loggedIn(ctx);
    const intruder = await loggedIn(ctx);
    const created = await owner.client.post('/api/v1/students', validStudent);
    const id = created.json<{ id: string }>().id;

    expect((await intruder.client.get(`/api/v1/students/${id}`)).statusCode).toBe(404);
    expect((await intruder.client.put(`/api/v1/students/${id}`, validStudent)).statusCode).toBe(
      404,
    );
    expect((await intruder.client.delete(`/api/v1/students/${id}`)).statusCode).toBe(404);
    const list = await intruder.client.get('/api/v1/students');
    expect(list.json()).toMatchObject({ items: [] });
  });

  it('lista em ordem alfabética do português, paginando por cursor', async () => {
    const { client } = await loggedIn(ctx);
    for (const fullName of ['Zé Lima', 'Ângela Souza', 'Bruno Alves', 'Ana Costa', 'Érica Dias']) {
      await client.post('/api/v1/students', { ...validStudent, fullName });
    }

    const first = await client.get('/api/v1/students?limit=3');
    const page1 = first.json<{
      items: { fullName: string }[];
      nextCursor: string;
      hasMore: boolean;
    }>();
    expect(page1.items.map((s) => s.fullName)).toEqual([
      'Ana Costa',
      'Ângela Souza',
      'Bruno Alves',
    ]);
    expect(page1.hasMore).toBe(true);

    const second = await client.get(`/api/v1/students?limit=3&cursor=${page1.nextCursor}`);
    const page2 = second.json<{ items: { fullName: string }[]; hasMore: boolean }>();
    expect(page2.items.map((s) => s.fullName)).toEqual(['Érica Dias', 'Zé Lima']);
    expect(page2.hasMore).toBe(false);
  });

  it('impõe o tamanho máximo da página e recusa cursor inválido', async () => {
    const { client } = await loggedIn(ctx);

    expect((await client.get('/api/v1/students?limit=1000')).statusCode).toBe(400);
    const badCursor = await client.get('/api/v1/students?cursor=nao-e-um-cursor');
    expect(badCursor.statusCode).toBe(400);
    expect(badCursor.json()).toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('registra as alterações na auditoria', async () => {
    const { client, teacher } = await loggedIn(ctx);
    const created = await client.post('/api/v1/students', validStudent);
    const id = created.json<{ id: string }>().id;
    await client.delete(`/api/v1/students/${id}`);

    const { rows } = await ctx.pool.query<{ action: string }>(
      'SELECT action FROM audit_log WHERE target_id = $1 AND actor_id = $2 ORDER BY id',
      [id, teacher.id],
    );
    expect(rows.map((row) => row.action)).toEqual(['student.created', 'student.deleted']);
  });
});

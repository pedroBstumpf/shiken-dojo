import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, deliverEmails, type TestContext } from './support/app.js';
import { TestClient } from './support/client.js';
import { loggedIn } from './support/session.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp({ APP_BASE_URL: 'https://app.dojo.test' });
});

afterAll(async () => {
  await ctx.close();
});

function teacherInput(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Mariana Costa',
    email: `Mariana.${randomUUID()}@Dojo.Test`,
    phone: '11987654321',
    role: 'instructor',
    belt: 'preta',
    dan: 1,
    federationId: 'HKK-0042',
    active: true,
    ...overrides,
  };
}

describe('professores', () => {
  it('cadastra o professor e envia o convite para ele definir a senha', async () => {
    const { client } = await loggedIn(ctx);
    const input = teacherInput();

    const created = await client.post('/api/v1/teachers', input);
    expect(created.statusCode).toBe(201);
    const teacher = created.json<{ id: string; email: string }>();
    expect(teacher).toMatchObject({
      email: input.email.toLowerCase(),
      invitationPending: true,
    });
    expect(created.body).not.toContain('password');

    await deliverEmails(ctx);
    const invite = ctx.mailer.sent.find((message) => message.to === teacher.email);
    expect(invite?.subject).toBe('Convite para o Shiken Dojo');
    const token = /accept-invite#token=([\w-]+)/.exec(invite?.text ?? '')?.[1];
    expect(invite?.text).toContain('https://app.dojo.test/accept-invite#token=');

    const newcomer = new TestClient(ctx.app);
    const accepted = await newcomer.post('/api/v1/auth/invitations/accept', {
      token,
      password: 'senha-da-mariana-1',
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ teacher: { id: teacher.id, role: 'instructor' } });

    const after = await client.get(`/api/v1/teachers/${teacher.id}`);
    expect(after.json()).toMatchObject({ invitationPending: false });
  });

  it('recusa e-mail já cadastrado com 409 EMAIL_TAKEN', async () => {
    const { client } = await loggedIn(ctx);
    const input = teacherInput();
    await client.post('/api/v1/teachers', input);

    const duplicate = await client.post('/api/v1/teachers', {
      ...teacherInput(),
      email: input.email.toUpperCase(),
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      code: 'EMAIL_TAKEN',
      errors: { email: expect.any(String) },
    });
  });

  it('valida faixa e grau (dan) e descarta o grau de quem não é faixa preta', async () => {
    const { client } = await loggedIn(ctx);

    const missingDan = await client.post('/api/v1/teachers', teacherInput({ dan: null }));
    expect(missingDan.statusCode).toBe(422);
    expect(missingDan.json()).toMatchObject({
      errors: { dan: 'Informe o grau (dan) da faixa preta.' },
    });

    const green = await client.post('/api/v1/teachers', teacherInput({ belt: 'verde', dan: 3 }));
    expect(green.statusCode).toBe(201);
    expect(green.json()).toMatchObject({ belt: 'verde', dan: null });

    const invalid = await client.post(
      '/api/v1/teachers',
      teacherInput({ email: 'nao-e-email', phone: '123', role: 'admin' }),
    );
    expect(invalid.json()).toMatchObject({
      errors: { email: 'E-mail inválido.', phone: 'Telefone inválido.', role: 'Função inválida.' },
    });
  });

  it('só o sensei responsável cadastra, edita e exclui (403 para instrutores)', async () => {
    const head = await loggedIn(ctx);
    const instructor = await loggedIn(ctx, { role: 'instructor', dojoId: head.teacher.dojoId });

    expect((await instructor.client.get('/api/v1/teachers')).statusCode).toBe(200);
    expect((await instructor.client.post('/api/v1/teachers', teacherInput())).statusCode).toBe(403);
    expect(
      (
        await instructor.client.put(
          `/api/v1/teachers/${instructor.teacher.id}`,
          teacherInput({ role: 'head_instructor' }),
        )
      ).statusCode,
    ).toBe(403);
    expect((await instructor.client.delete(`/api/v1/teachers/${head.teacher.id}`)).statusCode).toBe(
      403,
    );
  });

  it('não deixa o dojo sem sensei responsável ativo', async () => {
    const head = await loggedIn(ctx);

    const demote = await head.client.put(
      `/api/v1/teachers/${head.teacher.id}`,
      teacherInput({ role: 'instructor', email: head.teacher.email }),
    );
    expect(demote.statusCode).toBe(409);
    expect(demote.json()).toMatchObject({ code: 'LAST_HEAD_INSTRUCTOR' });

    const deleteSelf = await head.client.delete(`/api/v1/teachers/${head.teacher.id}`);
    expect(deleteSelf.json()).toMatchObject({ code: 'CANNOT_DELETE_SELF' });
  });

  it('desativar um professor encerra as sessões dele', async () => {
    const head = await loggedIn(ctx);
    const instructor = await loggedIn(ctx, { role: 'instructor', dojoId: head.teacher.dojoId });

    const response = await head.client.put(
      `/api/v1/teachers/${instructor.teacher.id}`,
      teacherInput({ email: instructor.teacher.email, active: false }),
    );

    expect(response.statusCode).toBe(200);
    expect((await instructor.client.get('/api/v1/auth/session')).statusCode).toBe(401);
  });

  it('não expõe professores de outro dojo', async () => {
    const owner = await loggedIn(ctx);
    const intruder = await loggedIn(ctx);

    expect((await intruder.client.get(`/api/v1/teachers/${owner.teacher.id}`)).statusCode).toBe(
      404,
    );
    expect((await intruder.client.delete(`/api/v1/teachers/${owner.teacher.id}`)).statusCode).toBe(
      404,
    );
    const list = await intruder.client.get('/api/v1/teachers');
    expect(list.json<{ items: { id: string }[] }>().items.map((t) => t.id)).toEqual([
      intruder.teacher.id,
    ]);
  });

  it('reenvia o convite invalidando o link anterior', async () => {
    const { client } = await loggedIn(ctx);
    const created = await client.post('/api/v1/teachers', teacherInput());
    const id = created.json<{ id: string }>().id;

    const resend = await client.post(`/api/v1/teachers/${id}/invitation`);
    expect(resend.statusCode).toBe(202);

    const { rows } = await ctx.pool.query(
      'SELECT count(*)::int AS count FROM teacher_invitations WHERE teacher_id = $1',
      [id],
    );
    expect(rows[0]).toEqual({ count: 1 });
  });

  it('exclui um professor e mantém a exclusão na auditoria', async () => {
    const head = await loggedIn(ctx);
    const created = await head.client.post('/api/v1/teachers', teacherInput());
    const id = created.json<{ id: string }>().id;

    expect((await head.client.delete(`/api/v1/teachers/${id}`)).statusCode).toBe(204);
    expect((await head.client.get(`/api/v1/teachers/${id}`)).statusCode).toBe(404);
    const { rows } = await ctx.pool.query(
      "SELECT 1 FROM audit_log WHERE action = 'teacher.deleted' AND target_id = $1",
      [id],
    );
    expect(rows).toHaveLength(1);
  });
});

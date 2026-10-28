import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateToken, hashToken } from '../src/shared/crypto/tokens.js';
import { replaceInvitation } from '../src/modules/auth/invitations.repository.js';
import { createTestApp, type TestContext } from './support/app.js';
import { TestClient } from './support/client.js';
import { createDojo, createTeacher, TEST_PASSWORD } from './support/factories.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

async function newTeacher(overrides: Parameters<typeof createTeacher>[2] = {}) {
  const dojoId = await createDojo(ctx.pool);
  return createTeacher(ctx.pool, dojoId, overrides);
}

describe('login', () => {
  it('abre a sessão com cookie HttpOnly e devolve o professor logado', async () => {
    const teacher = await newTeacher();
    const client = new TestClient(ctx.app);
    await client.get('/api/v1/openapi.json');
    const csrfBefore = client.cookie('XSRF-TOKEN');

    const response = await client.post('/api/v1/auth/login', {
      email: teacher.email.toUpperCase(),
      password: TEST_PASSWORD,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      teacher: { id: teacher.id, email: teacher.email, role: 'head_instructor' },
      dojo: { id: teacher.dojoId },
    });
    const session = response.cookies.find((cookie) => cookie.name === 'sd_session');
    expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(client.cookie('XSRF-TOKEN')).not.toBe(csrfBefore);
  });

  it('responde igual para senha errada e e-mail inexistente', async () => {
    const teacher = await newTeacher();
    const client = new TestClient(ctx.app);

    const wrongPassword = await client.post('/api/v1/auth/login', {
      email: teacher.email,
      password: 'senha-errada-000',
    });
    const unknownEmail = await client.post('/api/v1/auth/login', {
      email: 'ninguem@dojo.test',
      password: 'senha-errada-000',
    });

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        detail: 'E-mail ou senha incorretos.',
      });
    }
  });

  it('não deixa professor inativo ou sem senha entrar', async () => {
    const inactive = await newTeacher({ active: false });
    const invited = await newTeacher({ withPassword: false });
    const client = new TestClient(ctx.app);

    for (const teacher of [inactive, invited]) {
      const response = await client.post('/api/v1/auth/login', {
        email: teacher.email,
        password: TEST_PASSWORD,
      });
      expect(response.statusCode).toBe(401);
    }
  });

  it('bloqueia a conta após 5 senhas erradas seguidas, mesmo com a senha certa', async () => {
    const teacher = await newTeacher();
    // IPs diferentes para não esbarrar no rate limit por IP deste teste.
    for (let attempt = 0; attempt < 5; attempt++) {
      await new TestClient(ctx.app).request(
        'POST',
        '/api/v1/auth/login',
        { email: teacher.email, password: 'senha-errada-000' },
        { remoteAddress: `10.0.0.${attempt + 1}` },
      );
    }

    const response = await new TestClient(ctx.app).request(
      'POST',
      '/api/v1/auth/login',
      { email: teacher.email, password: TEST_PASSWORD },
      { remoteAddress: '10.0.1.1' },
    );

    expect(response.statusCode).toBe(401);
    const { rows } = await ctx.pool.query<{ reason: string }>(
      `SELECT metadata->>'reason' AS reason FROM audit_log
        WHERE actor_id = $1 AND action = 'auth.login_failed' ORDER BY id DESC LIMIT 1`,
      [teacher.id],
    );
    expect(rows[0]?.reason).toBe('locked');
  });

  it('limita tentativas de login por IP', async () => {
    const client = new TestClient(ctx.app);
    const responses = [];
    for (let attempt = 0; attempt < 11; attempt++) {
      responses.push(
        await client.request(
          'POST',
          '/api/v1/auth/login',
          { email: 'ninguem@dojo.test', password: 'x' },
          { remoteAddress: '10.9.9.9' },
        ),
      );
    }
    expect(responses.at(-1)?.statusCode).toBe(429);
    expect(responses.at(-1)?.headers['retry-after']).toBeDefined();
  });

  it('registra sucesso e falha na auditoria sem dados pessoais', async () => {
    const teacher = await newTeacher();
    const client = new TestClient(ctx.app);
    await client.post('/api/v1/auth/login', { email: teacher.email, password: 'errada-0000' });
    await client.login(teacher.email, TEST_PASSWORD);

    const { rows } = await ctx.pool.query<{ action: string; metadata: unknown }>(
      'SELECT action, metadata FROM audit_log WHERE actor_id = $1 ORDER BY id',
      [teacher.id],
    );
    expect(rows.map((row) => row.action)).toEqual(['auth.login_failed', 'auth.login_succeeded']);
    expect(JSON.stringify(rows)).not.toContain(teacher.email);
  });
});

describe('CSRF', () => {
  it('recusa requisições que alteram estado sem o header anti-CSRF', async () => {
    const teacher = await newTeacher();
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: teacher.email, password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'CSRF_INVALID' });
  });

  it('recusa token forjado, mesmo igual no cookie e no header', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { 'XSRF-TOKEN': 'forjado.assinatura' },
      headers: { 'x-xsrf-token': 'forjado.assinatura' },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('sessão', () => {
  it('exige login nas rotas protegidas', async () => {
    const response = await new TestClient(ctx.app).get('/api/v1/auth/session');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('logout invalida a sessão no servidor', async () => {
    const teacher = await newTeacher();
    const client = new TestClient(ctx.app);
    await client.login(teacher.email, TEST_PASSWORD);
    const token = client.cookie('sd_session')!;

    expect((await client.get('/api/v1/auth/session')).statusCode).toBe(200);
    expect((await client.post('/api/v1/auth/logout')).statusCode).toBe(204);

    const replay = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      cookies: { sd_session: token },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('desativar o professor derruba as sessões dele', async () => {
    const teacher = await newTeacher();
    const client = new TestClient(ctx.app);
    await client.login(teacher.email, TEST_PASSWORD);

    await ctx.pool.query('UPDATE teachers SET active = false WHERE id = $1', [teacher.id]);

    expect((await client.get('/api/v1/auth/session')).statusCode).toBe(401);
  });

  it('lista e encerra sessões do próprio professor, mas não de outros', async () => {
    const teacher = await newTeacher();
    const phone = new TestClient(ctx.app);
    const laptop = new TestClient(ctx.app);
    await phone.login(teacher.email, TEST_PASSWORD);
    await laptop.login(teacher.email, TEST_PASSWORD);

    const list = await laptop.get('/api/v1/auth/sessions');
    const sessions = list.json<{ items: { id: string; current: boolean }[] }>().items;
    expect(sessions).toHaveLength(2);
    const phoneSession = sessions.find((session) => !session.current)!;

    const other = new TestClient(ctx.app);
    await other.login((await newTeacher()).email, TEST_PASSWORD);
    expect((await other.delete(`/api/v1/auth/sessions/${phoneSession.id}`)).statusCode).toBe(404);

    expect((await laptop.delete(`/api/v1/auth/sessions/${phoneSession.id}`)).statusCode).toBe(204);
    expect((await phone.get('/api/v1/auth/session')).statusCode).toBe(401);
    expect((await laptop.get('/api/v1/auth/session')).statusCode).toBe(200);
  });
});

describe('convite', () => {
  async function invite(teacherId: string): Promise<string> {
    const token = generateToken();
    await replaceInvitation(ctx.pool, {
      teacherId,
      tokenHash: hashToken(token),
      createdBy: null,
      validHours: 48,
    });
    return token;
  }

  it('define a senha, entra no sistema e não pode ser reutilizado', async () => {
    const teacher = await newTeacher({ withPassword: false });
    const token = await invite(teacher.id);
    const client = new TestClient(ctx.app);

    const accepted = await client.post('/api/v1/auth/invitations/accept', {
      token,
      password: 'minha-senha-nova-123',
    });
    expect(accepted.statusCode).toBe(200);
    expect((await client.get('/api/v1/auth/session')).statusCode).toBe(200);

    const reused = await new TestClient(ctx.app).post('/api/v1/auth/invitations/accept', {
      token,
      password: 'outra-senha-nova-456',
    });
    expect(reused.statusCode).toBe(422);
    expect(reused.json()).toMatchObject({ code: 'INVITATION_INVALID' });

    await new TestClient(ctx.app).login(teacher.email, 'minha-senha-nova-123');
  });

  it('só vale o convite mais recente', async () => {
    const teacher = await newTeacher({ withPassword: false });
    const oldToken = await invite(teacher.id);
    await invite(teacher.id);

    const response = await new TestClient(ctx.app).post('/api/v1/auth/invitations/accept', {
      token: oldToken,
      password: 'minha-senha-nova-123',
    });
    expect(response.statusCode).toBe(422);
  });

  it('recusa senha curta com erro no campo', async () => {
    const teacher = await newTeacher({ withPassword: false });
    const token = await invite(teacher.id);

    const response = await new TestClient(ctx.app).post('/api/v1/auth/invitations/accept', {
      token,
      password: 'curta',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: { password: expect.stringContaining('10 caracteres') },
    });
  });
});

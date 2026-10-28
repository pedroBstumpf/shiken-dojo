import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { AppError } from '../src/shared/http/app-error.js';

let app: FastifyInstance | undefined;

async function createApp(env: NodeJS.ProcessEnv = {}): Promise<FastifyInstance> {
  app = await buildApp({
    config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...env }),
    isReady: async () => true,
  });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('camada HTTP', () => {
  it('responde rotas inexistentes com Problem Details', async () => {
    const server = await createApp();
    const response = await server.inject({ method: 'GET', url: '/api/v1/nao-existe' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      traceId: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
  });

  it('envia headers de segurança e não revela a tecnologia', async () => {
    const server = await createApp();
    const response = await server.inject({ method: 'GET', url: '/health/live' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['permissions-policy']).toContain('camera=()');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('converte erros de validação do corpo em 422 com erros por campo', async () => {
    const server = await createApp();
    server.post(
      '/test',
      { schema: { body: z.object({ fullName: z.string().min(2, 'Nome curto.') }) } },
      async () => ({}),
    );

    const response = await server.inject({
      method: 'POST',
      url: '/test',
      payload: { fullName: 'A' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: { fullName: 'Nome curto.' },
    });
  });

  it('trata ID malformado na URL como recurso inexistente', async () => {
    const server = await createApp();
    server.get('/test/:id', { schema: { params: z.object({ id: z.uuid() }) } }, async () => ({}));

    const response = await server.inject({ method: 'GET', url: '/test/123' });

    expect(response.statusCode).toBe(404);
  });

  it('não vaza detalhes de erros inesperados', async () => {
    const server = await createApp();
    server.get('/boom', async () => {
      throw new Error('relation "students" does not exist');
    });

    const response = await server.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('students');
    expect(response.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('usa o código e os headers de AppError', async () => {
    const server = await createApp();
    server.get('/locked', async () => {
      throw new AppError(409, 'EXAM_LOCKED', 'Prova finalizada.');
    });

    const response = await server.inject({ method: 'GET', url: '/locked' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'EXAM_LOCKED', detail: 'Prova finalizada.' });
  });

  it('limita requisições por IP com 429 e Retry-After', async () => {
    const server = await createApp({ RATE_LIMIT_PER_MINUTE: '10' });
    server.get('/ping', async () => ({}));

    const responses = [];
    for (let i = 0; i < 11; i++) {
      responses.push(await server.inject({ method: 'GET', url: '/ping' }));
    }
    const last = responses.at(-1)!;

    expect(last.statusCode).toBe(429);
    expect(last.headers['retry-after']).toBeDefined();
    expect(last.json()).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('libera CORS apenas para as origens da allowlist', async () => {
    const server = await createApp({ CORS_ORIGINS: 'https://app.shiken-dojo.app' });

    const allowed = await server.inject({
      method: 'GET',
      url: '/health/live',
      headers: { origin: 'https://app.shiken-dojo.app' },
    });
    const denied = await server.inject({
      method: 'GET',
      url: '/health/live',
      headers: { origin: 'https://evil.example' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.shiken-dojo.app');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

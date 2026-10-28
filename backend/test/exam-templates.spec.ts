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

describe('tabelas de avaliação', () => {
  it('lista a tabela padrão da associação com seções e técnicas', async () => {
    const { client } = await loggedIn(ctx);

    const response = await client.get('/api/v1/exam-templates');

    expect(response.statusCode).toBe(200);
    const template = response
      .json<{ items: { name: string; sections: { id: string; items: unknown[] }[] }[] }>()
      .items.find((item) => item.name === 'Exame de faixa — Branca a Laranja');
    expect(template?.sections.map((section) => section.id)).toEqual(['kihon-1', 'kihon-2', 'kata']);
    expect(template?.sections[0]?.items).toHaveLength(8);
  });

  it('não mostra tabelas próprias de outro dojo', async () => {
    const owner = await loggedIn(ctx);
    const other = await loggedIn(ctx);
    await ctx.pool.query(
      `INSERT INTO exam_templates (dojo_id, name, from_belt, to_belt, sections)
       VALUES ($1, 'Tabela exclusiva', 'verde', 'roxa', '[]')`,
      [owner.teacher.dojoId],
    );

    const names = async (client: TestClient) =>
      (await client.get('/api/v1/exam-templates'))
        .json<{ items: { name: string }[] }>()
        .items.map((item) => item.name);

    expect(await names(owner.client)).toContain('Tabela exclusiva');
    expect(await names(other.client)).not.toContain('Tabela exclusiva');
  });

  it('exige login', async () => {
    expect((await new TestClient(ctx.app).get('/api/v1/exam-templates')).statusCode).toBe(401);
  });
});

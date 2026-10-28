import type { TestContext } from './app.js';
import { TestClient } from './client.js';
import { createDojo, createTeacher, TEST_PASSWORD, type TestTeacher } from './factories.js';

export interface LoggedIn {
  readonly client: TestClient;
  readonly teacher: TestTeacher;
}

/** Professor logado em um dojo novo (ou no dojo informado). */
export async function loggedIn(
  ctx: TestContext,
  options: { readonly role?: 'head_instructor' | 'instructor'; readonly dojoId?: string } = {},
): Promise<LoggedIn> {
  const dojoId = options.dojoId ?? (await createDojo(ctx.pool));
  const teacher = await createTeacher(ctx.pool, dojoId, {
    role: options.role ?? 'head_instructor',
  });
  const client = new TestClient(ctx.app);
  await client.login(teacher.email, TEST_PASSWORD);
  return { client, teacher };
}

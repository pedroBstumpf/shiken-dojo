import pg from 'pg';
import { type App, buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPool } from '../../src/infra/db/pool.js';
import { requireEnv } from './env.js';

export interface TestContext {
  readonly app: App;
  readonly pool: pg.Pool;
  close(): Promise<void>;
}

/** Sobe a API ligada ao banco de testes (papel app_runtime, como em produção). */
export async function createTestApp(env: NodeJS.ProcessEnv = {}): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: requireEnv('TEST_DATABASE_URL'),
    ...env,
  });
  const pool = createPool({ connectionString: config.databaseUrl, applicationName: 'tests' });
  const app = await buildApp({ config, pool });
  return {
    app,
    pool,
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

/** Conexão com o papel dono do schema, para preparar cenários que a API não permite. */
export function migratorClient(): pg.Client {
  return new pg.Client({ connectionString: requireEnv('TEST_MIGRATION_DATABASE_URL') });
}

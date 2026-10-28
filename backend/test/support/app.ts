import pg from 'pg';
import { type App, buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPool } from '../../src/infra/db/pool.js';
import type { MailMessage, Mailer } from '../../src/infra/mail/mailer.js';
import { requireEnv } from './env.js';

/** Mailer de teste: guarda as mensagens em memória em vez de enviar. */
export class FakeMailer implements Mailer {
  readonly simulated = true;
  readonly sent: MailMessage[] = [];
  failNext = 0;

  async send(message: MailMessage): Promise<void> {
    if (this.failNext > 0) {
      this.failNext--;
      throw Object.assign(new Error('Provedor indisponível'), { code: 'ECONNREFUSED' });
    }
    this.sent.push(message);
  }
}

export interface TestContext {
  readonly app: App;
  readonly pool: pg.Pool;
  readonly mailer: FakeMailer;
  close(): Promise<void>;
}

/** Sobe a API ligada ao banco de testes (papel app_runtime, como em produção). */
export async function createTestApp(env: NodeJS.ProcessEnv = {}): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: requireEnv('TEST_DATABASE_URL'),
    CSRF_SECRET: 'test-csrf-secret-with-at-least-32-chars',
    BREACHED_PASSWORD_CHECK: 'false',
    ...env,
  });
  const pool = createPool({ connectionString: config.databaseUrl, applicationName: 'tests' });
  const mailer = new FakeMailer();
  const app = await buildApp({ config, pool, mailer });
  return {
    app,
    pool,
    mailer,
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

import pg from 'pg';
import { runMigrations } from '../src/infra/db/migrate.js';
import { requireEnv } from './support/env.js';

/** Recria o schema do banco de testes e aplica todas as migrações, uma vez por execução. */
export default async function setup(): Promise<void> {
  const connectionString = requireEnv('TEST_MIGRATION_DATABASE_URL');
  const database = new URL(connectionString).pathname.slice(1);
  if (!database.endsWith('_test')) {
    // Proteção contra apontar os testes para um banco de verdade.
    throw new Error(`O banco de testes precisa terminar em "_test" (recebido: ${database}).`);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
  await runMigrations(connectionString);
}

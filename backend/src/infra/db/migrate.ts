import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';

/** Pasta com os arquivos `NNNN_descricao.sql`, relativa à raiz do pacote (src/ ou dist/). */
export const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../db/migrations');

const FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
// Chave arbitrária e fixa: impede duas instâncias de migrarem ao mesmo tempo.
const ADVISORY_LOCK_KEY = 4_517_202_610;

interface Migration {
  readonly version: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface MigrationResult {
  readonly applied: readonly string[];
}

async function loadMigrations(dir: string): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((file) => FILE_PATTERN.test(file)).sort();
  return Promise.all(
    files.map(async (file) => {
      const sql = await readFile(join(dir, file), 'utf8');
      // Normaliza fim de linha: o mesmo arquivo tem o mesmo checksum no Windows e no Linux.
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      return { version: file.replace(/\.sql$/, ''), sql, checksum };
    }),
  );
}

/**
 * Aplica as migrações pendentes, cada uma em sua transação. Migrações já aplicadas são
 * imutáveis: se o arquivo mudou depois de aplicado, nada roda e um erro é lançado.
 */
export async function runMigrations(
  connectionString: string,
  dir: string = MIGRATIONS_DIR,
  log: (message: string) => void = () => undefined,
): Promise<MigrationResult> {
  const client = new pg.Client({ connectionString, application_name: 'shiken-dojo-migrate' });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations',
    );
    const appliedChecksums = new Map(rows.map((row) => [row.version, row.checksum]));
    const migrations = await loadMigrations(dir);

    for (const migration of migrations) {
      const applied = appliedChecksums.get(migration.version);
      if (applied !== undefined && applied !== migration.checksum) {
        throw new Error(
          `A migração ${migration.version} foi alterada depois de aplicada. ` +
            'Crie uma nova migração em vez de editar uma existente.',
        );
      }
    }

    const pending = migrations.filter((migration) => !appliedChecksums.has(migration.version));
    for (const migration of pending) {
      log(`Aplicando ${migration.version}…`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
          migration.version,
          migration.checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falha na migração ${migration.version}`, { cause: error });
      }
    }
    return { applied: pending.map((migration) => migration.version) };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
}

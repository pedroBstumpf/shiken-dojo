import pg from 'pg';

// Datas de calendário (date) chegam como 'yyyy-MM-dd', sem conversão de fuso.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// numeric (notas, nota mínima) cabe com folga em number: escala 0–3 com uma casa.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));
// count(*) devolve bigint; os totais da aplicação são pequenos.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

/** Qualquer coisa que execute SQL: o pool ou um client dentro de uma transação. */
export type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>;

export interface PoolOptions {
  readonly connectionString: string;
  readonly applicationName: string;
  readonly max?: number;
}

export function createPool(options: PoolOptions): pg.Pool {
  return new pg.Pool({
    connectionString: options.connectionString,
    application_name: options.applicationName,
    max: options.max ?? 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    // Nenhuma consulta eterna nem transação esquecida aberta (BACKEND.md §9).
    statement_timeout: 5_000,
    idle_in_transaction_session_timeout: 10_000,
  });
}

/**
 * Executa `work` em uma transação. Faz commit se resolver e rollback se lançar.
 * Mantenha transações curtas: nada de chamadas externas aqui dentro.
 */
export async function withTransaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function isDatabaseReady(pool: pg.Pool): Promise<boolean> {
  await pool.query('SELECT 1');
  return true;
}

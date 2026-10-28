/**
 * Banco PostgreSQL local, só para desenvolvimento e testes.
 *
 * Cria um cluster próprio do projeto em `.local/pgdata` (porta 5433), usando os binários do
 * PostgreSQL instalado na máquina, sem mexer em outra instalação nem pedir a senha do `postgres`.
 * As senhas são geradas aqui e ficam em `.local/` e no `.env` — nada disso vai para o Git.
 *
 *   npm run db:setup    cria (se preciso) e inicia o cluster, os papéis e os bancos; escreve o .env
 *   npm run db:start    inicia o cluster
 *   npm run db:stop     para o cluster
 *   npm run db:status   mostra se está rodando
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const LOCAL_DIR = join(ROOT, '.local');
const DATA_DIR = join(LOCAL_DIR, 'pgdata');
const LOG_FILE = join(LOCAL_DIR, 'postgres.log');
const CREDENTIALS_FILE = join(LOCAL_DIR, 'credentials.json');
const ENV_FILE = join(ROOT, '.env');
const ENV_EXAMPLE_FILE = join(ROOT, '.env.example');

const PORT = Number(process.env['DEV_DB_PORT'] ?? 5433);
const DATABASES = ['shiken_dojo', 'shiken_dojo_test'] as const;

interface Credentials {
  readonly superuser: string;
  readonly migrator: string;
  readonly runtime: string;
}

function findPgBin(): string {
  const candidates = [
    process.env['PG_BIN'],
    ...['18', '17'].map((version) => `C:\\Program Files\\PostgreSQL\\${version}\\bin`),
    '/usr/lib/postgresql/18/bin',
    '/opt/homebrew/opt/postgresql@18/bin',
  ].filter((dir): dir is string => !!dir);
  const exe = process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl';
  const found = candidates.find((dir) => existsSync(join(dir, exe)));
  if (found) return found;
  // Último recurso: binários no PATH.
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['pg_ctl'], {
    encoding: 'utf8',
  });
  const fromPath = which.stdout.split(/\r?\n/)[0]?.trim();
  if (which.status === 0 && fromPath) return resolve(fromPath, '..');
  throw new Error(
    'PostgreSQL não encontrado. Instale o PostgreSQL 18 ou informe a pasta dos binários em PG_BIN.',
  );
}

function bin(name: string): string {
  return join(findPgBin(), process.platform === 'win32' ? `${name}.exe` : name);
}

function password(): string {
  return randomBytes(24).toString('base64url');
}

function loadCredentials(): Credentials {
  if (existsSync(CREDENTIALS_FILE)) {
    return JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8')) as Credentials;
  }
  const credentials = { superuser: password(), migrator: password(), runtime: password() };
  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  return credentials;
}

function isRunning(): boolean {
  if (!existsSync(DATA_DIR)) return false;
  return spawnSync(bin('pg_ctl'), ['status', '-D', DATA_DIR], { stdio: 'ignore' }).status === 0;
}

function initCluster(credentials: Credentials): void {
  if (existsSync(join(DATA_DIR, 'PG_VERSION'))) return;
  console.log(`Criando o cluster em ${DATA_DIR}…`);
  const pwfile = join(LOCAL_DIR, 'pwfile.tmp');
  writeFileSync(pwfile, credentials.superuser, { mode: 0o600 });
  try {
    execFileSync(
      bin('initdb'),
      [
        '-D',
        DATA_DIR,
        '-U',
        'postgres',
        '--auth=scram-sha-256',
        `--pwfile=${pwfile}`,
        '--encoding=UTF8',
        '--locale-provider=icu',
        '--icu-locale=pt-BR',
        '--no-instructions',
      ],
      { stdio: 'inherit' },
    );
  } finally {
    rmSync(pwfile, { force: true });
  }
  // Só aceita conexões da própria máquina.
  appendFileSync(
    join(DATA_DIR, 'postgresql.conf'),
    `\n# shiken-dojo (desenvolvimento)\nport = ${PORT}\nlisten_addresses = 'localhost'\n`,
  );
}

function start(): void {
  if (isRunning()) {
    console.log(`PostgreSQL já está rodando na porta ${PORT}.`);
    return;
  }
  // stdio 'ignore': o processo do servidor herdaria os pipes e prenderia este script.
  // A saída do servidor vai para o arquivo de log.
  execFileSync(bin('pg_ctl'), ['start', '-D', DATA_DIR, '-l', LOG_FILE, '-w', '-t', '30'], {
    stdio: 'ignore',
  });
  console.log(`PostgreSQL iniciado na porta ${PORT} (log em ${LOG_FILE}).`);
}

function stop(): void {
  if (!isRunning()) {
    console.log('PostgreSQL não está rodando.');
    return;
  }
  execFileSync(bin('pg_ctl'), ['stop', '-D', DATA_DIR, '-m', 'fast', '-w'], { stdio: 'inherit' });
}

async function withSuperuser(
  database: string,
  credentials: Credentials,
  run: (client: pg.Client) => Promise<void>,
): Promise<void> {
  const client = new pg.Client({
    host: 'localhost',
    port: PORT,
    user: 'postgres',
    password: credentials.superuser,
    database,
  });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

/**
 * Papéis de menor privilégio (BACKEND.md §9):
 * - app_migrator: dono do banco, altera o schema (usado só pelas migrações);
 * - app_runtime: apenas SELECT/INSERT/UPDATE/DELETE, usado pela API.
 */
async function createRolesAndDatabases(credentials: Credentials): Promise<void> {
  await withSuperuser('postgres', credentials, async (client) => {
    for (const [role, secret] of [
      ['app_migrator', credentials.migrator],
      ['app_runtime', credentials.runtime],
    ] as const) {
      const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
      const verb = exists.rowCount ? 'ALTER' : 'CREATE';
      await client.query(
        `${verb} ROLE ${client.escapeIdentifier(role)} LOGIN PASSWORD ${client.escapeLiteral(secret)}`,
      );
    }
    for (const database of DATABASES) {
      const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
      if (!exists.rowCount) {
        await client.query(
          `CREATE DATABASE ${client.escapeIdentifier(database)} OWNER app_migrator`,
        );
        console.log(`Banco ${database} criado.`);
      }
      await client.query(`REVOKE ALL ON DATABASE ${client.escapeIdentifier(database)} FROM PUBLIC`);
      await client.query(
        `GRANT CONNECT, TEMPORARY ON DATABASE ${client.escapeIdentifier(database)} TO app_runtime`,
      );
    }
  });

  for (const database of DATABASES) {
    await withSuperuser(database, credentials, async (client) => {
      // As permissões de cada tabela são concedidas pelas próprias migrações.
      await client.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
    });
  }
}

function url(user: string, secret: string, database: string): string {
  return `postgres://${user}:${encodeURIComponent(secret)}@localhost:${PORT}/${database}`;
}

/** Acrescenta ao .env as variáveis que faltam, sem sobrescrever o que já foi ajustado à mão. */
function writeEnv(credentials: Credentials): void {
  const values: Record<string, string> = {
    DATABASE_URL: url('app_runtime', credentials.runtime, 'shiken_dojo'),
    MIGRATION_DATABASE_URL: url('app_migrator', credentials.migrator, 'shiken_dojo'),
    TEST_DATABASE_URL: url('app_runtime', credentials.runtime, 'shiken_dojo_test'),
    TEST_MIGRATION_DATABASE_URL: url('app_migrator', credentials.migrator, 'shiken_dojo_test'),
  };
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, readFileSync(ENV_EXAMPLE_FILE, 'utf8'), { mode: 0o600 });
  }
  let content = readFileSync(ENV_FILE, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const filled = new RegExp(`^${key}=.+$`, 'm');
    const empty = new RegExp(`^${key}=\\s*$`, 'm');
    if (filled.test(content)) continue;
    content = empty.test(content)
      ? content.replace(empty, line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  writeFileSync(ENV_FILE, content);
  console.log('.env atualizado com as conexões do banco local.');
}

async function setup(): Promise<void> {
  const credentials = loadCredentials();
  initCluster(credentials);
  start();
  await createRolesAndDatabases(credentials);
  writeEnv(credentials);
  console.log(`\nPronto! PostgreSQL local em localhost:${PORT}. Próximo passo: npm run db:migrate`);
}

const command = process.argv[2];
const commands: Record<string, () => void | Promise<void>> = {
  setup,
  start,
  stop,
  status: () => console.log(isRunning() ? `Rodando na porta ${PORT}.` : 'Parado.'),
};

const run = command ? commands[command] : undefined;
if (!run) {
  console.error(`Uso: tsx scripts/dev-db.ts <${Object.keys(commands).join('|')}>`);
  process.exit(1);
}
Promise.resolve(run()).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

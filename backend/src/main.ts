import { buildApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import { createPool } from './infra/db/pool.js';
import { createMailer } from './infra/mail/mailer.js';
import { OutboxWorker } from './infra/mail/outbox-worker.js';
import { startMaintenance } from './infra/maintenance.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool({
    connectionString: config.databaseUrl,
    applicationName: 'shiken-dojo-api',
  });
  const mailer = createMailer(config.mail);
  const app = await buildApp({ config, pool, mailer });
  pool.on('error', (error) => app.log.error({ err: error }, 'Erro em conexão ociosa do banco'));

  const worker = new OutboxWorker(pool, mailer, app.log);
  const stopMaintenance = startMaintenance(pool, config.session.idleMinutes, app.log);
  app.addHook('onClose', async () => {
    stopMaintenance();
    await worker.stop();
    await pool.end();
  });

  // Desligamento gracioso: para de aceitar conexões, termina as requisições em andamento
  // e só então libera os recursos (BACKEND.md §15).
  let closing = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'Encerrando o servidor');
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Falha ao encerrar o servidor');
      process.exit(1);
    }
  };
  process.once('SIGTERM', (signal) => void shutdown(signal));
  process.once('SIGINT', (signal) => void shutdown(signal));

  await app.listen({ host: config.host, port: config.port });
  worker.start();
  if (config.mail.transport === 'file') {
    app.log.warn({ dir: config.mail.dir }, 'E-mails são gravados em arquivo, não enviados');
  }
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(error.message);
  } else {
    console.error('Falha ao iniciar o servidor', error);
  }
  process.exit(1);
});

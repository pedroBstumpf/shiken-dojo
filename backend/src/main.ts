import { buildApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config, isReady: async () => true });

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
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(error.message);
  } else {
    console.error('Falha ao iniciar o servidor', error);
  }
  process.exit(1);
});

import { runMigrations } from '../infra/db/migrate.js';

// Executado pelo pipeline de deploy com o papel de migração (BACKEND.md §9 e §20).
const connectionString = process.env['MIGRATION_DATABASE_URL'];
if (!connectionString) {
  console.error('Defina MIGRATION_DATABASE_URL (papel dono do schema).');
  process.exit(1);
}

runMigrations(connectionString, undefined, (message) => console.log(message))
  .then(({ applied }) => {
    console.log(
      applied.length === 0
        ? 'Banco já está atualizado.'
        : `${applied.length} migração(ões) aplicada(s).`,
    );
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    if (error instanceof Error && error.cause) console.error(error.cause);
    process.exit(1);
  });

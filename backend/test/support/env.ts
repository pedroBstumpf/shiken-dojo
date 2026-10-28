import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carrega o .env local (criado por `npm run db:setup`). No CI, as variáveis vêm do ambiente.
const envFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Defina ${name} para rodar os testes (veja "npm run db:setup").`);
  }
  return value;
}

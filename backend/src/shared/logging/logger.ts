import type { FastifyServerOptions } from 'fastify';
import type { AppConfig } from '../../config/env.js';

/**
 * Nunca registrar senhas, tokens, cookies ou o header Authorization (BACKEND.md §16).
 * Os caminhos cobrem objetos logados diretamente e um nível de aninhamento.
 */
const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-xsrf-token"]',
  'res.headers["set-cookie"]',
  'password',
  'token',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.email',
];

export function loggerOptions(config: AppConfig): NonNullable<FastifyServerOptions['logger']> {
  return {
    level: config.logLevel,
    base: { service: 'shiken-dojo-api', env: config.env },
    redact: { paths: REDACTED_PATHS, censor: '[mascarado]' },
    // Em desenvolvimento, saída legível; em produção, JSON estruturado.
    ...(config.env === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
      : {}),
  };
}

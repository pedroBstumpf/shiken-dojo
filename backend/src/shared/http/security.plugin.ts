import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { tooManyRequests } from './app-error.js';

export interface SecurityPluginOptions {
  readonly isProduction: boolean;
  /** Origens com permissão de CORS. Vazio = só a mesma origem (front servido pelo proxy). */
  readonly corsOrigins: readonly string[];
  /** Requisições por minuto, por IP, em toda a API. */
  readonly globalRateLimitPerMinute: number;
}

/** Proteções da camada HTTP (BACKEND.md §8): headers, CORS por allowlist e rate limit. */
const securityPlugin: FastifyPluginAsync<SecurityPluginOptions> = async (app, options) => {
  await app.register(helmet, {
    // A API só devolve JSON: nada pode ser carregado nem embutido a partir dela.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: options.isProduction
      ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });

  app.addHook('onSend', async (_request, reply) => {
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  });

  if (options.corsOrigins.length > 0) {
    // Nunca refletir o Origin sem validar nem usar "*" com credenciais.
    await app.register(cors, {
      origin: [...options.corsOrigins],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['content-type', 'x-xsrf-token'],
      maxAge: 600,
    });
  }

  await app.register(rateLimit, {
    global: true,
    max: options.globalRateLimitPerMinute,
    timeWindow: 60_000,
    errorResponseBuilder: (_request, context) => tooManyRequests(context.ttl / 1000),
  });
};

export default fp(securityPlugin, { name: 'security' });

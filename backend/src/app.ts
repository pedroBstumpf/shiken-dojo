import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  LogController,
  type RawReplyDefaultExpression,
  type RawRequestDefaultExpression,
  type RawServerDefault,
} from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type pg from 'pg';
import { api } from './api.js';
import type { AppConfig } from './config/env.js';
import { isDatabaseReady } from './infra/db/pool.js';
import { AuthService } from './modules/auth/auth.service.js';
import {
  createHibpChecker,
  noopBreachedPasswordChecker,
} from './modules/auth/breached-passwords.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { errorHandler, notFoundHandler } from './shared/http/error-handler.js';
import { registerOpenApi } from './shared/http/openapi.js';
import securityPlugin from './shared/http/security.plugin.js';
import { loggerOptions } from './shared/logging/logger.js';

export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface AppDependencies {
  readonly config: AppConfig;
  readonly pool: pg.Pool;
}

/** Limite de corpo JSON. Uploads (multipart) têm limites próprios por rota. */
const JSON_BODY_LIMIT_BYTES = 512 * 1024;

export async function buildApp(deps: AppDependencies): Promise<App> {
  const { config } = deps;

  const app = Fastify({
    logger: loggerOptions(config),
    // traceId de 32 caracteres hexadecimais, devolvido nos erros para correlacionar com os logs.
    genReqId: () => randomUUID().replaceAll('-', ''),
    logController: new LogController({ requestIdLogLabel: 'traceId' }),
    trustProxy: (_address, hop) => hop < config.trustProxyHops,
    bodyLimit: JSON_BODY_LIMIT_BYTES,
    requestTimeout: 30_000,
    return503OnClosing: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  await app.register(securityPlugin, {
    isProduction: config.isProduction,
    corsOrigins: config.corsOrigins,
    globalRateLimitPerMinute: config.globalRateLimitPerMinute,
  });

  await app.register(cookie);
  await registerOpenApi(app);

  const breachedPasswords = config.breachedPasswordCheck
    ? createHibpChecker(app.log)
    : noopBreachedPasswordChecker;
  const services = {
    auth: new AuthService(deps.pool, config.session, breachedPasswords),
  };

  await app.register(healthRoutes, { isReady: () => isDatabaseReady(deps.pool) });
  await app.register(api, {
    prefix: '/api/v1',
    exposeOpenApi: !config.isProduction,
    csrfSecret: config.csrfSecret,
    cookies: { secure: config.cookieSecure },
    services,
  });

  return app;
}

import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, LogController } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { AppConfig } from './config/env.js';
import { healthRoutes } from './modules/health/health.routes.js';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly isReady: () => Promise<boolean>;
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const { config } = deps;

  const app = Fastify({
    logger: { level: config.logLevel },
    // traceId de 32 caracteres hexadecimais, devolvido nos erros para correlacionar com os logs.
    genReqId: () => randomUUID().replaceAll('-', ''),
    logController: new LogController({ requestIdLogLabel: 'traceId' }),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(healthRoutes, { isReady: deps.isReady });

  return app;
}

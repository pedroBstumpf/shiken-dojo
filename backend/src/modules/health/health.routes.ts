import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const healthSchema = z.object({ status: z.enum(['ok', 'unavailable']) });

export interface HealthRoutesOptions {
  /** Verifica as dependências críticas (ex.: banco). Resolve true se estiverem prontas. */
  readonly isReady: () => Promise<boolean>;
}

/** Sem dados sensíveis na resposta: só o estado (BACKEND.md §16). */
export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (app, options) => {
  app.get(
    '/health/live',
    { schema: { response: { 200: healthSchema } }, config: { rateLimit: false } },
    async () => ({ status: 'ok' as const }),
  );

  app.get(
    '/health/ready',
    {
      schema: { response: { 200: healthSchema, 503: healthSchema } },
      config: { rateLimit: false },
    },
    async (_request, reply) => {
      const ready = await options.isReady().catch(() => false);
      return reply.code(ready ? 200 : 503).send({ status: ready ? 'ok' : 'unavailable' });
    },
  );
};

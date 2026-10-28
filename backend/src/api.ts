import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export interface ApiOptions {
  /** Publica /api/v1/openapi.json (desligado em produção para não expor o inventário da API). */
  readonly exposeOpenApi: boolean;
}

/** Tudo o que fica sob /api/v1. */
export const api: FastifyPluginAsyncZod<ApiOptions> = async (app, options) => {
  if (options.exposeOpenApi) {
    app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  }
};

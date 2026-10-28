import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AuthService } from './modules/auth/auth.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import type { CookieSettings } from './shared/http/cookies.js';
import csrfPlugin from './shared/http/csrf.plugin.js';

export interface ApiOptions {
  /** Publica /api/v1/openapi.json (desligado em produção para não expor o inventário da API). */
  readonly exposeOpenApi: boolean;
  readonly csrfSecret: string;
  readonly cookies: CookieSettings;
  readonly services: { readonly auth: AuthService };
}

/** Tudo o que fica sob /api/v1. */
export const api: FastifyPluginAsyncZod<ApiOptions> = async (app, options) => {
  const { services, cookies } = options;

  if (options.exposeOpenApi) {
    app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  }

  app.decorateRequest('auth', null);
  await app.register(csrfPlugin, { secret: options.csrfSecret, cookies });
  await app.register(authRoutes, { service: services.auth, cookies });
};

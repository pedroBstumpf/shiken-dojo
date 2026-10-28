import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  type CookieSettings,
  sessionCookieName,
  sessionCookieOptions,
} from '../../shared/http/cookies.js';
import { authOf, requestMeta, requireAuth } from './auth.guard.js';
import type { AuthService, IssuedSession } from './auth.service.js';
import { TEACHER_ROLES } from './auth.types.js';
import { passwordSchema } from './password.js';

export interface AuthRoutesOptions {
  readonly service: AuthService;
  readonly cookies: CookieSettings;
}

const sessionSchema = z.object({
  teacher: z.object({
    id: z.uuid(),
    fullName: z.string(),
    email: z.string(),
    role: z.enum(TEACHER_ROLES),
  }),
  dojo: z.object({ id: z.uuid(), name: z.string() }),
});

const activeSessionSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  userAgent: z.string(),
  current: z.boolean(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe o e-mail.').max(254),
  password: z.string().min(1, 'Informe a senha.').max(128),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(16).max(128),
  password: passwordSchema,
});

/** Endpoints sensíveis têm limite próprio, bem mais rígido que o global (BACKEND.md §8). */
const SENSITIVE_RATE_LIMIT = { rateLimit: { max: 10, timeWindow: 60_000 } };

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, options) => {
  const { service, cookies } = options;
  const cookieName = sessionCookieName(cookies);

  const startSession = (reply: FastifyReply, session: IssuedSession) => {
    reply.setCookie(
      cookieName,
      session.token,
      sessionCookieOptions(cookies, session.maxAgeSeconds),
    );
    // Novo contexto de sessão, novo token anti-CSRF.
    reply.rotateCsrfToken();
    return session.profile;
  };

  app.post(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Entrar com e-mail e senha',
        body: loginSchema,
        response: { 200: sessionSchema },
      },
      config: SENSITIVE_RATE_LIMIT,
    },
    async (request, reply) => {
      // Sessão anterior no mesmo navegador é descartada (evita session fixation).
      await service.logout(request.cookies[cookieName], requestMeta(request));
      const session = await service.login(
        request.body.email,
        request.body.password,
        requestMeta(request),
      );
      return startSession(reply, session);
    },
  );

  app.post(
    '/auth/logout',
    { schema: { tags: ['auth'], summary: 'Sair', response: { 204: z.null() } } },
    async (request, reply) => {
      await service.logout(request.cookies[cookieName], requestMeta(request));
      reply.clearCookie(cookieName, { path: '/' });
      reply.rotateCsrfToken();
      return reply.code(204).send(null);
    },
  );

  app.post(
    '/auth/invitations/accept',
    {
      schema: {
        tags: ['auth'],
        summary: 'Aceitar o convite e definir a senha',
        body: acceptInvitationSchema,
        response: { 200: sessionSchema },
      },
      config: SENSITIVE_RATE_LIMIT,
    },
    async (request, reply) => {
      const session = await service.acceptInvitation(
        request.body.token,
        request.body.password,
        requestMeta(request),
      );
      return startSession(reply, session);
    },
  );

  // Rotas da sessão atual: exigem login.
  const sessionRoutes: FastifyPluginAsyncZod = async (protectedRoutes) => {
    protectedRoutes.addHook('onRequest', requireAuth(service, cookies));

    protectedRoutes.get(
      '/auth/session',
      {
        schema: {
          tags: ['auth'],
          summary: 'Professor logado',
          response: { 200: sessionSchema },
        },
      },
      async (request) => service.getProfile(authOf(request)),
    );

    protectedRoutes.get(
      '/auth/sessions',
      {
        schema: {
          tags: ['auth'],
          summary: 'Sessões ativas do professor logado',
          response: { 200: z.object({ items: z.array(activeSessionSchema) }) },
        },
      },
      async (request) => {
        const auth = authOf(request);
        const sessions = await service.listSessions(auth);
        return {
          items: sessions.map((session) => ({
            id: session.id,
            createdAt: session.createdAt.toISOString(),
            lastSeenAt: session.lastSeenAt.toISOString(),
            userAgent: session.userAgent,
            current: session.id === auth.sessionId,
          })),
        };
      },
    );

    protectedRoutes.delete(
      '/auth/sessions/:id',
      {
        schema: {
          tags: ['auth'],
          summary: 'Encerrar uma sessão',
          params: z.object({ id: z.uuid() }),
          response: { 204: z.null() },
        },
      },
      async (request, reply) => {
        await service.revokeSession(authOf(request), request.params.id, requestMeta(request));
        return reply.code(204).send(null);
      },
    );
  };
  await app.register(sessionRoutes);
};

import type { FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { forbidden, unauthorized } from '../../shared/http/app-error.js';
import { type CookieSettings, sessionCookieName } from '../../shared/http/cookies.js';
import type { AuthService } from './auth.service.js';
import type { AuthContext, RequestMeta, TeacherRole } from './auth.types.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido por `requireAuth`; null em rotas públicas. */
    auth: AuthContext | null;
  }
}

/** Hook para rotas protegidas: sem sessão válida, responde 401. */
export function requireAuth(
  service: AuthService,
  cookies: CookieSettings,
): onRequestAsyncHookHandler {
  const cookieName = sessionCookieName(cookies);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await service.resolveSession(request.cookies[cookieName]);
    if (!auth) {
      reply.clearCookie(cookieName, { path: '/' });
      throw unauthorized();
    }
    request.auth = auth;
  };
}

/** Lê o contexto de autenticação de uma rota protegida. */
export function authOf(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

/** Autorização por papel (RBAC), verificada no servidor em todo request (BACKEND.md §5). */
export function requireRole(auth: AuthContext, role: TeacherRole): void {
  if (auth.role !== role) {
    throw forbidden(
      role === 'head_instructor'
        ? 'Apenas o sensei responsável pode realizar esta ação.'
        : 'Você não tem permissão para realizar esta ação.',
    );
  }
}

export function requestMeta(request: FastifyRequest): RequestMeta {
  return {
    ip: request.ip,
    userAgent: (request.headers['user-agent'] ?? '').slice(0, 200),
  };
}

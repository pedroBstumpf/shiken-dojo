import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { generateToken, hmac, safeEqual } from '../crypto/tokens.js';
import { AppError } from './app-error.js';
import { type CookieSettings, XSRF_COOKIE, XSRF_HEADER, xsrfCookieOptions } from './cookies.js';

export interface CsrfPluginOptions {
  readonly secret: string;
  readonly cookies: CookieSettings;
}

declare module 'fastify' {
  interface FastifyReply {
    /** Emite um novo token anti-CSRF (ex.: após o login, junto com a nova sessão). */
    rotateCsrfToken(): void;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção CSRF por "double submit" assinado (BACKEND.md §8), compatível com o HttpClient do
 * Angular: o cookie XSRF-TOKEN traz `aleatório.hmac` e toda requisição que altera estado precisa
 * repetir o mesmo valor no header X-XSRF-TOKEN. Outro site não lê o cookie, então não consegue
 * montar o header; e a assinatura impede cookies forjados (ex.: injetados por um subdomínio).
 */
const csrfPlugin: FastifyPluginAsync<CsrfPluginOptions> = async (app, options) => {
  const sign = (nonce: string): string => `${nonce}.${hmac(options.secret, nonce)}`;

  const isValid = (token: string | undefined): token is string => {
    if (!token) return false;
    const [nonce, signature, extra] = token.split('.');
    if (!nonce || !signature || extra !== undefined) return false;
    return safeEqual(signature, hmac(options.secret, nonce));
  };

  const issue = (reply: FastifyReply): void => {
    reply.setCookie(XSRF_COOKIE, sign(generateToken()), xsrfCookieOptions(options.cookies));
  };

  app.decorateReply('rotateCsrfToken', function (this: FastifyReply) {
    issue(this);
  });

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookie = request.cookies[XSRF_COOKIE];
    const cookieIsValid = isValid(cookie);

    if (SAFE_METHODS.has(request.method)) {
      if (!cookieIsValid) issue(reply);
      return;
    }

    const header = request.headers[XSRF_HEADER];
    if (!cookieIsValid || typeof header !== 'string' || !safeEqual(header, cookie)) {
      if (!cookieIsValid) issue(reply);
      throw new AppError(
        403,
        'CSRF_INVALID',
        'Não foi possível confirmar a origem da requisição. Recarregue a página e tente novamente.',
      );
    }
  });
};

export default fp(csrfPlugin, { name: 'csrf', dependencies: ['@fastify/cookie'] });

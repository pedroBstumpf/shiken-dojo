import type { CookieSerializeOptions } from '@fastify/cookie';

export interface CookieSettings {
  readonly secure: boolean;
}

/**
 * Cookie da sessão. Com HTTPS usa o prefixo __Host- (exige Secure, Path=/ e nenhum Domain),
 * que impede subdomínios de sobrescrevê-lo (BACKEND.md §4).
 */
export function sessionCookieName(settings: CookieSettings): string {
  return settings.secure ? '__Host-sd_session' : 'sd_session';
}

export function sessionCookieOptions(
  settings: CookieSettings,
  maxAgeSeconds: number,
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Nome que o HttpClient do Angular lê para enviar o header X-XSRF-TOKEN. */
export const XSRF_COOKIE = 'XSRF-TOKEN';
export const XSRF_HEADER = 'x-xsrf-token';

export function xsrfCookieOptions(settings: CookieSettings): CookieSerializeOptions {
  return {
    // O front-end precisa ler o valor para copiá-lo no header.
    httpOnly: false,
    secure: settings.secure,
    sameSite: 'strict',
    path: '/',
  };
}

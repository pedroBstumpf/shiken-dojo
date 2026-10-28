/**
 * Só aceita destinos internos depois do login: caminho absoluto do próprio app.
 * Bloqueia "//site.com", "https://…" e "/\site.com" (open redirect).
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/';
  }
  return value.startsWith('/login') || value.startsWith('/accept-invite') ? '/' : value;
}

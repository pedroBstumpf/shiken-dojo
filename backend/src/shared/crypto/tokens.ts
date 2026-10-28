import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token aleatório de 256 bits (CSPRNG), seguro para URL e cookie. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash guardado no banco no lugar do token: um vazamento do banco não entrega sessões. */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

/** Comparação em tempo constante (BACKEND.md §12). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

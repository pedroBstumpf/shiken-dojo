import { createHash } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';

export interface BreachedPasswordChecker {
  /** true se a senha aparece em vazamentos conhecidos. */
  isBreached(password: string): Promise<boolean>;
}

export const noopBreachedPasswordChecker: BreachedPasswordChecker = {
  isBreached: async () => false,
};

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 2_000;

/**
 * Consulta o Have I Been Pwned por k-anonymity: só os 5 primeiros caracteres do SHA-1 saem
 * daqui, nunca a senha nem o hash completo. Se o serviço falhar, não bloqueia o cadastro
 * (a senha já passou pela política de tamanho) — apenas registra o aviso.
 */
export function createHibpChecker(log: FastifyBaseLogger): BreachedPasswordChecker {
  return {
    async isBreached(password) {
      const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);
      try {
        const response = await fetch(`${RANGE_URL}${prefix}`, {
          headers: { 'add-padding': 'true', 'user-agent': 'shiken-dojo' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) {
          log.warn({ status: response.status }, 'Consulta de senhas vazadas indisponível');
          return false;
        }
        const body = await response.text();
        return body
          .split('\n')
          .some((line) => line.startsWith(suffix) && !line.trimEnd().endsWith(':0'));
      } catch (error) {
        log.warn({ err: error }, 'Falha ao consultar senhas vazadas');
        return false;
      }
    },
  };
}

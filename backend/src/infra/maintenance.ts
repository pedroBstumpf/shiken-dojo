import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';
import { deleteStaleInvitations } from '../modules/auth/invitations.repository.js';
import { deleteExpiredSessions } from '../modules/auth/sessions.repository.js';
import { purgeFinishedEmails } from './mail/outbox.repository.js';

const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Limpeza periódica (retenção): sessões expiradas, convites antigos e registros de e-mails
 * já enviados. As exclusões são idempotentes, então várias instâncias podem rodar juntas.
 */
export function startMaintenance(
  pool: pg.Pool,
  sessionIdleMinutes: number,
  log: FastifyBaseLogger,
): () => void {
  const run = async () => {
    const sessions = await deleteExpiredSessions(pool, sessionIdleMinutes);
    const invitations = await deleteStaleInvitations(pool);
    const emails = await purgeFinishedEmails(pool);
    log.info({ sessions, invitations, emails }, 'Limpeza periódica concluída');
  };
  const tick = () => {
    run().catch((error: unknown) => log.error({ err: error }, 'Falha na limpeza periódica'));
  };
  tick();
  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

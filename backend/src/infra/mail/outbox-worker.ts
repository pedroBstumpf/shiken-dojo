import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';
import type { Mailer } from './mailer.js';
import { claimDueEmails, finishEmail, scheduleRetry } from './outbox.repository.js';

export const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 5;
const POLL_INTERVAL_MS = 2_000;

/** 30 s, 1 min, 2 min, 4 min… com jitter de até 20%, para não sincronizar novas tentativas. */
export function retryDelaySeconds(attempt: number): number {
  const base = 30 * 2 ** (attempt - 1);
  return Math.round(base * (1 + Math.random() * 0.2));
}

/**
 * Envia os e-mails da outbox fora do ciclo da requisição (BACKEND.md §14).
 * Nenhuma chamada ao provedor acontece dentro de uma transação aberta.
 */
export class OutboxWorker {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private stopped = true;

  constructor(
    private readonly pool: pg.Pool,
    private readonly mailer: Mailer,
    private readonly log: FastifyBaseLogger,
  ) {}

  start(): void {
    this.stopped = false;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }

  /** Processa um lote. Devolve quantas mensagens foram reservadas. */
  async runOnce(): Promise<number> {
    const emails = await claimDueEmails(this.pool, BATCH_SIZE);
    for (const email of emails) {
      try {
        await this.mailer.send(email.message);
        await finishEmail(this.pool, email.id, 'sent', null);
        this.log.info({ emailId: email.id, kind: email.kind }, 'E-mail enviado');
      } catch (error) {
        const code = errorCode(error);
        if (email.attempts >= MAX_ATTEMPTS) {
          await finishEmail(this.pool, email.id, 'dead', code);
          // Dead letter: ninguém mais vai tentar; precisa de atenção humana.
          this.log.error({ emailId: email.id, kind: email.kind, code }, 'E-mail descartado');
        } else {
          await scheduleRetry(this.pool, email.id, retryDelaySeconds(email.attempts), code);
          this.log.warn({ emailId: email.id, kind: email.kind, code }, 'Falha ao enviar e-mail');
        }
      }
    }
    return emails.length;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.runOnce()
        .catch((error: unknown) => this.log.error({ err: error }, 'Erro no worker de e-mails'))
        .then((processed) => this.schedule(processed === BATCH_SIZE ? 0 : POLL_INTERVAL_MS));
    }, delayMs);
  }
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const { code, responseCode } = error as { code?: unknown; responseCode?: unknown };
    if (typeof code === 'string') return code.slice(0, 50);
    if (typeof responseCode === 'number') return `SMTP_${responseCode}`;
  }
  return 'SEND_FAILED';
}

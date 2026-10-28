import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { enqueueEmail } from '../../src/infra/mail/outbox.repository.js';
import {
  MAX_ATTEMPTS,
  OutboxWorker,
  retryDelaySeconds,
} from '../../src/infra/mail/outbox-worker.js';
import { createTestApp, silentLogger, type TestContext } from '../support/app.js';
import { createDojo } from '../support/factories.js';

let ctx: TestContext;
let worker: OutboxWorker;

beforeAll(async () => {
  ctx = await createTestApp();
  worker = new OutboxWorker(ctx.pool, ctx.mailer, silentLogger);
});

afterAll(async () => {
  await ctx.close();
});

// O banco de testes é compartilhado: esvazia a fila antes de cada cenário.
beforeEach(async () => {
  ctx.mailer.failNext = 0;
  while ((await worker.runOnce()) > 0);
});

let recipient = '';

async function enqueue(): Promise<string> {
  const dojoId = await createDojo(ctx.pool);
  recipient = `sensei-${randomUUID()}@dojo.test`;
  const { id } = await enqueueEmail(ctx.pool, {
    dojoId,
    kind: 'exam.pdf',
    requestedBy: null,
    recipientTeacherId: null,
    message: {
      to: recipient,
      subject: 'Prova',
      text: 'Segue a prova.',
      html: null,
      attachment: { filename: 'prova.pdf', content: Buffer.from('%PDF-1.7 teste') },
    },
  });
  return id;
}

async function row(id: string) {
  const { rows } = await ctx.pool.query<{
    status: string;
    attempts: number;
    recipient_email: string | null;
    attachment: Buffer | null;
    last_error: string | null;
  }>(
    'SELECT status, attempts, recipient_email, attachment, last_error FROM email_outbox WHERE id = $1',
    [id],
  );
  return rows[0]!;
}

async function makeDue(id: string): Promise<void> {
  await ctx.pool.query('UPDATE email_outbox SET next_attempt_at = now() WHERE id = $1', [id]);
}

describe('outbox de e-mails', () => {
  it('envia e apaga o conteúdo depois do envio', async () => {
    const id = await enqueue();

    await worker.runOnce();

    expect(ctx.mailer.sent.at(-1)).toMatchObject({ to: recipient, subject: 'Prova' });
    expect(await row(id)).toMatchObject({
      status: 'sent',
      attempts: 1,
      recipient_email: null,
      attachment: null,
    });
  });

  it('agenda nova tentativa quando o provedor falha', async () => {
    const id = await enqueue();
    ctx.mailer.failNext = 1;

    await worker.runOnce();

    expect(await row(id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      last_error: 'ECONNREFUSED',
    });
    // Não é reenviado antes da hora.
    await worker.runOnce();
    expect((await row(id)).attempts).toBe(1);

    await makeDue(id);
    await worker.runOnce();
    expect(await row(id)).toMatchObject({ status: 'sent', attempts: 2 });
  });

  it('desiste depois do número máximo de tentativas (dead letter)', async () => {
    const id = await enqueue();
    ctx.mailer.failNext = MAX_ATTEMPTS;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await makeDue(id);
      await worker.runOnce();
    }

    expect(await row(id)).toMatchObject({
      status: 'dead',
      attempts: MAX_ATTEMPTS,
      attachment: null,
    });
  });

  it('espaça as tentativas exponencialmente', () => {
    expect(retryDelaySeconds(1)).toBeGreaterThanOrEqual(30);
    expect(retryDelaySeconds(1)).toBeLessThanOrEqual(36);
    expect(retryDelaySeconds(4)).toBeGreaterThanOrEqual(240);
  });
});

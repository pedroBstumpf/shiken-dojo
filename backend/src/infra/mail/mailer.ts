import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import type { AppConfig } from '../../config/env.js';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string | null;
  readonly attachment: { readonly filename: string; readonly content: Buffer } | null;
}

export interface Mailer {
  /** true quando nada sai de fato da máquina (ex.: e-mails gravados em arquivo em dev). */
  readonly simulated: boolean;
  send(message: MailMessage): Promise<void>;
}

const TIMEOUT_MS = 10_000;

function toNodemailer(from: string, message: MailMessage): SendMailOptions {
  return {
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
    ...(message.attachment
      ? {
          attachments: [
            {
              filename: message.attachment.filename,
              content: message.attachment.content,
              contentType: 'application/pdf',
              contentDisposition: 'attachment' as const,
            },
          ],
        }
      : {}),
  };
}

/** Provedor transacional via SMTP (com SPF/DKIM/DMARC configurados no domínio do remetente). */
export function createSmtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = nodemailer.createTransport({
    url: smtpUrl,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  return {
    simulated: false,
    async send(message) {
      await transport.sendMail(toNodemailer(from, message));
    },
  };
}

/** Desenvolvimento: grava cada e-mail como .eml numa pasta local, para abrir no cliente de e-mail. */
export function createFileMailer(dir: string, from: string): Mailer {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  return {
    simulated: true,
    async send(message) {
      const info = await transport.sendMail(toNodemailer(from, message));
      await mkdir(dir, { recursive: true });
      const name = `${new Date().toISOString().replaceAll(':', '-')}-${info.messageId.replace(/[^a-z0-9]/gi, '')}.eml`;
      await writeFile(join(dir, name), info.message as Buffer);
    },
  };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createMailer(config: AppConfig['mail']): Mailer {
  return config.transport === 'smtp'
    ? createSmtpMailer(config.smtpUrl, config.from)
    : createFileMailer(resolve(config.dir), config.from);
}

import { escapeHtml, type MailMessage } from '../../infra/mail/mailer.js';

export const INVITATION_VALID_HOURS = 72;

export interface InvitationEmail {
  readonly to: string;
  readonly teacherName: string;
  readonly inviterName: string;
  readonly dojoName: string;
  /** Link com o token no fragmento (#): o token não vai para logs de servidor nem Referer. */
  readonly link: string;
}

export function invitationLink(appBaseUrl: string, token: string): string {
  return `${appBaseUrl}/accept-invite#token=${encodeURIComponent(token)}`;
}

export function buildInvitationEmail(invite: InvitationEmail): MailMessage {
  const text = [
    `Olá, ${invite.teacherName}!`,
    '',
    `${invite.inviterName} convidou você para o Shiken Dojo (${invite.dojoName}).`,
    'Para definir sua senha e entrar, acesse:',
    invite.link,
    '',
    `O link vale por ${INVITATION_VALID_HOURS} horas e só pode ser usado uma vez.`,
    'Se você não esperava este convite, ignore este e-mail.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR"><body style="font-family:sans-serif;line-height:1.5;color:#1d1b18">
<p>Olá, ${escapeHtml(invite.teacherName)}!</p>
<p>${escapeHtml(invite.inviterName)} convidou você para o Shiken Dojo (${escapeHtml(invite.dojoName)}).</p>
<p><a href="${escapeHtml(invite.link)}">Definir minha senha</a></p>
<p style="color:#5f5a52;font-size:14px">O link vale por ${INVITATION_VALID_HOURS} horas e só pode ser usado uma vez.
Se você não esperava este convite, ignore este e-mail.</p>
</body></html>`;

  return { to: invite.to, subject: 'Convite para o Shiken Dojo', text, html, attachment: null };
}

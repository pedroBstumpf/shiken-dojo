/**
 * Cria um dojo e o primeiro sensei responsável, que recebe um convite por e-mail para definir
 * a própria senha. Nenhuma senha passa pela linha de comando.
 *
 *   npm run bootstrap -- --dojo "Dojo Hien" --name "Hiroshi Okada" --email okada@dojo.com.br
 */
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadConfig } from '../config/env.js';
import { createPool, withTransaction } from '../infra/db/pool.js';
import { enqueueEmail } from '../infra/mail/outbox.repository.js';
import { recordAudit } from '../modules/audit/audit.repository.js';
import { replaceInvitation } from '../modules/auth/invitations.repository.js';
import {
  buildInvitationEmail,
  INVITATION_VALID_HOURS,
  invitationLink,
} from '../modules/teachers/invitation-email.js';
import { generateToken, hashToken } from '../shared/crypto/tokens.js';
import { personName } from '../shared/validation/common.js';

const argsSchema = z.object({
  dojo: z.string().trim().min(2).max(120),
  name: personName(),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  belt: z.enum(['branca', 'amarela', 'vermelha', 'laranja', 'verde', 'roxa', 'marrom', 'preta']),
  dan: z.coerce.number().int().min(1).max(10).optional(),
});

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      dojo: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      belt: { type: 'string', default: 'preta' },
      dan: { type: 'string', default: '1' },
    },
  });
  const args = argsSchema.parse(values);
  const config = loadConfig();
  const pool = createPool({
    connectionString: config.databaseUrl,
    applicationName: 'shiken-dojo-bootstrap',
    max: 1,
  });

  try {
    const token = generateToken();
    await withTransaction(pool, async (client) => {
      const taken = await client.query('SELECT 1 FROM teachers WHERE email = $1', [args.email]);
      if (taken.rowCount) throw new Error('Já existe um professor com este e-mail.');

      const dojo = await client.query<{ id: string }>(
        'INSERT INTO dojos (name) VALUES ($1) RETURNING id',
        [args.dojo],
      );
      const dojoId = dojo.rows[0]!.id;
      const teacher = await client.query<{ id: string }>(
        `INSERT INTO teachers (dojo_id, full_name, email, role, belt, dan)
         VALUES ($1, $2, $3, 'head_instructor', $4, $5)
         RETURNING id`,
        [dojoId, args.name, args.email, args.belt, args.belt === 'preta' ? (args.dan ?? 1) : null],
      );
      const teacherId = teacher.rows[0]!.id;

      await replaceInvitation(client, {
        teacherId,
        tokenHash: hashToken(token),
        createdBy: null,
        validHours: INVITATION_VALID_HOURS,
      });
      await enqueueEmail(client, {
        dojoId,
        kind: 'teacher.invitation',
        requestedBy: null,
        recipientTeacherId: teacherId,
        message: buildInvitationEmail({
          to: args.email,
          teacherName: args.name,
          inviterName: 'A equipe do Shiken Dojo',
          dojoName: args.dojo,
          link: invitationLink(config.appBaseUrl, token),
        }),
      });
      await recordAudit(client, {
        dojoId,
        actorId: null,
        action: 'dojo.bootstrapped',
        targetId: teacherId,
      });
    });

    console.log(`Dojo "${args.dojo}" criado. O convite foi enfileirado para ${args.email}.`);
    if (config.mail.transport === 'file') {
      // Sem servidor de e-mail (desenvolvimento): mostra o link para não travar o primeiro acesso.
      console.log(`Link do convite: ${invitationLink(config.appBaseUrl, token)}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof z.ZodError) {
    console.error(`Argumentos inválidos:
${z.prettifyError(error)}`);
    console.error(
      'Uso: npm run bootstrap -- --dojo "Nome do dojo" --name "Nome completo" --email email@dominio',
    );
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
});

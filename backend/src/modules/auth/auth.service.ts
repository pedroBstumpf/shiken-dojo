import type pg from 'pg';
import { withTransaction } from '../../infra/db/pool.js';
import { generateToken, hashToken } from '../../shared/crypto/tokens.js';
import { AppError, notFound, unauthorized, validationFailed } from '../../shared/http/app-error.js';
import { recordAudit } from '../audit/audit.repository.js';
import type { AuthContext, RequestMeta } from './auth.types.js';
import type { BreachedPasswordChecker } from './breached-passwords.js';
import {
  findCredentialsByEmail,
  findSessionProfile,
  registerFailedLogin,
  registerSuccessfulLogin,
  type SessionProfile,
  setPassword,
} from './credentials.repository.js';
import { consumeInvitation } from './invitations.repository.js';
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from './password.js';
import {
  deleteAllTeacherSessions,
  deleteSessionByTokenHash,
  deleteTeacherSession,
  findValidSession,
  insertSession,
  listTeacherSessions,
  type SessionListRow,
  touchSession,
} from './sessions.repository.js';

export interface SessionSettings {
  /** Encerra a sessão após este tempo sem uso. */
  readonly idleMinutes: number;
  /** Encerra a sessão após este tempo, mesmo em uso. */
  readonly absoluteHours: number;
}

export interface IssuedSession {
  /** Valor do cookie. Só existe aqui; no banco fica apenas o hash. */
  readonly token: string;
  readonly maxAgeSeconds: number;
  readonly profile: SessionProfile;
}

const INVALID_CREDENTIALS = new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
/** Evita uma escrita no banco a cada requisição: last_seen_at é atualizado no máximo por minuto. */
const TOUCH_INTERVAL_MS = 60_000;

export class AuthService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly settings: SessionSettings,
    private readonly breachedPasswords: BreachedPasswordChecker,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<IssuedSession> {
    const credentials = await findCredentialsByEmail(this.pool, email);
    const isLocked = !!credentials?.lockedUntil && credentials.lockedUntil > new Date();

    if (!credentials?.passwordHash || !credentials.active || isLocked) {
      // Mesma resposta e tempo parecido em todos os casos: não revela se a conta existe.
      await burnPasswordCheck(password);
      await recordAudit(this.pool, {
        dojoId: credentials?.dojoId ?? null,
        actorId: credentials?.id ?? null,
        action: 'auth.login_failed',
        metadata: { reason: !credentials ? 'unknown_email' : isLocked ? 'locked' : 'no_access' },
        ip: meta.ip,
      });
      throw INVALID_CREDENTIALS;
    }

    if (!(await verifyPassword(credentials.passwordHash, password))) {
      await registerFailedLogin(this.pool, credentials.id);
      await recordAudit(this.pool, {
        dojoId: credentials.dojoId,
        actorId: credentials.id,
        action: 'auth.login_failed',
        metadata: { reason: 'wrong_password' },
        ip: meta.ip,
      });
      throw INVALID_CREDENTIALS;
    }

    // Parâmetros do Argon2 mudaram desde o último login: aproveita a senha em mãos.
    const rehash = needsRehash(credentials.passwordHash) ? await hashPassword(password) : null;
    return withTransaction(this.pool, async (client) => {
      await registerSuccessfulLogin(client, credentials.id, rehash);
      const session = await this.createSession(client, credentials.id, credentials.dojoId, meta);
      await recordAudit(client, {
        dojoId: credentials.dojoId,
        actorId: credentials.id,
        action: 'auth.login_succeeded',
        ip: meta.ip,
      });
      return session;
    });
  }

  /** Logout invalida a sessão no servidor, não só o cookie (BACKEND.md §4). */
  async logout(token: string | undefined, meta: RequestMeta): Promise<void> {
    if (!token) return;
    const session = await deleteSessionByTokenHash(this.pool, hashToken(token));
    if (session) {
      await recordAudit(this.pool, {
        dojoId: session.dojoId,
        actorId: session.teacherId,
        action: 'auth.logout',
        ip: meta.ip,
      });
    }
  }

  async resolveSession(token: string | undefined): Promise<AuthContext | null> {
    if (!token) return null;
    const session = await findValidSession(this.pool, hashToken(token), this.settings.idleMinutes);
    if (!session) return null;
    if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await touchSession(this.pool, session.id);
    }
    return {
      sessionId: session.id,
      teacherId: session.teacherId,
      dojoId: session.dojoId,
      role: session.role,
    };
  }

  async getProfile(auth: AuthContext): Promise<SessionProfile> {
    const profile = await findSessionProfile(this.pool, auth.teacherId);
    if (!profile) throw unauthorized();
    return profile;
  }

  listSessions(auth: AuthContext): Promise<SessionListRow[]> {
    return listTeacherSessions(this.pool, auth.teacherId, this.settings.idleMinutes);
  }

  /** Encerra uma sessão do próprio professor (ex.: celular perdido). */
  async revokeSession(auth: AuthContext, sessionId: string, meta: RequestMeta): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      if (!(await deleteTeacherSession(client, auth.teacherId, sessionId))) {
        throw notFound('SESSION_NOT_FOUND', 'Sessão não encontrada.');
      }
      await recordAudit(client, {
        dojoId: auth.dojoId,
        actorId: auth.teacherId,
        action: 'auth.session_revoked',
        targetId: sessionId,
        ip: meta.ip,
      });
    });
  }

  /** O professor define a própria senha pelo link do convite e já entra no sistema. */
  async acceptInvitation(
    token: string,
    password: string,
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    if (await this.breachedPasswords.isBreached(password)) {
      throw validationFailed({
        password: 'Esta senha já apareceu em vazamentos de dados. Escolha outra.',
      });
    }
    const passwordHash = await hashPassword(password);

    return withTransaction(this.pool, async (client) => {
      const invitation = await consumeInvitation(client, hashToken(token));
      if (!invitation) {
        throw new AppError(
          422,
          'INVITATION_INVALID',
          'Este convite é inválido ou expirou. Peça um novo convite ao sensei responsável.',
        );
      }
      await setPassword(client, invitation.teacherId, passwordHash);
      // Senha nova: sessões antigas (se houver) deixam de valer.
      await deleteAllTeacherSessions(client, invitation.teacherId);
      const session = await this.createSession(
        client,
        invitation.teacherId,
        invitation.dojoId,
        meta,
      );
      await recordAudit(client, {
        dojoId: invitation.dojoId,
        actorId: invitation.teacherId,
        action: 'auth.invitation_accepted',
        ip: meta.ip,
      });
      return session;
    });
  }

  private async createSession(
    client: pg.PoolClient,
    teacherId: string,
    dojoId: string,
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const token = generateToken();
    await insertSession(client, {
      tokenHash: hashToken(token),
      teacherId,
      dojoId,
      absoluteHours: this.settings.absoluteHours,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    const profile = await findSessionProfile(client, teacherId);
    if (!profile) throw unauthorized();
    return { token, maxAgeSeconds: this.settings.absoluteHours * 3600, profile };
  }
}

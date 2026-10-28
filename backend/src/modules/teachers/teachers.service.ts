import type pg from 'pg';
import { z } from 'zod';
import { withTransaction } from '../../infra/db/pool.js';
import { enqueueEmail } from '../../infra/mail/outbox.repository.js';
import { generateToken, hashToken } from '../../shared/crypto/tokens.js';
import { conflict, notFound } from '../../shared/http/app-error.js';
import { decodeCursor, type Page, type PageQuery, toPage } from '../../shared/http/pagination.js';
import { recordAudit } from '../audit/audit.repository.js';
import { requireRole } from '../auth/auth.guard.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import { replaceInvitation } from '../auth/invitations.repository.js';
import { deleteAllTeacherSessions } from '../auth/sessions.repository.js';
import {
  buildInvitationEmail,
  INVITATION_VALID_HOURS,
  invitationLink,
} from './invitation-email.js';
import {
  deleteTeacher,
  findInvitationContext,
  findTeacher,
  insertTeacher,
  isEmailTaken,
  listTeachers,
  lockActiveHeadInstructors,
  type TeacherRow,
  updateTeacher,
} from './teachers.repository.js';
import type { TeacherDto, TeacherWrite } from './teachers.schemas.js';

const cursorSchema = z.object({ fullName: z.string(), id: z.uuid() });

const TEACHER_NOT_FOUND = () => notFound('TEACHER_NOT_FOUND', 'Professor não encontrado.');
const EMAIL_TAKEN = () =>
  conflict('EMAIL_TAKEN', 'Já existe um professor com este e-mail.', {
    email: 'Este e-mail já está cadastrado para outro professor.',
  });

function toTeacherDto(row: TeacherRow): TeacherDto {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    role: row.role,
    belt: row.belt,
    dan: row.dan,
    federationId: row.federationId,
    active: row.active,
    invitationPending: row.invitationPending,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}

export class TeachersService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly appBaseUrl: string,
  ) {}

  /** Qualquer professor do dojo vê a lista (é dela que saem os examinadores). */
  async list(auth: AuthContext, query: PageQuery): Promise<Page<TeacherDto>> {
    const after = decodeCursor(cursorSchema, query.cursor);
    const rows = await listTeachers(this.pool, auth.dojoId, query.limit + 1, after);
    return toPage(rows, query.limit, toTeacherDto, (row) => ({
      fullName: row.fullName,
      id: row.id,
    }));
  }

  async get(auth: AuthContext, id: string): Promise<TeacherDto> {
    const row = await findTeacher(this.pool, auth.dojoId, id);
    if (!row) throw TEACHER_NOT_FOUND();
    return toTeacherDto(row);
  }

  /** Cadastra e envia o convite por e-mail para o professor definir a própria senha. */
  async create(auth: AuthContext, input: TeacherWrite, meta: RequestMeta): Promise<TeacherDto> {
    requireRole(auth, 'head_instructor');
    try {
      return await withTransaction(this.pool, async (client) => {
        if (await isEmailTaken(client, input.email, null)) throw EMAIL_TAKEN();
        const row = await insertTeacher(client, auth.dojoId, input);
        await this.audit(client, auth, 'teacher.created', row.id, meta);
        if (row.active) await this.sendInvitation(client, auth, row, meta);
        return toTeacherDto(row);
      });
    } catch (error) {
      // Dois cadastros simultâneos com o mesmo e-mail: a constraint do banco decide.
      if (isUniqueViolation(error)) throw EMAIL_TAKEN();
      throw error;
    }
  }

  async update(
    auth: AuthContext,
    id: string,
    input: TeacherWrite,
    meta: RequestMeta,
  ): Promise<TeacherDto> {
    requireRole(auth, 'head_instructor');
    try {
      return await withTransaction(this.pool, async (client) => {
        const heads = await lockActiveHeadInstructors(client, auth.dojoId);
        const current = await findTeacher(client, auth.dojoId, id, { forUpdate: true });
        if (!current) throw TEACHER_NOT_FOUND();
        if (await isEmailTaken(client, input.email, id)) throw EMAIL_TAKEN();

        const staysHead = input.role === 'head_instructor' && input.active;
        if (heads.includes(id) && !staysHead && heads.length === 1) {
          throw conflict(
            'LAST_HEAD_INSTRUCTOR',
            'O dojo precisa de pelo menos um sensei responsável ativo.',
          );
        }

        const row = await updateTeacher(client, auth.dojoId, id, input);
        if (!row) throw TEACHER_NOT_FOUND();
        // Desativado ou com e-mail de acesso trocado: as sessões abertas deixam de valer.
        if (!row.active || current.email !== row.email) {
          await deleteAllTeacherSessions(client, id);
        }
        await this.audit(client, auth, 'teacher.updated', id, meta, {
          activeChanged: current.active !== row.active,
          roleChanged: current.role !== row.role,
          emailChanged: current.email !== row.email,
        });
        return toTeacherDto(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw EMAIL_TAKEN();
      throw error;
    }
  }

  /**
   * Exclui o cadastro. As provas mantêm o nome do examinador (retrato); prefira desativar.
   */
  async remove(auth: AuthContext, id: string, meta: RequestMeta): Promise<void> {
    requireRole(auth, 'head_instructor');
    if (id === auth.teacherId) {
      throw conflict('CANNOT_DELETE_SELF', 'Você não pode excluir o seu próprio cadastro.');
    }
    await withTransaction(this.pool, async (client) => {
      const heads = await lockActiveHeadInstructors(client, auth.dojoId);
      if (heads.includes(id) && heads.length === 1) {
        throw conflict(
          'LAST_HEAD_INSTRUCTOR',
          'O dojo precisa de pelo menos um sensei responsável ativo.',
        );
      }
      if (!(await deleteTeacher(client, auth.dojoId, id))) throw TEACHER_NOT_FOUND();
      await this.audit(client, auth, 'teacher.deleted', id, meta);
    });
  }

  /** Reenvia o convite (o link anterior deixa de valer). */
  async resendInvitation(auth: AuthContext, id: string, meta: RequestMeta): Promise<void> {
    requireRole(auth, 'head_instructor');
    await withTransaction(this.pool, async (client) => {
      const teacher = await findTeacher(client, auth.dojoId, id);
      if (!teacher) throw TEACHER_NOT_FOUND();
      if (!teacher.active) {
        throw conflict('TEACHER_INACTIVE', 'Reative o professor antes de enviar o convite.');
      }
      await this.sendInvitation(client, auth, teacher, meta);
    });
  }

  private async sendInvitation(
    client: pg.PoolClient,
    auth: AuthContext,
    teacher: TeacherRow,
    meta: RequestMeta,
  ): Promise<void> {
    const token = generateToken();
    await replaceInvitation(client, {
      teacherId: teacher.id,
      tokenHash: hashToken(token),
      createdBy: auth.teacherId,
      validHours: INVITATION_VALID_HOURS,
    });
    const context = await findInvitationContext(client, auth.dojoId, auth.teacherId);
    await enqueueEmail(client, {
      dojoId: auth.dojoId,
      kind: 'teacher.invitation',
      requestedBy: auth.teacherId,
      recipientTeacherId: teacher.id,
      message: buildInvitationEmail({
        to: teacher.email,
        teacherName: teacher.fullName,
        inviterName: context.inviterName,
        dojoName: context.dojoName,
        link: invitationLink(this.appBaseUrl, token),
      }),
    });
    await this.audit(client, auth, 'teacher.invited', teacher.id, meta);
  }

  private audit(
    client: pg.PoolClient,
    auth: AuthContext,
    action: string,
    targetId: string,
    meta: RequestMeta,
    metadata?: Record<string, boolean>,
  ): Promise<void> {
    return recordAudit(client, {
      dojoId: auth.dojoId,
      actorId: auth.teacherId,
      action,
      targetId,
      ip: meta.ip,
      ...(metadata ? { metadata } : {}),
    });
  }
}

import type pg from 'pg';
import { z } from 'zod';
import { withTransaction } from '../../infra/db/pool.js';
import { notFound } from '../../shared/http/app-error.js';
import { decodeCursor, type Page, type PageQuery, toPage } from '../../shared/http/pagination.js';
import { recordAudit } from '../audit/audit.repository.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import {
  deleteStudent,
  findStudent,
  insertStudent,
  listStudents,
  type StudentRow,
  updateStudent,
} from './students.repository.js';
import type { StudentDto, StudentWrite } from './students.schemas.js';

const cursorSchema = z.object({ fullName: z.string(), id: z.uuid() });

const STUDENT_NOT_FOUND = () => notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado.');

export function toStudentDto(row: StudentRow): StudentDto {
  return {
    id: row.id,
    fullName: row.fullName,
    belt: row.belt,
    birthDate: row.birthDate,
    enrollmentDate: row.enrollmentDate,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class StudentsService {
  constructor(private readonly pool: pg.Pool) {}

  async list(auth: AuthContext, query: PageQuery): Promise<Page<StudentDto>> {
    const after = decodeCursor(cursorSchema, query.cursor);
    const rows = await listStudents(this.pool, auth.dojoId, query.limit + 1, after);
    return toPage(rows, query.limit, toStudentDto, (row) => ({
      fullName: row.fullName,
      id: row.id,
    }));
  }

  async get(auth: AuthContext, id: string): Promise<StudentDto> {
    const row = await findStudent(this.pool, auth.dojoId, id);
    if (!row) throw STUDENT_NOT_FOUND();
    return toStudentDto(row);
  }

  async create(auth: AuthContext, input: StudentWrite, meta: RequestMeta): Promise<StudentDto> {
    return withTransaction(this.pool, async (client) => {
      const row = await insertStudent(client, auth.dojoId, input);
      await this.audit(client, auth, 'student.created', row.id, meta);
      return toStudentDto(row);
    });
  }

  async update(
    auth: AuthContext,
    id: string,
    input: StudentWrite,
    meta: RequestMeta,
  ): Promise<StudentDto> {
    return withTransaction(this.pool, async (client) => {
      const row = await updateStudent(client, auth.dojoId, id, input);
      if (!row) throw STUDENT_NOT_FOUND();
      await this.audit(client, auth, 'student.updated', row.id, meta);
      return toStudentDto(row);
    });
  }

  /** Remove o cadastro. As provas guardam um retrato do aluno: o histórico continua íntegro. */
  async remove(auth: AuthContext, id: string, meta: RequestMeta): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      if (!(await deleteStudent(client, auth.dojoId, id))) throw STUDENT_NOT_FOUND();
      await this.audit(client, auth, 'student.deleted', id, meta);
    });
  }

  private audit(
    client: pg.PoolClient,
    auth: AuthContext,
    action: string,
    targetId: string,
    meta: RequestMeta,
  ): Promise<void> {
    return recordAudit(client, {
      dojoId: auth.dojoId,
      actorId: auth.teacherId,
      action,
      targetId,
      ip: meta.ip,
    });
  }
}

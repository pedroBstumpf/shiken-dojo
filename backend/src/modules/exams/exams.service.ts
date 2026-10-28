import type pg from 'pg';
import { z } from 'zod';
import { withTransaction } from '../../infra/db/pool.js';
import { AppError, conflict, notFound, validationFailed } from '../../shared/http/app-error.js';
import { decodeCursor, type Page, type PageQuery, toPage } from '../../shared/http/pagination.js';
import { recordAudit } from '../audit/audit.repository.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import { findStudentsByIds } from '../students/students.repository.js';
import { findTeacher } from '../teachers/teachers.repository.js';
import { type GradeSheet, gradingProgress, studentResult } from './domain/scoring.js';
import { findVisibleTemplate } from './exam-templates.js';
import {
  bumpExamVersion,
  deleteExam,
  type ExamRow,
  findExam,
  findGradeSheets,
  findParticipants,
  insertExam,
  insertParticipants,
  listExams,
  markExamCompleted,
  type ParticipantRow,
  replaceGrades,
} from './exams.repository.js';
import type { ExamCreate, ExamDto, ExamSummaryDto } from './exams.schemas.js';

const cursorSchema = z.object({ date: z.string(), createdAt: z.string(), id: z.uuid() });

export const EXAM_NOT_FOUND = () => notFound('EXAM_NOT_FOUND', 'Prova não encontrada.');
const EXAM_LOCKED = (detail = 'Esta prova já foi finalizada e não pode ser alterada.') =>
  conflict('EXAM_LOCKED', detail);

function toExamDto(exam: ExamRow, participants: ParticipantRow[], grades: GradeSheet): ExamDto {
  return {
    id: exam.id,
    status: exam.status,
    templateId: exam.templateId,
    templateName: exam.templateName,
    fromBelt: exam.fromBelt,
    toBelt: exam.toBelt,
    sections: exam.sections,
    date: exam.date,
    location: exam.location,
    examinerId: exam.examinerId,
    examinerName: exam.examinerName,
    passingGrade: exam.passingGrade,
    notes: exam.notes,
    participants: participants.map((p) => ({
      studentId: p.studentId,
      fullName: p.fullName,
      belt: p.belt,
    })),
    grades,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
    completedAt: exam.completedAt?.toISOString() ?? null,
  };
}

/** Resumo calculado com as mesmas regras do front-end (domain/scoring.ts). */
function toSummary(
  exam: ExamRow,
  participants: readonly ParticipantRow[],
  sheet: GradeSheet,
): ExamSummaryDto {
  const studentIds = participants.map((p) => p.studentId);
  const progress = gradingProgress(exam.sections, studentIds, sheet);
  const approvedCount = studentIds.filter(
    (id) => studentResult(exam.sections, sheet[id], exam.passingGrade).status === 'approved',
  ).length;
  return {
    id: exam.id,
    status: exam.status,
    templateName: exam.templateName,
    fromBelt: exam.fromBelt,
    toBelt: exam.toBelt,
    date: exam.date,
    location: exam.location,
    examinerName: exam.examinerName,
    participantCount: participants.length,
    approvedCount,
    gradedCount: progress.graded,
    totalCount: progress.total,
  };
}

export class ExamsService {
  constructor(private readonly pool: pg.Pool) {}

  async list(auth: AuthContext, query: PageQuery): Promise<Page<ExamSummaryDto>> {
    const after = decodeCursor(cursorSchema, query.cursor);
    const rows = await listExams(this.pool, auth.dojoId, query.limit + 1, after);
    const pageRows = rows.slice(0, query.limit);
    const ids = pageRows.map((row) => row.id);
    // Participantes e notas da página inteira em duas consultas (sem N+1).
    const [participants, sheets] = await Promise.all([
      findParticipants(this.pool, ids),
      findGradeSheets(this.pool, ids),
    ]);
    return toPage(
      rows,
      query.limit,
      (exam) =>
        toSummary(
          exam,
          participants.filter((p) => p.examId === exam.id),
          sheets.get(exam.id) ?? {},
        ),
      (exam) => ({ date: exam.date, createdAt: exam.createdAtKey, id: exam.id }),
    );
  }

  async get(
    auth: AuthContext,
    id: string,
    db: pg.Pool | pg.PoolClient = this.pool,
  ): Promise<ExamDto> {
    const exam = await findExam(db, auth.dojoId, id);
    if (!exam) throw EXAM_NOT_FOUND();
    return this.load(db, exam);
  }

  /**
   * Cria a prova como rascunho, gravando um retrato do template, do examinador e dos alunos:
   * o histórico não muda se esses cadastros mudarem depois.
   */
  async create(auth: AuthContext, input: ExamCreate, meta: RequestMeta): Promise<ExamDto> {
    return withTransaction(this.pool, async (client) => {
      const [template, examiner, students] = await Promise.all([
        findVisibleTemplate(client, auth.dojoId, input.templateId),
        findTeacher(client, auth.dojoId, input.examinerId),
        findStudentsByIds(client, auth.dojoId, input.studentIds),
      ]);
      const errors: Record<string, string> = {};
      if (!template) errors['templateId'] = 'Selecione uma tabela de avaliação.';
      if (!examiner?.active) errors['examinerId'] = 'Selecione um professor ativo como examinador.';
      if (students.length !== input.studentIds.length)
        errors['studentIds'] = 'Selecione alunos válidos.';
      if (!template || !examiner || Object.keys(errors).length > 0) throw validationFailed(errors);

      const byId = new Map(students.map((student) => [student.id, student]));
      const examId = await insertExam(client, {
        dojoId: auth.dojoId,
        templateId: template.id,
        templateName: template.name,
        fromBelt: template.fromBelt,
        toBelt: template.toBelt,
        sections: template.sections,
        date: input.date,
        location: input.location,
        examinerId: examiner.id,
        examinerName: examiner.fullName,
        passingGrade: input.passingGrade,
        notes: input.notes,
      });
      await insertParticipants(
        client,
        examId,
        input.studentIds.map((id) => {
          const student = byId.get(id)!;
          return { studentId: student.id, fullName: student.fullName, belt: student.belt };
        }),
      );
      await this.audit(client, auth, 'exam.created', examId, meta);
      return this.get(auth, examId, client);
    });
  }

  /**
   * Substitui a planilha inteira (o front salva a cada pausa na digitação). Alunos e técnicas
   * que não são desta prova são descartados.
   */
  async saveGrades(auth: AuthContext, id: string, sheet: GradeSheet): Promise<ExamDto> {
    return withTransaction(this.pool, async (client) => {
      const exam = await findExam(client, auth.dojoId, id, { forUpdate: true });
      if (!exam) throw EXAM_NOT_FOUND();
      if (exam.status !== 'draft') throw EXAM_LOCKED();

      const participants = await findParticipants(client, [id]);
      const itemIds = exam.sections.flatMap((section) => section.items.map((item) => item.id));
      const grades = participants.flatMap(({ studentId, position }) =>
        itemIds
          .filter((itemId) => sheet[studentId]?.[itemId] !== undefined)
          .map((itemId) => ({ position, itemId, grade: sheet[studentId]![itemId]! })),
      );
      await replaceGrades(client, id, grades);
      await bumpExamVersion(client, id);
      return this.get(auth, id, client);
    });
  }

  /** Finaliza a prova. A partir daqui ela é imutável (garantido também no banco). */
  async complete(auth: AuthContext, id: string, meta: RequestMeta): Promise<ExamDto> {
    return withTransaction(this.pool, async (client) => {
      const exam = await findExam(client, auth.dojoId, id, { forUpdate: true });
      if (!exam) throw EXAM_NOT_FOUND();
      if (exam.status !== 'draft') throw EXAM_LOCKED('Esta prova já foi finalizada.');

      const { participants, grades } = await this.loadRows(client, id);
      const progress = gradingProgress(
        exam.sections,
        participants.map((p) => p.studentId),
        grades,
      );
      if (progress.graded < progress.total) {
        throw new AppError(
          422,
          'EXAM_INCOMPLETE',
          `Ainda faltam ${progress.total - progress.graded} notas.`,
        );
      }
      await markExamCompleted(client, id);
      await this.audit(client, auth, 'exam.completed', id, meta);
      return this.get(auth, id, client);
    });
  }

  /** Só rascunhos podem ser excluídos: provas finalizadas fazem parte do histórico. */
  async remove(auth: AuthContext, id: string, meta: RequestMeta): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      const exam = await findExam(client, auth.dojoId, id, { forUpdate: true });
      if (!exam) throw EXAM_NOT_FOUND();
      if (exam.status !== 'draft') {
        throw EXAM_LOCKED('Provas finalizadas fazem parte do histórico e não podem ser excluídas.');
      }
      await deleteExam(client, id);
      await this.audit(client, auth, 'exam.deleted', id, meta);
    });
  }

  private async load(db: pg.Pool | pg.PoolClient, exam: ExamRow): Promise<ExamDto> {
    const { participants, grades } = await this.loadRows(db, exam.id);
    return toExamDto(exam, participants, grades);
  }

  private async loadRows(db: pg.Pool | pg.PoolClient, examId: string) {
    const [participants, sheets] = await Promise.all([
      findParticipants(db, [examId]),
      findGradeSheets(db, [examId]),
    ]);
    return { participants, grades: sheets.get(examId) ?? {} };
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

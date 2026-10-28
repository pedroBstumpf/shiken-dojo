import type pg from 'pg';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Queryable } from '../../infra/db/pool.js';
import { withTransaction } from '../../infra/db/pool.js';
import { idParamsSchema } from '../../shared/validation/common.js';
import { recordAudit } from '../audit/audit.repository.js';
import { authOf, requestMeta, requireRole } from '../auth/auth.guard.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import { studentResult } from '../exams/domain/scoring.js';
import type { ExamSection } from '../exams/exam-templates.js';
import { notFound } from '../../shared/http/app-error.js';
import { deleteStudent, findStudent } from './students.repository.js';
import { studentSchema } from './students.schemas.js';
import { toStudentDto } from './students.service.js';

// Direitos do titular (LGPD, docs/INTEGRACAO-BACKEND.md §5): exportação dos dados de um aluno
// e exclusão definitiva com anonimização do histórico de provas.

export const ANONYMIZED_NAME = 'Aluno removido';

const exportSchema = z.object({
  exportedAt: z.iso.datetime(),
  student: studentSchema.nullable(),
  exams: z.array(
    z.object({
      examId: z.uuid(),
      date: z.string(),
      templateName: z.string(),
      examinerName: z.string(),
      status: z.enum(['draft', 'completed']),
      nameAtExam: z.string(),
      beltAtExam: z.string(),
      average: z.number().nullable(),
      result: z.enum(['pending', 'approved', 'failed']),
      grades: z.array(z.object({ section: z.string(), item: z.string(), grade: z.number() })),
    }),
  ),
});
type StudentExport = z.infer<typeof exportSchema>;

interface ParticipationRow {
  readonly examId: string;
  readonly date: string;
  readonly templateName: string;
  readonly examinerName: string;
  readonly status: 'draft' | 'completed';
  readonly passingGrade: number;
  readonly sections: ExamSection[];
  readonly fullName: string;
  readonly belt: string;
  readonly grades: Record<string, number> | null;
}

async function findParticipations(
  db: Queryable,
  dojoId: string,
  studentId: string,
): Promise<ParticipationRow[]> {
  const { rows } = await db.query<ParticipationRow>(
    `SELECT e.id AS "examId", e.exam_date AS "date", e.template_name AS "templateName",
            e.examiner_name AS "examinerName", e.status, e.passing_grade AS "passingGrade",
            e.sections, p.full_name AS "fullName", p.belt,
            (SELECT jsonb_object_agg(g.item_id, g.grade)
               FROM exam_grades g
              WHERE g.exam_id = p.exam_id AND g.position = p.position) AS grades
       FROM exam_participants p
       JOIN exams e ON e.id = p.exam_id
      WHERE p.student_id = $1 AND e.dojo_id = $2
      ORDER BY e.exam_date, e.created_at`,
    [studentId, dojoId],
  );
  return rows;
}

export class StudentPrivacyService {
  constructor(private readonly pool: pg.Pool) {}

  /** Cadastro + histórico de provas em formato estruturado (portabilidade). */
  async export(auth: AuthContext, studentId: string, meta: RequestMeta): Promise<StudentExport> {
    const [student, participations] = await Promise.all([
      findStudent(this.pool, auth.dojoId, studentId),
      findParticipations(this.pool, auth.dojoId, studentId),
    ]);
    if (!student && participations.length === 0) {
      throw notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado.');
    }
    await recordAudit(this.pool, {
      dojoId: auth.dojoId,
      actorId: auth.teacherId,
      action: 'student.exported',
      targetId: studentId,
      ip: meta.ip,
    });
    return {
      exportedAt: new Date().toISOString(),
      student: student ? toStudentDto(student) : null,
      exams: participations.map((row) => {
        const grades = row.grades ?? {};
        const result = studentResult(row.sections, grades, row.passingGrade);
        return {
          examId: row.examId,
          date: row.date,
          templateName: row.templateName,
          examinerName: row.examinerName,
          status: row.status,
          nameAtExam: row.fullName,
          beltAtExam: row.belt,
          average: result.average,
          result: result.status,
          grades: row.sections.flatMap((section) =>
            section.items
              .filter((item) => grades[item.id] !== undefined)
              .map((item) => ({
                section: section.title,
                item: item.label,
                grade: grades[item.id]!,
              })),
          ),
        };
      }),
    };
  }

  /**
   * Pedido de exclusão (direito do titular): apaga o cadastro e anonimiza o nome nas provas,
   * inclusive nas finalizadas. Notas ficam, sem identificar a pessoa. Só o sensei responsável.
   * Backups e logs seguem a política de retenção (docs/INTEGRACAO-BACKEND.md §5).
   */
  async erase(auth: AuthContext, studentId: string, meta: RequestMeta): Promise<void> {
    requireRole(auth, 'head_instructor');
    await withTransaction(this.pool, async (client) => {
      const deleted = await deleteStudent(client, auth.dojoId, studentId);
      const anonymized = await client.query(
        `UPDATE exam_participants p
            SET full_name = $3
           FROM exams e
          WHERE e.id = p.exam_id AND e.dojo_id = $2 AND p.student_id = $1`,
        [studentId, auth.dojoId, ANONYMIZED_NAME],
      );
      if (!deleted && !anonymized.rowCount) {
        throw notFound('STUDENT_NOT_FOUND', 'Aluno não encontrado.');
      }
      await recordAudit(client, {
        dojoId: auth.dojoId,
        actorId: auth.teacherId,
        action: 'student.erased',
        targetId: studentId,
        metadata: { examsAnonymized: anonymized.rowCount ?? 0 },
        ip: meta.ip,
      });
    });
  }
}

export const studentPrivacyRoutes: FastifyPluginAsyncZod<{
  service: StudentPrivacyService;
}> = async (app, options) => {
  app.get(
    '/students/:id/export',
    {
      schema: {
        tags: ['students'],
        summary: 'Exportar os dados do aluno (LGPD: acesso e portabilidade)',
        params: idParamsSchema,
        response: { 200: exportSchema },
      },
    },
    async (request, reply) => {
      const data = await options.service.export(
        authOf(request),
        request.params.id,
        requestMeta(request),
      );
      return reply
        .header('content-disposition', `attachment; filename="aluno-${request.params.id}.json"`)
        .header('cache-control', 'no-store')
        .send(data);
    },
  );

  app.post(
    '/students/:id/erasure',
    {
      schema: {
        tags: ['students'],
        summary: 'Excluir o aluno e anonimizar o histórico (LGPD; só sensei responsável)',
        params: idParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await options.service.erase(authOf(request), request.params.id, requestMeta(request));
      return reply.code(204).send(null);
    },
  );
};

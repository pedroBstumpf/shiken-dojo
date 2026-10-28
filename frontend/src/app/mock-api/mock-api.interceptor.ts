import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '@shared/data-access/api-base-url.token';
import {
  ExamCreateDto,
  ExamDto,
  ExamGradesDto,
  ExamSummaryDto,
} from '@shared/data-access/exams/exam.dto';
import { gradingProgress, studentResult } from '@shared/data-access/exams/exam-scoring';
import { StudentDto, StudentWriteDto } from '@shared/data-access/students/student.dto';
import { isBelt } from '@shared/models/belt.model';
import { ProblemDetailsDto } from '@shared/models/api-error.model';
import { Paginated } from '@shared/models/paginated.model';
import { isValidGrade } from '@shared/utils/grade.utils';
import { mergeMap, Observable, of, throwError, timer } from 'rxjs';
import { MockDbService } from './mock-db.service';

/**
 * Simula o back-end enquanto ele não existe, respeitando o contrato descrito em
 * docs/INTEGRACAO-BACKEND.md (rotas, status HTTP e erros no formato Problem Details).
 * Deve ser o ÚLTIMO interceptor, para que os demais (ex.: errorInterceptor) atuem
 * sobre as respostas como fariam com a API real.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);
  if (!req.url.startsWith(baseUrl)) {
    return next(req);
  }
  const db = inject(MockDbService);
  const path = req.url.slice(baseUrl.length).split('?')[0] ?? '';
  return respond(req, route(db, req, path));
};

interface MockResult {
  readonly status: number;
  readonly body: unknown;
}

const LATENCY_MS = 250;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function respond(req: HttpRequest<unknown>, result: MockResult): Observable<HttpResponse<unknown>> {
  return timer(LATENCY_MS + Math.random() * 200).pipe(
    mergeMap(() =>
      result.status >= 400
        ? throwError(
            () =>
              new HttpErrorResponse({ status: result.status, error: result.body, url: req.url }),
          )
        : of(new HttpResponse({ status: result.status, body: result.body, url: req.url })),
    ),
  );
}

function route(db: MockDbService, req: HttpRequest<unknown>, path: string): MockResult {
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [resource, id, action] = segments;
  const method = req.method;

  if (resource === 'students') {
    if (!id && method === 'GET') return ok(page(sortByName(db.read().students)));
    if (!id && method === 'POST') return createStudent(db, req.body);
    if (id && !action && method === 'GET') return findStudent(db, id);
    if (id && !action && method === 'PUT') return updateStudent(db, id, req.body);
    if (id && !action && method === 'DELETE') return deleteStudent(db, id);
  }

  if (resource === 'exam-templates' && !id && method === 'GET') {
    return ok(page(db.read().templates));
  }

  if (resource === 'exams') {
    if (!id && method === 'GET') return ok(page(listExamSummaries(db)));
    if (!id && method === 'POST') return createExam(db, req.body);
    if (id && !action && method === 'GET') return findExam(db, id);
    if (id && !action && method === 'DELETE') return deleteExam(db, id);
    if (id && action === 'grades' && method === 'PUT') return saveGrades(db, id, req.body);
    if (id && action === 'complete' && method === 'POST') return completeExam(db, id);
  }

  return problem(404, 'NOT_FOUND', 'Recurso não encontrado.');
}

// ---------- Alunos ----------

function validateStudent(body: unknown): StudentWriteDto | MockResult {
  const input = (body ?? {}) as Partial<StudentWriteDto>;
  const errors: Record<string, string> = {};
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';

  if (fullName.length < 2 || fullName.length > 120)
    errors['fullName'] = 'Informe o nome completo (2 a 120 caracteres).';
  if (!isBelt(input.belt)) errors['belt'] = 'Faixa inválida.';
  if (input.birthDate != null && !DATE_PATTERN.test(input.birthDate))
    errors['birthDate'] = 'Data inválida.';
  if (input.enrollmentDate != null && !DATE_PATTERN.test(input.enrollmentDate))
    errors['enrollmentDate'] = 'Data inválida.';
  if (typeof input.notes === 'string' && input.notes.length > 500)
    errors['notes'] = 'Máximo de 500 caracteres.';

  if (Object.keys(errors).length > 0 || !isBelt(input.belt)) {
    return problem(422, 'VALIDATION_FAILED', 'Alguns campos precisam ser corrigidos.', errors);
  }
  // Allowlist: somente campos conhecidos são gravados.
  return {
    fullName,
    belt: input.belt,
    birthDate: input.birthDate ?? null,
    enrollmentDate: input.enrollmentDate ?? null,
    notes: typeof input.notes === 'string' ? input.notes.trim() : '',
  };
}

function createStudent(db: MockDbService, body: unknown): MockResult {
  const input = validateStudent(body);
  if (isMockResult(input)) return input;
  const now = new Date().toISOString();
  const student: StudentDto = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  db.write((state) => state.students.push(student));
  return { status: 201, body: student };
}

function findStudent(db: MockDbService, id: string): MockResult {
  const student = db.read().students.find((s) => s.id === id);
  return student ? ok(student) : problem(404, 'STUDENT_NOT_FOUND', 'Aluno não encontrado.');
}

function updateStudent(db: MockDbService, id: string, body: unknown): MockResult {
  const index = db.read().students.findIndex((s) => s.id === id);
  if (index < 0) return problem(404, 'STUDENT_NOT_FOUND', 'Aluno não encontrado.');
  const input = validateStudent(body);
  if (isMockResult(input)) return input;
  const updated: StudentDto = {
    ...db.read().students[index]!,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  db.write((state) => (state.students[index] = updated));
  return ok(updated);
}

function deleteStudent(db: MockDbService, id: string): MockResult {
  if (!db.read().students.some((s) => s.id === id)) {
    return problem(404, 'STUDENT_NOT_FOUND', 'Aluno não encontrado.');
  }
  // Provas guardam um retrato do aluno, então o histórico continua íntegro.
  db.write((state) => (state.students = state.students.filter((s) => s.id !== id)));
  return { status: 204, body: null };
}

// ---------- Provas ----------

function toSummary(exam: ExamDto): ExamSummaryDto {
  const studentIds = exam.participants.map((p) => p.studentId);
  const progress = gradingProgress(exam.sections, studentIds, exam.grades);
  const approvedCount = studentIds.filter(
    (id) => studentResult(exam.sections, exam.grades[id], exam.passingGrade).status === 'approved',
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
    participantCount: exam.participants.length,
    approvedCount,
    gradedCount: progress.graded,
    totalCount: progress.total,
  };
}

function listExamSummaries(db: MockDbService): ExamSummaryDto[] {
  return [...db.read().exams]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map(toSummary);
}

function findExam(db: MockDbService, id: string): MockResult {
  const exam = db.read().exams.find((e) => e.id === id);
  return exam ? ok(exam) : problem(404, 'EXAM_NOT_FOUND', 'Prova não encontrada.');
}

function createExam(db: MockDbService, body: unknown): MockResult {
  const input = (body ?? {}) as Partial<ExamCreateDto>;
  const state = db.read();
  const template = state.templates.find((t) => t.id === input.templateId);
  const studentIds = Array.isArray(input.studentIds) ? input.studentIds : [];
  const participants = studentIds
    .map((id) => state.students.find((s) => s.id === id))
    .filter((s): s is StudentDto => s !== undefined)
    .map((s) => ({ studentId: s.id, fullName: s.fullName, belt: s.belt }));

  const errors: Record<string, string> = {};
  if (!template) errors['templateId'] = 'Selecione uma tabela de avaliação.';
  if (typeof input.date !== 'string' || !DATE_PATTERN.test(input.date))
    errors['date'] = 'Data inválida.';
  if (typeof input.examinerName !== 'string' || input.examinerName.trim().length < 2)
    errors['examinerName'] = 'Informe o examinador.';
  if (!isValidGrade(input.passingGrade))
    errors['passingGrade'] = 'A nota mínima deve estar entre 0 e 10.';
  if (participants.length === 0 || participants.length !== studentIds.length)
    errors['studentIds'] = 'Selecione alunos válidos.';
  if (!template || Object.keys(errors).length > 0) {
    return problem(422, 'VALIDATION_FAILED', 'Alguns campos precisam ser corrigidos.', errors);
  }

  const now = new Date().toISOString();
  const exam: ExamDto = {
    id: crypto.randomUUID(),
    status: 'draft',
    templateId: template.id,
    templateName: template.name,
    fromBelt: template.fromBelt,
    toBelt: template.toBelt,
    sections: template.sections,
    date: input.date!,
    location: (input.location ?? '').trim(),
    examinerName: input.examinerName!.trim(),
    passingGrade: input.passingGrade!,
    notes: (input.notes ?? '').trim(),
    participants,
    grades: {},
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  db.write((s) => s.exams.push(exam));
  return { status: 201, body: exam };
}

function saveGrades(db: MockDbService, id: string, body: unknown): MockResult {
  const index = db.read().exams.findIndex((e) => e.id === id);
  const exam = db.read().exams[index];
  if (!exam) return problem(404, 'EXAM_NOT_FOUND', 'Prova não encontrada.');
  if (exam.status !== 'draft')
    return problem(409, 'EXAM_LOCKED', 'Esta prova já foi finalizada e não pode ser alterada.');

  const incoming = ((body ?? {}) as Partial<ExamGradesDto>).grades ?? {};
  const itemIds = exam.sections.flatMap((section) => section.items.map((item) => item.id));
  // Mantém apenas alunos e técnicas desta prova, com notas válidas.
  const grades = Object.fromEntries(
    exam.participants.map(({ studentId }) => [
      studentId,
      Object.fromEntries(
        itemIds
          .map((itemId) => [itemId, incoming[studentId]?.[itemId]] as const)
          .filter((entry): entry is readonly [string, number] => isValidGrade(entry[1])),
      ),
    ]),
  );

  const updated: ExamDto = { ...exam, grades, updatedAt: new Date().toISOString() };
  db.write((state) => (state.exams[index] = updated));
  return ok(updated);
}

function completeExam(db: MockDbService, id: string): MockResult {
  const index = db.read().exams.findIndex((e) => e.id === id);
  const exam = db.read().exams[index];
  if (!exam) return problem(404, 'EXAM_NOT_FOUND', 'Prova não encontrada.');
  if (exam.status !== 'draft') return problem(409, 'EXAM_LOCKED', 'Esta prova já foi finalizada.');

  const progress = gradingProgress(
    exam.sections,
    exam.participants.map((p) => p.studentId),
    exam.grades,
  );
  if (progress.graded < progress.total) {
    return problem(
      422,
      'EXAM_INCOMPLETE',
      `Ainda faltam ${progress.total - progress.graded} notas.`,
    );
  }

  const now = new Date().toISOString();
  const updated: ExamDto = { ...exam, status: 'completed', completedAt: now, updatedAt: now };
  db.write((state) => (state.exams[index] = updated));
  return ok(updated);
}

function deleteExam(db: MockDbService, id: string): MockResult {
  const exam = db.read().exams.find((e) => e.id === id);
  if (!exam) return problem(404, 'EXAM_NOT_FOUND', 'Prova não encontrada.');
  if (exam.status !== 'draft')
    return problem(
      409,
      'EXAM_LOCKED',
      'Provas finalizadas fazem parte do histórico e não podem ser excluídas.',
    );
  db.write((state) => (state.exams = state.exams.filter((e) => e.id !== id)));
  return { status: 204, body: null };
}

// ---------- Utilitários ----------

function ok(body: unknown): MockResult {
  return { status: 200, body };
}

function page<T>(items: readonly T[]): Paginated<T> {
  return { items, nextCursor: null, hasMore: false };
}

function sortByName(students: readonly StudentDto[]): StudentDto[] {
  return [...students].sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
}

function problem(
  status: number,
  code: string,
  detail: string,
  errors?: Record<string, string>,
): MockResult {
  const body: ProblemDetailsDto = {
    type: `https://shiken-dojo.app/errors/${code.toLowerCase()}`,
    title: detail,
    status,
    code,
    detail,
    traceId: crypto.randomUUID().replaceAll('-', ''),
    ...(errors ? { errors } : {}),
  };
  return { status, body };
}

function isMockResult(value: unknown): value is MockResult {
  return typeof value === 'object' && value !== null && 'status' in value && 'body' in value;
}

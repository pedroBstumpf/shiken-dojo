import { z } from 'zod';
import { beltSchema, calendarDateSchema, text } from '../../shared/validation/common.js';
import { GRADE_MAX, GRADE_MIN, isValidGrade } from './domain/scoring.js';
import { examSectionSchema } from './exam-templates.js';

export const EXAM_STATUSES = ['draft', 'completed'] as const;

const MAX_STUDENTS_PER_EXAM = 100;
const MAX_ITEMS_PER_EXAM = 200;

export const examCreateSchema = z.object({
  templateId: z.uuid({ error: 'Selecione uma tabela de avaliação.' }),
  date: calendarDateSchema,
  location: text(120).default(''),
  examinerId: z.uuid({ error: 'Selecione um professor ativo como examinador.' }),
  passingGrade: z
    .number({ error: `A nota mínima deve estar entre ${GRADE_MIN} e ${GRADE_MAX}.` })
    .refine(isValidGrade, `A nota mínima deve estar entre ${GRADE_MIN} e ${GRADE_MAX}.`),
  notes: text(500).default(''),
  studentIds: z
    .array(z.uuid(), { error: 'Selecione alunos válidos.' })
    .min(1, 'Selecione pelo menos um aluno.')
    .max(MAX_STUDENTS_PER_EXAM, `No máximo ${MAX_STUDENTS_PER_EXAM} alunos por prova.`)
    .refine((ids) => new Set(ids).size === ids.length, 'Há alunos repetidos.'),
});
export type ExamCreate = z.infer<typeof examCreateSchema>;

const gradeSchema = z
  .number({ error: 'As notas vão de 0 a 3, com uma casa decimal.' })
  .refine(isValidGrade, 'As notas vão de 0 a 3, com uma casa decimal.');

/** Planilha inteira: studentId → itemId → nota. Limites explícitos contra payloads abusivos. */
export const gradeSheetSchema = z
  .record(
    z.string().max(64),
    z
      .record(z.string().max(64), gradeSchema)
      .refine((grades) => Object.keys(grades).length <= MAX_ITEMS_PER_EXAM, 'Notas demais.'),
  )
  .refine((sheet) => Object.keys(sheet).length <= MAX_STUDENTS_PER_EXAM, 'Alunos demais.');

export const examGradesSchema = z.object({ grades: gradeSheetSchema });

export const examParticipantSchema = z.object({
  studentId: z.uuid(),
  fullName: z.string(),
  belt: beltSchema,
});

export const examSchema = z.object({
  id: z.uuid(),
  status: z.enum(EXAM_STATUSES),
  templateId: z.uuid(),
  templateName: z.string(),
  fromBelt: beltSchema,
  toBelt: beltSchema,
  sections: z.array(examSectionSchema),
  date: z.string(),
  location: z.string(),
  /** null se o professor examinador foi excluído (examinerName continua no histórico). */
  examinerId: z.uuid().nullable(),
  examinerName: z.string(),
  passingGrade: z.number(),
  notes: z.string(),
  participants: z.array(examParticipantSchema),
  grades: z.record(z.string(), z.record(z.string(), z.number())),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type ExamDto = z.infer<typeof examSchema>;

export const examSummarySchema = z.object({
  id: z.uuid(),
  status: z.enum(EXAM_STATUSES),
  templateName: z.string(),
  fromBelt: beltSchema,
  toBelt: beltSchema,
  date: z.string(),
  location: z.string(),
  examinerName: z.string(),
  participantCount: z.number().int(),
  approvedCount: z.number().int(),
  gradedCount: z.number().int(),
  totalCount: z.number().int(),
});
export type ExamSummaryDto = z.infer<typeof examSummarySchema>;

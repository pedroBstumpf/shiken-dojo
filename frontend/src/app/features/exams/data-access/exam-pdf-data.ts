import { ImportedExam } from '@shared/data-access/exams/exam-api.service';
import {
  Exam,
  ExamParticipant,
  ExamPdfVariant,
  ExamSection,
} from '@shared/data-access/exams/exam.model';
import { Belt, BELTS } from '@shared/models/belt.model';
import { fromIsoDate, toIsoDate } from '@shared/utils/date.utils';
import { GRADE_MAX, GRADE_MIN } from '@shared/utils/grade.utils';

// Os dados da prova vão dentro do próprio PDF, nos metadados. Assim a importação não depende de
// "ler" a tabela desenhada, e um arquivo de outra origem simplesmente não tem esse conteúdo.

const MARKER = 'shiken-dojo-exam:v1';
const PATTERN = new RegExp(`${MARKER}:([A-Za-z0-9+/=]+):end`);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PARTICIPANTS = 500;
const MAX_TEXT = 500;

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** O PDF é a versão que o professor escolheu: em branco não leva notas nem a finalização. */
export function encodeExamPdfData(
  exam: Exam,
  variant: ExamPdfVariant,
  exportId: string,
): { readonly encoded: string; readonly metadata: string } {
  const filled = variant === 'filled';
  const json = JSON.stringify({
    exportId,
    variant,
    id: exam.id,
    status: filled ? exam.status : 'draft',
    templateId: exam.templateId,
    templateName: exam.templateName,
    fromBelt: exam.fromBelt,
    toBelt: exam.toBelt,
    sections: exam.sections,
    date: toIsoDate(exam.date),
    location: exam.location,
    examinerId: exam.examinerId,
    examinerName: exam.examinerName,
    passingGrade: exam.passingGrade,
    notes: exam.notes,
    participants: exam.participants,
    grades: filled ? exam.grades : {},
    completedAt: filled && exam.completedAt ? exam.completedAt.toISOString() : null,
  });
  const encoded = toBase64(new TextEncoder().encode(json));
  return { encoded, metadata: `${MARKER}:${encoded}:end` };
}

/** Devolve o conteúdo embutido, ou null se o arquivo não for um PDF gerado pelo app. */
export function extractExamPdfData(bytes: Uint8Array): string | null {
  if (new TextDecoder('latin1').decode(bytes.subarray(0, 5)) !== '%PDF-') return null;
  return PATTERN.exec(new TextDecoder('latin1').decode(bytes))?.[1] ?? null;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Valida tudo: mesmo vindo de um PDF conhecido, o conteúdo é tratado como entrada externa. */
export function decodeExamPdfData(encoded: string): ImportedExam | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(fromBase64(encoded))) as Record<
      string,
      unknown
    >;
    return parseExam(value);
  } catch {
    return null;
  }
}

function parseExam(value: Record<string, unknown>): ImportedExam | null {
  const { id, status, date, passingGrade, completedAt, examinerId } = value;
  const sections = parseSections(value['sections']);
  const participants = parseParticipants(value['participants']);
  const fromBelt = parseBelt(value['fromBelt']);
  const toBelt = parseBelt(value['toBelt']);
  const texts = ['templateId', 'templateName', 'location', 'examinerName', 'notes'].map(
    (key) => value[key],
  );

  if (
    !isId(id) ||
    !(examinerId === null || typeof examinerId === 'string') ||
    !sections ||
    !participants ||
    !fromBelt ||
    !toBelt ||
    !texts.every(isText) ||
    typeof date !== 'string' ||
    !DATE_PATTERN.test(date) ||
    typeof passingGrade !== 'number' ||
    !(passingGrade >= GRADE_MIN && passingGrade <= GRADE_MAX)
  ) {
    return null;
  }

  const grades = parseGrades(value['grades'], sections, participants);
  if (!grades) return null;

  const finished = status === 'completed';
  if (!finished && status !== 'draft') return null;
  const finishedAt = typeof completedAt === 'string' ? new Date(completedAt) : null;
  if (finished && (!finishedAt || Number.isNaN(finishedAt.getTime()))) return null;
  if (!finished && completedAt !== null) return null;

  return {
    id,
    status,
    templateId: value['templateId'] as string,
    templateName: value['templateName'] as string,
    fromBelt,
    toBelt,
    sections,
    date: fromIsoDate(date),
    location: value['location'] as string,
    examinerId,
    examinerName: value['examinerName'] as string,
    passingGrade,
    notes: value['notes'] as string,
    participants,
    grades,
    completedAt: finished ? finishedAt : null,
  };
}

function parseSections(value: unknown): ExamSection[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const sections: ExamSection[] = [];
  for (const raw of value as Record<string, unknown>[]) {
    if (!isId(raw?.['id']) || !isText(raw['title']) || !isText(raw['kanji'])) return null;
    if (typeof raw['showTotal'] !== 'boolean' || !Array.isArray(raw['items'])) return null;
    const items = raw['items'] as Record<string, unknown>[];
    if (!items.every((item) => isId(item?.['id']) && isText(item['label']))) return null;
    sections.push({
      id: raw['id'],
      title: raw['title'],
      kanji: raw['kanji'],
      showTotal: raw['showTotal'],
      items: items.map((item) => ({ id: item['id'] as string, label: item['label'] as string })),
    });
  }
  return sections;
}

function parseParticipants(value: unknown): ExamParticipant[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PARTICIPANTS) return null;
  const participants: ExamParticipant[] = [];
  for (const raw of value as Record<string, unknown>[]) {
    const belt = parseBelt(raw?.['belt']);
    if (!isId(raw?.['studentId']) || !isText(raw['fullName']) || !belt) return null;
    participants.push({ studentId: raw['studentId'], fullName: raw['fullName'], belt });
  }
  return participants;
}

/** Só notas válidas, de alunos e técnicas que pertencem à prova. */
function parseGrades(
  value: unknown,
  sections: readonly ExamSection[],
  participants: readonly ExamParticipant[],
): Record<string, Record<string, number>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const itemIds = new Set(sections.flatMap((section) => section.items.map((item) => item.id)));
  const studentIds = new Set(participants.map((participant) => participant.studentId));
  const grades: Record<string, Record<string, number>> = {};
  for (const [studentId, sheet] of Object.entries(value)) {
    if (!studentIds.has(studentId) || typeof sheet !== 'object' || sheet === null) return null;
    const studentGrades: Record<string, number> = {};
    for (const [itemId, grade] of Object.entries(sheet as object)) {
      if (!itemIds.has(itemId) || typeof grade !== 'number') return null;
      if (!(grade >= GRADE_MIN && grade <= GRADE_MAX)) return null;
      studentGrades[itemId] = grade;
    }
    grades[studentId] = studentGrades;
  }
  return grades;
}

function parseBelt(value: unknown): Belt | null {
  return (BELTS as readonly unknown[]).includes(value) ? (value as Belt) : null;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

function fromBase64(encoded: string): Uint8Array {
  return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
}

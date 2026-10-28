// Regras de pontuação. Espelho exato de frontend/src/app/shared/data-access/exams/exam-scoring.ts:
// o resultado calculado aqui (ex.: approvedCount) precisa bater com o que a tela mostra.
// Funções puras, sem dependência de banco ou HTTP.

interface ScorableItem {
  readonly id: string;
}

interface ScorableSection {
  readonly items: readonly ScorableItem[];
}

/** itemId → nota */
export type StudentGrades = Readonly<Record<string, number>>;
/** studentId → itemId → nota */
export type GradeSheet = Readonly<Record<string, StudentGrades>>;

export type ResultStatus = 'pending' | 'approved' | 'failed';

export interface StudentResult {
  /** Média de todas as notas lançadas, com uma casa decimal. */
  readonly average: number | null;
  readonly gradedCount: number;
  readonly totalCount: number;
  readonly status: ResultStatus;
}

export function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function studentResult(
  sections: readonly ScorableSection[],
  grades: StudentGrades | undefined,
  passingGrade: number,
): StudentResult {
  const items = sections.flatMap((section) => section.items);
  const values = items
    .map((item) => grades?.[item.id])
    .filter((grade): grade is number => grade !== undefined);

  const average =
    values.length === 0
      ? null
      : roundToTenth(values.reduce((sum, grade) => sum + grade, 0) / values.length);

  let status: ResultStatus = 'pending';
  if (values.length === items.length && average !== null) {
    status = average >= passingGrade ? 'approved' : 'failed';
  }

  return { average, gradedCount: values.length, totalCount: items.length, status };
}

export function gradingProgress(
  sections: readonly ScorableSection[],
  studentIds: readonly string[],
  sheet: GradeSheet,
): { readonly graded: number; readonly total: number } {
  const items = sections.flatMap((section) => section.items);
  const graded = studentIds.reduce(
    (count, studentId) =>
      count + items.filter((item) => sheet[studentId]?.[item.id] !== undefined).length,
    0,
  );
  return { graded, total: items.length * studentIds.length };
}

export const GRADE_MIN = 0;
export const GRADE_MAX = 3;

/** Nota válida: de 0 a 3, com no máximo uma casa decimal (ex.: 2,5). */
export function isValidGrade(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= GRADE_MIN &&
    value <= GRADE_MAX &&
    Math.abs(Math.round(value * 10) - value * 10) < 1e-9
  );
}

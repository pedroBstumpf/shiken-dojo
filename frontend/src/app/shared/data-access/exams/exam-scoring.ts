import { GradeSheet, StudentGrades } from './exam.model';

// Regras de pontuação. Funções puras e com tipos estruturais, para serem usadas
// tanto pela UI quanto pela API simulada (e, no futuro, espelhadas no back-end).

interface ScorableItem {
  readonly id: string;
}

interface ScorableSection {
  readonly items: readonly ScorableItem[];
}

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

/** Soma das notas lançadas no bloco; null se nenhuma nota foi lançada. */
export function sectionTotal(
  section: ScorableSection,
  grades: StudentGrades | undefined,
): number | null {
  const values = section.items
    .map((item) => grades?.[item.id])
    .filter((grade): grade is number => grade !== undefined);
  return values.length === 0 ? null : roundToTenth(values.reduce((sum, grade) => sum + grade, 0));
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

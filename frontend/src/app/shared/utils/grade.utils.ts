export const GRADE_MIN = 0;
/** Escala de notas da tabela de avaliação: de 0 a 3 (aceita meio ponto, ex.: 2,5). */
export const GRADE_MAX = 3;

export type GradeParseResult =
  { readonly ok: true; readonly value: number | null } | { readonly ok: false };

const gradeFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const totalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Converte o texto digitado ("2", "2,5", "2.5", "") em nota. Vazio significa "sem nota". */
export function parseGrade(raw: string): GradeParseResult {
  const text = raw.trim().replace(',', '.');
  if (text === '') {
    return { ok: true, value: null };
  }
  if (!/^\d{1,2}(\.\d+)?$/.test(text)) {
    return { ok: false };
  }
  const value = Math.round(Number(text) * 10) / 10;
  return value >= GRADE_MIN && value <= GRADE_MAX ? { ok: true, value } : { ok: false };
}

export function isValidGrade(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= GRADE_MIN && value <= GRADE_MAX
  );
}

/**
 * Se o texto pode ser o começo de uma nota válida. Usado para bloquear a digitação
 * de valores fora da escala ("4", "12", "3,5") antes mesmo de sair da célula.
 */
export function isAcceptableGradeDraft(text: string): boolean {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return true;
  if (!/^\d+(\.\d?)?$/.test(normalized)) return false;
  return Number(normalized) <= GRADE_MAX;
}

export function formatGrade(value: number | null | undefined): string {
  return value == null ? '' : gradeFormatter.format(value);
}

/** Totais e médias sempre com uma casa decimal, para alinharem na tabela. */
export function formatScore(value: number | null | undefined): string {
  return value == null ? '—' : totalFormatter.format(value);
}

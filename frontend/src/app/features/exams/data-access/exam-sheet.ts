import {
  gradingProgress,
  sectionTotal,
  studentResult,
} from '@shared/data-access/exams/exam-scoring';
import { Exam, ExamPdfVariant } from '@shared/data-access/exams/exam.model';
import { BELT_INFO } from '@shared/models/belt.model';
import { formatGrade, formatScore, GRADE_MAX, GRADE_MIN } from '@shared/utils/grade.utils';
import { normalizeForSearch, shortName } from '@shared/utils/text.utils';
import { format } from 'date-fns';

// Modelo da folha de avaliação impressa (independente de biblioteca de PDF).
// Célula vazia ('') vira um quadrado em branco para preencher à mão.

export interface SheetColumn {
  readonly number: number;
  readonly name: string;
}

export type SheetRow =
  | { readonly kind: 'section'; readonly title: string }
  | {
      readonly kind: 'item' | 'total' | 'summary';
      readonly label: string;
      readonly cells: readonly string[];
    };

export interface ExamSheet {
  readonly title: string;
  readonly statusNote: string;
  readonly scaleNote: string;
  readonly info: readonly { readonly label: string; readonly value: string }[];
  readonly columns: readonly SheetColumn[];
  readonly rows: readonly SheetRow[];
}

const RESULT_LABELS = { approved: 'Aprovado', failed: 'Reprovado', pending: '' } as const;

export function buildExamSheet(exam: Exam, variant: ExamPdfVariant): ExamSheet {
  const filled = variant === 'filled';
  const participants = exam.participants;
  const gradesOf = (studentId: string) => (filled ? exam.grades[studentId] : undefined);
  const results = participants.map((p) =>
    studentResult(exam.sections, gradesOf(p.studentId), exam.passingGrade),
  );

  const rows: SheetRow[] = [];
  for (const section of exam.sections) {
    rows.push({ kind: 'section', title: section.title });
    for (const item of section.items) {
      rows.push({
        kind: 'item',
        label: item.label,
        cells: participants.map((p) => formatGrade(gradesOf(p.studentId)?.[item.id])),
      });
    }
    if (section.showTotal) {
      rows.push({
        kind: 'total',
        label: 'Total',
        // Total só aparece com o bloco completo; parcial ficaria enganoso na folha impressa.
        cells: participants.map((p) => {
          const grades = gradesOf(p.studentId);
          const complete = section.items.every((item) => grades?.[item.id] !== undefined);
          return complete ? formatScore(sectionTotal(section, grades)) : '';
        }),
      });
    }
  }
  rows.push(
    {
      kind: 'summary',
      label: `Média (mínimo ${formatGrade(exam.passingGrade)})`,
      cells: results.map((r) => (r.status === 'pending' ? '' : formatScore(r.average))),
    },
    { kind: 'summary', label: 'Resultado', cells: results.map((r) => RESULT_LABELS[r.status]) },
  );

  return {
    title: exam.templateName,
    statusNote: statusNote(exam, variant),
    scaleNote: `Notas de ${GRADE_MIN} a ${GRADE_MAX}`,
    info: [
      { label: 'Data', value: format(exam.date, 'dd/MM/yyyy') },
      { label: 'Local', value: exam.location || '-' },
      { label: 'Examinador(a)', value: exam.examinerName },
      { label: 'Nota mínima', value: formatGrade(exam.passingGrade) },
      {
        label: 'Faixas',
        value: `${BELT_INFO[exam.fromBelt].label} -> ${BELT_INFO[exam.toBelt].label}`,
      },
    ],
    columns: participants.map((p, index) => ({ number: index + 1, name: shortName(p.fullName) })),
    rows,
  };
}

function statusNote(exam: Exam, variant: ExamPdfVariant): string {
  if (variant === 'blank') {
    return 'Folha em branco para preenchimento manual';
  }
  if (exam.completedAt) {
    return `Prova finalizada em ${format(exam.completedAt, 'dd/MM/yyyy')}`;
  }
  const { graded, total } = gradingProgress(
    exam.sections,
    exam.participants.map((p) => p.studentId),
    exam.grades,
  );
  return `Prova em andamento: ${graded} de ${total} notas lançadas`;
}

/** Ex.: "prova-exame-de-faixa-branca-a-laranja-2026-06-20-em-branco.pdf" */
export function examPdfFileName(exam: Exam, variant: ExamPdfVariant): string {
  const slug = normalizeForSearch(`prova ${exam.templateName}`)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${format(exam.date, 'yyyy-MM-dd')}${variant === 'blank' ? '-em-branco' : ''}.pdf`;
}

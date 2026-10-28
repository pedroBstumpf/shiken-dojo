import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ResultStatus, sectionTotal, studentResult } from '@shared/data-access/exams/exam-scoring';
import {
  ExamItem,
  ExamParticipant,
  ExamSection,
  GradeSheet,
} from '@shared/data-access/exams/exam.model';
import { BeltBadgeComponent } from '@shared/ui/belt-badge.component';
import {
  formatGrade,
  formatScore,
  GRADE_MAX,
  GRADE_MIN,
  isAcceptableGradeDraft,
  parseGrade,
} from '@shared/utils/grade.utils';
import { shortName } from '@shared/utils/text.utils';

export interface GradeChange {
  readonly studentId: string;
  readonly itemId: string;
  readonly value: number | null;
}

/** Para onde o Enter leva: próximo aluno (mesma técnica) ou próxima técnica (mesmo aluno). */
export type EnterDirection = 'student' | 'item';

interface CellVm {
  readonly key: string;
  readonly studentId: string;
  readonly itemId: string;
  readonly col: number;
  readonly value: number | undefined;
  readonly text: string;
  readonly invalid: boolean;
  readonly ariaLabel: string;
}

interface ItemRowVm {
  readonly row: number;
  readonly item: ExamItem;
  readonly sectionTitle: string;
  readonly cells: readonly CellVm[];
}

interface SectionVm {
  readonly section: ExamSection;
  readonly rows: readonly ItemRowVm[];
  readonly totals: readonly string[] | null;
}

interface ColumnVm {
  readonly col: number;
  readonly number: number;
  readonly participant: ExamParticipant;
  readonly shortName: string;
  readonly averageText: string;
  readonly status: ResultStatus;
  readonly statusLabel: string;
}

interface ActiveCell {
  readonly row: number;
  readonly col: number;
}

const STATUS_LABELS: Readonly<Record<ResultStatus, string>> = {
  approved: 'Aprovado',
  failed: 'Reprovado',
  pending: 'Pendente',
};

const ARROW_MOVES: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * Tabela de notas no formato do formulário em papel: técnicas nas linhas, alunos nas colunas.
 * A linha e a coluna da célula ativa ficam destacadas (em cruz) e uma faixa acima da tabela
 * diz exatamente qual aluno e qual técnica estão sendo avaliados.
 */
@Component({
  selector: 'sd-grading-grid',
  imports: [MatTooltipModule, BeltBadgeComponent],
  templateUrl: './grading-grid.component.html',
  styleUrl: './grading-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(focusout)': 'onFocusOut($event)' },
})
export class GradingGridComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly announcer = inject(LiveAnnouncer);

  readonly sections = input.required<readonly ExamSection[]>();
  readonly participants = input.required<readonly ExamParticipant[]>();
  readonly grades = input.required<GradeSheet>();
  readonly passingGrade = input.required<number>();
  readonly editable = input(false);
  readonly enterDirection = input<EnterDirection>('student');

  readonly gradeChange = output<GradeChange>();

  protected readonly active = signal<ActiveCell | null>(null);
  private readonly invalidKeys = signal<ReadonlySet<string>>(new Set());

  protected readonly gradeMax = GRADE_MAX;
  /** Célula onde um valor fora da escala acabou de ser bloqueado (pisca em vermelho). */
  protected readonly rejectedKey = signal<string | null>(null);
  protected readonly passingGradeText = computed(() => formatGrade(this.passingGrade()));

  protected readonly columns = computed<readonly ColumnVm[]>(() =>
    this.participants().map((participant, col) => {
      const result = studentResult(
        this.sections(),
        this.grades()[participant.studentId],
        this.passingGrade(),
      );
      return {
        col,
        number: col + 1,
        participant,
        shortName: shortName(participant.fullName),
        averageText: formatScore(result.average),
        status: result.status,
        statusLabel: STATUS_LABELS[result.status],
      };
    }),
  );

  protected readonly sectionVms = computed<readonly SectionVm[]>(() => {
    const grades = this.grades();
    const invalid = this.invalidKeys();
    let row = 0;
    return this.sections().map((section) => ({
      section,
      rows: section.items.map((item) => ({
        row: row++,
        item,
        sectionTitle: section.title,
        cells: this.participants().map((participant, col) => {
          const key = `${participant.studentId}:${item.id}`;
          const value = grades[participant.studentId]?.[item.id];
          return {
            key,
            studentId: participant.studentId,
            itemId: item.id,
            col,
            value,
            text: formatGrade(value),
            invalid: invalid.has(key),
            ariaLabel: `Nota de ${participant.fullName} em ${item.label}`,
          };
        }),
      })),
      totals: section.showTotal
        ? this.participants().map((p) => formatScore(sectionTotal(section, grades[p.studentId])))
        : null,
    }));
  });

  private readonly itemRows = computed(() => this.sectionVms().flatMap((section) => section.rows));

  /** O que está sendo avaliado agora — exibido na faixa acima da tabela. */
  protected readonly focusInfo = computed(() => {
    const active = this.active();
    const row = active ? this.itemRows()[active.row] : undefined;
    const column = active ? this.columns()[active.col] : undefined;
    if (!row || !column) {
      return null;
    }
    return {
      number: column.number,
      fullName: column.participant.fullName,
      belt: column.participant.belt,
      item: row.item.label,
      section: row.sectionTitle,
    };
  });

  /** Leva o foco à primeira célula sem nota, na ordem do Enter. Retorna false se não houver. */
  focusFirstBlank(): boolean {
    const rows = this.itemRows();
    const colCount = this.participants().length;
    const total = rows.length * colCount;
    for (let index = 0; index < total; index++) {
      const { row, col } = this.positionAt(index);
      if (rows[row]?.cells[col]?.value === undefined) {
        this.focusCell(row, col);
        return true;
      }
    }
    return false;
  }

  protected onFocus(event: FocusEvent, row: number, col: number): void {
    this.active.set({ row, col });
    const input = event.target as HTMLInputElement;
    input.select();
    input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  protected onHover(row: number, col: number): void {
    if (!this.editable()) {
      this.active.set({ row, col });
    }
  }

  protected onMouseLeave(): void {
    if (!this.editable()) {
      this.active.set(null);
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) {
      this.active.set(null);
    }
  }

  protected onKeydown(event: KeyboardEvent, row: number, col: number, cell: CellVm): void {
    const move = ARROW_MOVES[event.key];
    if (move) {
      event.preventDefault();
      this.focusCell(row + move[0], col + move[1]);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.focusNext(row, col, event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      // Desfaz o que foi digitado e volta à nota salva.
      (event.target as HTMLInputElement).value = cell.text;
      this.setInvalid(cell.key, false);
    }
  }

  /** Impede digitar (ou colar) algo que não seja uma nota de 0 a 3. */
  protected onBeforeInput(event: Event, cell: CellVm): void {
    const { data } = event as InputEvent;
    if (data === null) {
      return; // apagar, recortar etc.
    }
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + data + input.value.slice(end);
    if (!isAcceptableGradeDraft(next)) {
      event.preventDefault();
      this.rejectedKey.set(cell.key);
      setTimeout(() => this.rejectedKey.set(null), 450);
      void this.announcer.announce(`Use notas de ${GRADE_MIN} a ${GRADE_MAX}.`);
    }
  }

  protected onCommit(event: Event, cell: CellVm): void {
    const input = event.target as HTMLInputElement;
    const parsed = parseGrade(input.value);
    if (!parsed.ok) {
      this.setInvalid(cell.key, true);
      void this.announcer.announce(
        `Nota inválida. Use valores de ${GRADE_MIN} a ${GRADE_MAX}, por exemplo 2 ou 2,5.`,
        'assertive',
      );
      return;
    }
    this.setInvalid(cell.key, false);
    input.value = formatGrade(parsed.value);
    if (parsed.value !== (cell.value ?? null)) {
      this.gradeChange.emit({
        studentId: cell.studentId,
        itemId: cell.itemId,
        value: parsed.value,
      });
    }
  }

  private focusNext(row: number, col: number, step: 1 | -1): void {
    const total = this.itemRows().length * this.participants().length;
    const next = this.indexOf(row, col) + step;
    if (next < 0 || next >= total) {
      void this.announcer.announce(
        step > 0 ? 'Última nota da tabela.' : 'Primeira nota da tabela.',
      );
      return;
    }
    const position = this.positionAt(next);
    this.focusCell(position.row, position.col);
  }

  /** Índice linear na ordem do Enter (por aluno = linha a linha; por técnica = coluna a coluna). */
  private indexOf(row: number, col: number): number {
    return this.enterDirection() === 'student'
      ? row * this.participants().length + col
      : col * this.itemRows().length + row;
  }

  private positionAt(index: number): ActiveCell {
    const colCount = this.participants().length;
    const rowCount = this.itemRows().length;
    return this.enterDirection() === 'student'
      ? { row: Math.floor(index / colCount), col: index % colCount }
      : { row: index % rowCount, col: Math.floor(index / rowCount) };
  }

  private focusCell(row: number, col: number): void {
    this.host.nativeElement
      .querySelector<HTMLInputElement>(`input[data-cell="${row}:${col}"]`)
      ?.focus();
  }

  private setInvalid(key: string, invalid: boolean): void {
    this.invalidKeys.update((keys) => {
      if (keys.has(key) === invalid) return keys;
      const next = new Set(keys);
      if (invalid) next.add(key);
      else next.delete(key);
      return next;
    });
  }
}

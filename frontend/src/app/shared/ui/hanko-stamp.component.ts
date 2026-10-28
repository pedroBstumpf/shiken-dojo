import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ResultStatus } from '@shared/data-access/exams/exam-scoring';

const STAMPS: Readonly<Record<ResultStatus, { kanji: string; label: string }>> = {
  approved: { kanji: '合格', label: 'Aprovado' },
  failed: { kanji: '不合格', label: 'Reprovado' },
  pending: { kanji: '未定', label: 'Pendente' },
};

/** Carimbo (hanko) com o resultado do aluno, inspirado nos selos japoneses. */
@Component({
  selector: 'sd-hanko-stamp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './hanko-stamp.component.css',
  host: { class: 'inline-flex flex-col items-center gap-1', '[attr.data-status]': 'status()' },
  template: `
    <span class="stamp" [class.stamp--small]="small()" aria-hidden="true">{{ stamp().kanji }}</span>
    <span class="label">{{ stamp().label }}</span>
  `,
})
export class HankoStampComponent {
  readonly status = input.required<ResultStatus>();
  readonly small = input(false);

  protected readonly stamp = computed(() => STAMPS[this.status()]);
}

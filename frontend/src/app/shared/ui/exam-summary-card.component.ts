import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { ExamSummary } from '@shared/data-access/exams/exam.model';
import { BeltTransitionComponent } from './belt-transition.component';

/** Card de uma prova: concluída leva ao resultado; rascunho leva de volta à avaliação. */
@Component({
  selector: 'sd-exam-summary-card',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    BeltTransitionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'bg-surface-lowest border-outline-variant hover:border-primary focus-within:border-primary relative flex gap-4 rounded-2xl border p-4 transition-colors',
  },
  template: `
    <div
      class="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-container py-2 text-center"
      aria-hidden="true"
    >
      <span class="font-display text-2xl leading-none font-bold">{{
        exam().date | date: 'dd'
      }}</span>
      <span class="text-xs text-on-surface-variant uppercase">{{
        exam().date | date: 'MMM yy'
      }}</span>
    </div>

    <div class="min-w-0 flex-1">
      <a
        [routerLink]="link()"
        class="block truncate font-semibold after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
      >
        <span class="sr-only">{{ exam().date | date: 'longDate' }} — </span
        >{{ exam().templateName }}
      </a>
      <sd-belt-transition [from]="exam().fromBelt" [to]="exam().toBelt" class="mt-1" />
      <p class="mt-1 truncate text-sm text-on-surface-variant">
        {{ exam().examinerName }}
        @if (exam().location) {
          · {{ exam().location }}
        }
      </p>

      @if (exam().status === 'completed') {
        <p class="mt-2 flex items-center gap-2 text-sm">
          <span class="font-display font-bold text-hanko" aria-hidden="true">合格</span>
          <span>
            <strong>{{ exam().approvedCount }}</strong> de {{ exam().participantCount }}
            {{ exam().participantCount === 1 ? 'aluno aprovado' : 'alunos aprovados' }}
          </span>
        </p>
      } @else {
        <div class="mt-2">
          <p class="mb-1 flex items-center gap-2 text-sm">
            <span
              class="rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-semibold text-on-tertiary-container"
            >
              Em andamento
            </span>
            <span class="text-on-surface-variant">{{ progressPercent() }}% avaliado</span>
          </p>
          <mat-progress-bar mode="determinate" [value]="progressPercent()" aria-hidden="true" />
        </div>
      }
    </div>

    @if (deletable() && exam().status === 'draft') {
      <button
        matIconButton
        type="button"
        class="relative z-10 -mt-1 -mr-2 self-start"
        matTooltip="Excluir avaliação em andamento"
        aria-label="Excluir avaliação em andamento"
        (click)="deleted.emit(exam())"
      >
        <mat-icon aria-hidden="true">delete</mat-icon>
      </button>
    }
  `,
})
export class ExamSummaryCardComponent {
  readonly exam = input.required<ExamSummary>();
  readonly deletable = input(false);

  readonly deleted = output<ExamSummary>();

  protected readonly link = computed(() =>
    this.exam().status === 'completed'
      ? ['/history', this.exam().id]
      : ['/exams', this.exam().id, 'grade'],
  );

  protected readonly progressPercent = computed(() => {
    const { gradedCount, totalCount } = this.exam();
    return totalCount === 0 ? 0 : Math.round((gradedCount / totalCount) * 100);
  });
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '@core/notifications/notification.service';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { ExamStatus, ExamSummary } from '@shared/data-access/exams/exam.model';
import { ApiError } from '@shared/models/api-error.model';
import { ConfirmDialogComponent, confirmDialogConfig } from '@shared/ui/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { ExamSummaryCardComponent } from '@shared/ui/exam-summary-card.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { emptyIfMissing, normalizeForSearch } from '@shared/utils/text.utils';
import { filter, switchMap } from 'rxjs';

const STATUS_FILTERS: readonly { value: ExamStatus; label: string }[] = [
  { value: 'completed', label: 'Concluídas' },
  { value: 'draft', label: 'Em andamento' },
];

@Component({
  selector: 'sd-exam-history-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ExamSummaryCardComponent,
  ],
  templateUrl: './exam-history-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamHistoryPageComponent {
  private readonly api = inject(ExamApiService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);

  /** Filtros vindos da URL (?q=&status=). */
  readonly q = input('', { transform: emptyIfMissing });
  readonly status = input('', { transform: emptyIfMissing });

  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly exams = rxResource({ stream: () => this.api.list() });

  protected readonly statusFilter = computed<ExamStatus | null>(() =>
    STATUS_FILTERS.some((f) => f.value === this.status()) ? (this.status() as ExamStatus) : null,
  );

  protected readonly filteredExams = computed(() => {
    const term = normalizeForSearch(this.q());
    const status = this.statusFilter();
    return (this.exams.value() ?? []).filter(
      (exam) =>
        (!status || exam.status === status) &&
        (!term ||
          normalizeForSearch(`${exam.templateName} ${exam.examinerName} ${exam.location}`).includes(
            term,
          )),
    );
  });

  protected readonly hasExams = computed(() => (this.exams.value()?.length ?? 0) > 0);

  protected onSearch(event: Event): void {
    this.updateFilters({ q: (event.target as HTMLInputElement).value || null });
  }

  protected onStatusChange(status: ExamStatus | null): void {
    this.updateFilters({ status });
  }

  protected clearFilters(): void {
    this.updateFilters({ q: null, status: null });
  }

  protected onNewExam(): void {
    void this.router.navigate(['/exams/new']);
  }

  protected onDelete(exam: ExamSummary): void {
    this.dialog
      .open(
        ConfirmDialogComponent,
        confirmDialogConfig({
          title: 'Excluir avaliação em andamento?',
          message: `As notas já lançadas em "${exam.templateName}" serão perdidas. Esta ação não pode ser desfeita.`,
          confirmLabel: 'Excluir avaliação',
          destructive: true,
        }),
      )
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.remove(exam.id)),
      )
      .subscribe({
        next: () => {
          this.exams.update((list) => list?.filter((e) => e.id !== exam.id));
          this.notifications.success('Avaliação excluída.');
        },
        error: (error: ApiError) => this.notifications.error(error.message),
      });
  }

  private updateFilters(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}

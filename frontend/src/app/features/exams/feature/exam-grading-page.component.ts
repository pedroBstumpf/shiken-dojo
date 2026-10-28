import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { NotificationService } from '@core/notifications/notification.service';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { gradingProgress } from '@shared/data-access/exams/exam-scoring';
import { GradeSheet } from '@shared/data-access/exams/exam.model';
import { CanLeave } from '@shared/guards/can-leave.guard';
import { ApiError } from '@shared/models/api-error.model';
import { GradePipe } from '@shared/pipes/grade.pipe';
import { BeltTransitionComponent } from '@shared/ui/belt-transition.component';
import { ConfirmDialogComponent, confirmDialogConfig } from '@shared/ui/confirm-dialog.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import {
  catchError,
  debounceTime,
  filter,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { EnterDirection, GradeChange, GradingGridComponent } from '../ui/grading-grid.component';

type SaveState = 'saved' | 'pending' | 'saving' | 'error';

const AUTOSAVE_DELAY_MS = 800;

@Component({
  selector: 'sd-exam-grading-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    PageHeaderComponent,
    ErrorStateComponent,
    BeltTransitionComponent,
    GradingGridComponent,
    GradePipe,
  ],
  templateUrl: './exam-grading-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ExamGradingPageComponent implements CanLeave {
  private readonly api = inject(ExamApiService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);

  readonly id = input.required<string>();

  private readonly grid = viewChild(GradingGridComponent);
  private readonly changes$ = new Subject<GradeSheet>();

  protected readonly exam = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.get(id),
  });

  /** Notas editadas localmente; reiniciam quando a prova é (re)carregada. */
  protected readonly grades = linkedSignal<GradeSheet>(() => this.exam.value()?.grades ?? {});
  protected readonly saveState = signal<SaveState>('saved');
  protected readonly enterDirection = signal<EnterDirection>('student');
  protected readonly isCompleting = signal(false);

  protected readonly progress = computed(() => {
    const exam = this.exam.value();
    if (!exam) return { graded: 0, total: 0, percent: 0 };
    const { graded, total } = gradingProgress(
      exam.sections,
      exam.participants.map((p) => p.studentId),
      this.grades(),
    );
    return { graded, total, percent: total === 0 ? 0 : Math.round((graded / total) * 100) };
  });

  constructor() {
    // Prova finalizada não pode ser editada: mostra o resultado no histórico.
    effect(() => {
      const exam = this.exam.value();
      if (exam?.status === 'completed') {
        void this.router.navigate(['/history', exam.id], { replaceUrl: true });
      }
    });

    // Salvamento automático: espera o professor parar de digitar e envia a planilha inteira (PUT idempotente).
    this.changes$
      .pipe(
        tap(() => this.saveState.set('pending')),
        debounceTime(AUTOSAVE_DELAY_MS),
        switchMap((grades) => this.persist(grades)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  canLeave(): boolean | Observable<boolean> {
    if (this.saveState() === 'saved') {
      return true;
    }
    return this.persist(this.grades()).pipe(
      switchMap((saved) =>
        saved
          ? of(true)
          : this.dialog
              .open(
                ConfirmDialogComponent,
                confirmDialogConfig({
                  title: 'Sair sem salvar as últimas notas?',
                  message:
                    'Não conseguimos salvar as notas mais recentes. Se sair agora, elas serão perdidas.',
                  confirmLabel: 'Sair mesmo assim',
                  cancelLabel: 'Ficar e tentar de novo',
                  destructive: true,
                }),
              )
              .afterClosed()
              .pipe(map(Boolean)),
      ),
    );
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.saveState() !== 'saved') {
      event.preventDefault();
    }
  }

  protected onGradeChange(change: GradeChange): void {
    this.grades.update((sheet) => {
      const studentGrades: Record<string, number> = { ...sheet[change.studentId] };
      if (change.value === null) {
        delete studentGrades[change.itemId];
      } else {
        studentGrades[change.itemId] = change.value;
      }
      return { ...sheet, [change.studentId]: studentGrades };
    });
    this.changes$.next(this.grades());
  }

  protected retrySave(): void {
    this.persist(this.grades()).subscribe();
  }

  protected onNextBlank(): void {
    if (!this.grid()?.focusFirstBlank()) {
      this.notifications.success('Todas as notas já foram lançadas.');
    }
  }

  protected onComplete(): void {
    const { graded, total } = this.progress();
    if (graded < total) {
      const missing = total - graded;
      this.notifications.error(
        `${missing === 1 ? 'Falta 1 nota' : `Faltam ${missing} notas`} para finalizar. Levamos você à primeira em branco.`,
      );
      this.grid()?.focusFirstBlank();
      return;
    }

    this.dialog
      .open(
        ConfirmDialogComponent,
        confirmDialogConfig({
          title: 'Finalizar a prova?',
          message: 'As notas serão registradas no histórico e não poderão mais ser alteradas.',
          confirmLabel: 'Finalizar prova',
        }),
      )
      .afterClosed()
      .pipe(
        filter(Boolean),
        tap(() => this.isCompleting.set(true)),
        switchMap(() => this.api.saveGrades(this.id(), this.grades())),
        switchMap(() => this.api.complete(this.id())),
      )
      .subscribe({
        next: (exam) => {
          this.saveState.set('saved');
          this.notifications.success(
            'Prova finalizada e registrada no histórico. Otsukaresama deshita!',
          );
          void this.router.navigate(['/history', exam.id]);
        },
        error: (error: ApiError) => {
          this.isCompleting.set(false);
          this.notifications.error(error.message);
        },
      });
  }

  /** Salva as notas. Emite true se salvou, false se falhou (nunca propaga erro). */
  private persist(grades: GradeSheet): Observable<boolean> {
    this.saveState.set('saving');
    return this.api.saveGrades(this.id(), grades).pipe(
      map(() => {
        this.saveState.set('saved');
        return true;
      }),
      catchError((error: ApiError) => {
        this.saveState.set('error');
        this.notifications.error(`Não foi possível salvar as notas: ${error.message}`);
        return of(false);
      }),
    );
  }
}

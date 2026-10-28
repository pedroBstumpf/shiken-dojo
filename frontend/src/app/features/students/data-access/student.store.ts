import { computed, inject, Injectable, signal } from '@angular/core';
import { NotificationService } from '@core/notifications/notification.service';
import { StudentApiService } from '@shared/data-access/students/student-api.service';
import { Student } from '@shared/data-access/students/student.model';
import { ApiError } from '@shared/models/api-error.model';
import { shortName } from '@shared/utils/text.utils';
import { filter, switchMap, tap } from 'rxjs';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class StudentStore {
  private readonly api = inject(StudentApiService);
  private readonly notifications = inject(NotificationService);

  private readonly _students = signal<readonly Student[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<string | null>(null);

  readonly students = this._students.asReadonly();
  readonly error = this._error.asReadonly();
  /** Só mostra o skeleton no primeiro carregamento; recarregamentos mantêm a lista visível. */
  readonly isFirstLoad = computed(
    () => this._status() === 'loading' && this._students().length === 0,
  );

  load(): void {
    this._status.set('loading');
    this._error.set(null);
    this.api.list().subscribe({
      next: (students) => {
        this._students.set(students);
        this._status.set('loaded');
      },
      error: (error: ApiError) => {
        this._error.set(error.message);
        this._status.set('error');
      },
    });
  }

  /** Remoção otimista com "Desfazer": a API só é chamada quando o prazo para desfazer acaba. */
  remove(student: Student): void {
    this._students.update((list) => list.filter((s) => s.id !== student.id));
    this.notifications
      .withUndo(`${shortName(student.fullName)} foi removido(a).`)
      .pipe(
        tap((undone) => {
          if (undone) this.restore(student);
        }),
        filter((undone) => !undone),
        switchMap(() => this.api.remove(student.id)),
      )
      .subscribe({
        error: (error: ApiError) => {
          this.restore(student);
          this.notifications.error(error.message);
        },
      });
  }

  private restore(student: Student): void {
    this._students.update((list) =>
      [...list, student].sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    );
  }
}

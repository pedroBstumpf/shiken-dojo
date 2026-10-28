import { computed, inject, Injectable, signal } from '@angular/core';
import { NotificationService } from '@core/notifications/notification.service';
import { TeacherApiService } from '@shared/data-access/teachers/teacher-api.service';
import { Teacher } from '@shared/data-access/teachers/teacher.model';
import { ApiError } from '@shared/models/api-error.model';
import { shortName } from '@shared/utils/text.utils';
import { filter, switchMap, tap } from 'rxjs';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class TeacherStore {
  private readonly api = inject(TeacherApiService);
  private readonly notifications = inject(NotificationService);

  private readonly _teachers = signal<readonly Teacher[]>([]);
  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<string | null>(null);

  readonly teachers = this._teachers.asReadonly();
  readonly error = this._error.asReadonly();
  /** Só mostra o skeleton no primeiro carregamento; recarregamentos mantêm a lista visível. */
  readonly isFirstLoad = computed(
    () => this._status() === 'loading' && this._teachers().length === 0,
  );

  load(): void {
    this._status.set('loading');
    this._error.set(null);
    this.api.list().subscribe({
      next: (teachers) => {
        this._teachers.set(teachers);
        this._status.set('loaded');
      },
      error: (error: ApiError) => {
        this._error.set(error.message);
        this._status.set('error');
      },
    });
  }

  /** Remoção otimista com "Desfazer": a API só é chamada quando o prazo para desfazer acaba. */
  remove(teacher: Teacher): void {
    this._teachers.update((list) => list.filter((t) => t.id !== teacher.id));
    this.notifications
      .withUndo(`${shortName(teacher.fullName)} foi removido(a).`)
      .pipe(
        tap((undone) => {
          if (undone) this.restore(teacher);
        }),
        filter((undone) => !undone),
        switchMap(() => this.api.remove(teacher.id)),
      )
      .subscribe({
        error: (error: ApiError) => {
          this.restore(teacher);
          this.notifications.error(error.message);
        },
      });
  }

  private restore(teacher: Teacher): void {
    this._teachers.update((list) =>
      [...list, teacher].sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    );
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { emptyIfMissing, normalizeForSearch } from '@shared/utils/text.utils';
import { TeacherStore } from '../data-access/teacher.store';
import { TeacherCardComponent } from '../ui/teacher-card.component';

type StatusFilter = 'active' | 'inactive';

const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
];

@Component({
  selector: 'sd-teacher-list-page',
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
    TeacherCardComponent,
  ],
  templateUrl: './teacher-list-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherListPageComponent {
  private readonly router = inject(Router);
  protected readonly store = inject(TeacherStore);
  protected readonly auth = inject(AuthService);

  /** Filtros vêm da URL (?q=&status=). */
  readonly q = input('', { transform: emptyIfMissing });
  readonly status = input('', { transform: emptyIfMissing });

  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly skeletons = [1, 2, 3];

  protected readonly statusFilter = computed<StatusFilter | null>(() =>
    STATUS_FILTERS.some((f) => f.value === this.status()) ? (this.status() as StatusFilter) : null,
  );

  protected readonly filteredTeachers = computed(() => {
    const term = normalizeForSearch(this.q());
    const status = this.statusFilter();
    return this.store
      .teachers()
      .filter(
        (t) =>
          (!status || t.active === (status === 'active')) &&
          (!term || normalizeForSearch(`${t.fullName} ${t.email}`).includes(term)),
      );
  });

  constructor() {
    this.store.load();
  }

  protected onSearch(event: Event): void {
    this.updateFilters({ q: (event.target as HTMLInputElement).value || null });
  }

  protected onStatusChange(status: StatusFilter | null): void {
    this.updateFilters({ status });
  }

  protected clearFilters(): void {
    this.updateFilters({ q: null, status: null });
  }

  protected onCreate(): void {
    void this.router.navigate(['/teachers/new']);
  }

  private updateFilters(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}

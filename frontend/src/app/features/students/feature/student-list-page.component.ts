import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { Belt, BELT_INFO, BELTS, isBelt } from '@shared/models/belt.model';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { emptyIfMissing, normalizeForSearch } from '@shared/utils/text.utils';
import { StudentStore } from '../data-access/student.store';
import { StudentCardComponent } from '../ui/student-card.component';

@Component({
  selector: 'sd-student-list-page',
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
    StudentCardComponent,
  ],
  templateUrl: './student-list-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentListPageComponent {
  private readonly router = inject(Router);
  protected readonly store = inject(StudentStore);

  /** Filtros vêm da URL (?q=&belt=), assim podem ser compartilhados e sobrevivem ao "voltar". */
  readonly q = input('', { transform: emptyIfMissing });
  readonly belt = input('', { transform: emptyIfMissing });

  protected readonly beltFilter = computed<Belt | null>(() =>
    isBelt(this.belt()) ? (this.belt() as Belt) : null,
  );

  /** Só oferece como filtro as faixas que existem na lista. */
  protected readonly beltOptions = computed(() => {
    const present = new Set(this.store.students().map((s) => s.belt));
    return BELTS.filter((belt) => present.has(belt)).map((belt) => ({
      belt,
      label: BELT_INFO[belt].label,
    }));
  });

  protected readonly filteredStudents = computed(() => {
    const term = normalizeForSearch(this.q());
    const belt = this.beltFilter();
    return this.store
      .students()
      .filter(
        (s) =>
          (!belt || s.belt === belt) && (!term || normalizeForSearch(s.fullName).includes(term)),
      );
  });

  protected readonly hasFilters = computed(() => this.q() !== '' || this.beltFilter() !== null);

  protected readonly skeletons = Array.from({ length: 6 }, (_, index) => index);

  constructor() {
    this.store.load();
  }

  protected onSearch(event: Event): void {
    this.updateFilters({ q: (event.target as HTMLInputElement).value || null });
  }

  protected onBeltChange(belt: Belt | null): void {
    this.updateFilters({ belt });
  }

  protected clearFilters(): void {
    this.updateFilters({ q: null, belt: null });
  }

  protected onCreate(): void {
    void this.router.navigate(['/students/new']);
  }

  private updateFilters(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}

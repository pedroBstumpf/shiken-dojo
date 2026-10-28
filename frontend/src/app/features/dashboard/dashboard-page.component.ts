import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { StudentApiService } from '@shared/data-access/students/student-api.service';
import { BELT_INFO, BELTS } from '@shared/models/belt.model';
import { BeltBadgeComponent } from '@shared/ui/belt-badge.component';
import { EnsoLogoComponent } from '@shared/ui/enso-logo.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { ExamSummaryCardComponent } from '@shared/ui/exam-summary-card.component';

const RECENT_EXAMS_LIMIT = 4;

@Component({
  selector: 'sd-dashboard-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    BeltBadgeComponent,
    EnsoLogoComponent,
    ErrorStateComponent,
    ExamSummaryCardComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent {
  private readonly studentApi = inject(StudentApiService);
  private readonly examApi = inject(ExamApiService);

  protected readonly students = rxResource({ stream: () => this.studentApi.list() });
  protected readonly exams = rxResource({ stream: () => this.examApi.list() });

  protected readonly isLoading = computed(
    () => this.students.isLoading() || this.exams.isLoading(),
  );
  protected readonly error = computed(() => this.students.error() ?? this.exams.error());

  protected readonly drafts = computed(() =>
    (this.exams.value() ?? []).filter((e) => e.status === 'draft'),
  );

  protected readonly recentExams = computed(() =>
    (this.exams.value() ?? []).filter((e) => e.status === 'completed').slice(0, RECENT_EXAMS_LIMIT),
  );

  protected readonly stats = computed(() => {
    const completed = (this.exams.value() ?? []).filter((e) => e.status === 'completed');
    const participants = completed.reduce((sum, e) => sum + e.participantCount, 0);
    const approved = completed.reduce((sum, e) => sum + e.approvedCount, 0);
    return {
      students: this.students.value()?.length ?? 0,
      completedExams: completed.length,
      drafts: this.drafts().length,
      approvalRate: participants === 0 ? '—' : `${Math.round((approved / participants) * 100)}%`,
    };
  });

  /** Quantos alunos há em cada faixa, na ordem de graduação. */
  protected readonly beltDistribution = computed(() => {
    const students = this.students.value() ?? [];
    const counts = BELTS.map((belt) => ({
      belt,
      label: BELT_INFO[belt].label,
      count: students.filter((s) => s.belt === belt).length,
    })).filter((entry) => entry.count > 0);
    const max = Math.max(1, ...counts.map((entry) => entry.count));
    return counts.map((entry) => ({ ...entry, percent: Math.round((entry.count / max) * 100) }));
  });

  protected reload(): void {
    this.students.reload();
    this.exams.reload();
  }
}

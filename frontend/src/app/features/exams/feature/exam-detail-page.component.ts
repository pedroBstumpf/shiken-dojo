import { DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { roundToTenth, studentResult } from '@shared/data-access/exams/exam-scoring';
import { BELT_INFO } from '@shared/models/belt.model';
import { GradePipe } from '@shared/pipes/grade.pipe';
import { BeltBadgeComponent } from '@shared/ui/belt-badge.component';
import { BeltTransitionComponent } from '@shared/ui/belt-transition.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { HankoStampComponent } from '@shared/ui/hanko-stamp.component';
import { InitialsAvatarComponent } from '@shared/ui/initials-avatar.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { formatScore } from '@shared/utils/grade.utils';
import { GradingGridComponent } from '../ui/grading-grid.component';

@Component({
  selector: 'sd-exam-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    ErrorStateComponent,
    BeltBadgeComponent,
    BeltTransitionComponent,
    HankoStampComponent,
    InitialsAvatarComponent,
    GradingGridComponent,
    GradePipe,
  ],
  templateUrl: './exam-detail-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamDetailPageComponent {
  private readonly api = inject(ExamApiService);
  private readonly document = inject(DOCUMENT);

  readonly id = input.required<string>();

  protected readonly exam = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.get(id),
  });

  protected readonly results = computed(() => {
    const exam = this.exam.value();
    if (!exam) return [];
    return exam.participants.map((participant, index) => {
      const result = studentResult(
        exam.sections,
        exam.grades[participant.studentId],
        exam.passingGrade,
      );
      return { number: index + 1, participant, result, averageText: formatScore(result.average) };
    });
  });

  protected readonly stats = computed(() => {
    const results = this.results();
    const averages = results.map((r) => r.result.average).filter((a): a is number => a !== null);
    const classAverage =
      averages.length === 0
        ? null
        : roundToTenth(averages.reduce((sum, a) => sum + a, 0) / averages.length);
    return {
      participants: results.length,
      approved: results.filter((r) => r.result.status === 'approved').length,
      failed: results.filter((r) => r.result.status === 'failed').length,
      classAverage: formatScore(classAverage),
    };
  });

  protected readonly toBeltLabel = computed(() => {
    const exam = this.exam.value();
    return exam ? BELT_INFO[exam.toBelt].label : '';
  });

  protected onPrint(): void {
    this.document.defaultView?.print();
  }
}

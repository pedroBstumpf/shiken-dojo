import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule, MatSelectionListChange } from '@angular/material/list';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { ExamTemplate } from '@shared/data-access/exams/exam.model';
import { StudentApiService } from '@shared/data-access/students/student-api.service';
import { TeacherApiService } from '@shared/data-access/teachers/teacher-api.service';
import { formatDan, TEACHER_ROLE_INFO } from '@shared/data-access/teachers/teacher.model';
import { ApiError } from '@shared/models/api-error.model';
import { BELT_INFO } from '@shared/models/belt.model';
import { FieldErrorPipe } from '@shared/pipes/field-error.pipe';
import { BeltBadgeComponent } from '@shared/ui/belt-badge.component';
import { BeltTransitionComponent } from '@shared/ui/belt-transition.component';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { InitialsAvatarComponent } from '@shared/ui/initials-avatar.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { GradePipe } from '@shared/pipes/grade.pipe';
import { GRADE_MAX, GRADE_MIN } from '@shared/utils/grade.utils';
import { normalizeForSearch } from '@shared/utils/text.utils';
import { map } from 'rxjs';

@Component({
  selector: 'sd-exam-setup-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatStepperModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    BeltBadgeComponent,
    BeltTransitionComponent,
    InitialsAvatarComponent,
    FieldErrorPipe,
    GradePipe,
  ],
  templateUrl: './exam-setup-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamSetupPageComponent {
  private readonly examApi = inject(ExamApiService);
  private readonly studentApi = inject(StudentApiService);
  private readonly teacherApi = inject(TeacherApiService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly templates = rxResource({ stream: () => this.examApi.listTemplates() });
  protected readonly students = rxResource({ stream: () => this.studentApi.list() });
  protected readonly teachers = rxResource({ stream: () => this.teacherApi.list() });

  protected readonly detailsForm = this.fb.group({
    templateId: ['', Validators.required],
    date: this.fb.control<Date | null>(new Date(), Validators.required),
    location: ['', Validators.maxLength(120)],
    examinerId: ['', Validators.required],
    passingGrade: [2, [Validators.required, Validators.min(GRADE_MIN), Validators.max(GRADE_MAX)]],
    notes: ['', Validators.maxLength(500)],
  });

  protected readonly studentsForm = this.fb.group({
    studentIds: this.fb.control<string[]>([], Validators.required),
  });

  protected readonly search = signal('');
  protected readonly onlyFromBelt = signal(true);
  protected readonly isCreating = signal(false);

  protected readonly templateId = toSignal(this.detailsForm.controls.templateId.valueChanges, {
    initialValue: this.detailsForm.controls.templateId.value,
  });
  private readonly selectedIds = toSignal(this.studentsForm.controls.studentIds.valueChanges, {
    initialValue: this.studentsForm.controls.studentIds.value,
  });

  protected readonly templateOptions = computed(() =>
    (this.templates.value() ?? []).map((template) => ({
      template,
      itemCount: template.sections.reduce((count, section) => count + section.items.length, 0),
    })),
  );

  private readonly examinerId = toSignal(this.detailsForm.controls.examinerId.valueChanges, {
    initialValue: this.detailsForm.controls.examinerId.value,
  });

  /** Só professores ativos podem ser examinadores. */
  protected readonly examinerOptions = computed(() =>
    (this.teachers.value() ?? [])
      .filter((teacher) => teacher.active)
      .map((teacher) => ({
        teacher,
        detail: [TEACHER_ROLE_INFO[teacher.role].label, formatDan(teacher.dan)]
          .filter(Boolean)
          .join(' · '),
      })),
  );

  protected readonly selectedExaminer = computed(
    () => this.examinerOptions().find((o) => o.teacher.id === this.examinerId())?.teacher,
  );

  protected readonly selectedTemplate = computed<ExamTemplate | undefined>(() =>
    this.templates.value()?.find((t) => t.id === this.templateId()),
  );

  protected readonly fromBeltLabel = computed(() => {
    const template = this.selectedTemplate();
    return template ? BELT_INFO[template.fromBelt].label : '';
  });

  protected readonly isNarrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly visibleStudents = computed(() => {
    const term = normalizeForSearch(this.search());
    const fromBelt = this.onlyFromBelt() ? this.selectedTemplate()?.fromBelt : undefined;
    return (this.students.value() ?? []).filter(
      (s) =>
        (!fromBelt || s.belt === fromBelt) &&
        (!term || normalizeForSearch(s.fullName).includes(term)),
    );
  });

  protected readonly studentOptions = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.visibleStudents().map((student) => ({ student, selected: ids.has(student.id) }));
  });

  /** Alunos selecionados na ordem das colunas da tabela (alfabética, como a lista). */
  protected readonly selectedStudents = computed(() => {
    const ids = new Set(this.selectedIds());
    return (this.students.value() ?? []).filter((s) => ids.has(s.id));
  });

  constructor() {
    // Com uma só tabela disponível, ela já vem escolhida.
    effect(() => {
      const templates = this.templates.value();
      if (templates?.length === 1 && !this.detailsForm.controls.templateId.value) {
        this.detailsForm.controls.templateId.setValue(templates[0]!.id);
      }
    });

    // O professor logado já vem como examinador (ou o único professor ativo, se for o caso).
    effect(() => {
      const options = this.examinerOptions();
      if (this.detailsForm.controls.examinerId.value) return;
      const loggedId = this.auth.session()?.teacher.id;
      const preferred =
        options.find((option) => option.teacher.id === loggedId) ??
        (options.length === 1 ? options[0] : undefined);
      if (preferred) this.detailsForm.controls.examinerId.setValue(preferred.teacher.id);
    });
  }

  protected onCreateTeacher(): void {
    void this.router.navigate(['/teachers/new']);
  }

  protected onCreateStudent(): void {
    void this.router.navigate(['/students/new']);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** Atualiza a seleção sem perder alunos escondidos pela busca ou pelo filtro de faixa. */
  protected onSelectionChange(event: MatSelectionListChange): void {
    const ids = new Set(this.selectedIds());
    for (const option of event.options) {
      const id = option.value as string;
      if (option.selected) ids.add(id);
      else ids.delete(id);
    }
    this.setSelection(ids);
  }

  protected selectVisible(): void {
    this.setSelection(new Set([...this.selectedIds(), ...this.visibleStudents().map((s) => s.id)]));
  }

  protected clearSelection(): void {
    this.studentsForm.controls.studentIds.setValue([]);
  }

  private setSelection(ids: ReadonlySet<string>): void {
    const ordered = (this.students.value() ?? []).filter((s) => ids.has(s.id)).map((s) => s.id);
    this.studentsForm.controls.studentIds.setValue(ordered);
    this.studentsForm.controls.studentIds.markAsTouched();
  }

  protected onStart(): void {
    if (this.detailsForm.invalid || this.studentsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      this.studentsForm.markAllAsTouched();
      return;
    }
    const details = this.detailsForm.getRawValue();
    this.isCreating.set(true);
    this.examApi
      .create({
        ...details,
        date: details.date ?? new Date(),
        studentIds: this.selectedStudents().map((s) => s.id),
      })
      .subscribe({
        next: (exam) => {
          this.notifications.success('Prova criada. Bom exame!');
          void this.router.navigate(['/exams', exam.id, 'grade']);
        },
        error: (error: ApiError) => {
          this.isCreating.set(false);
          this.notifications.error(error.message);
        },
      });
  }
}

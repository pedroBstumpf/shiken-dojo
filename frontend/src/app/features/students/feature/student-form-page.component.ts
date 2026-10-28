import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '@core/notifications/notification.service';
import { StudentApiService } from '@shared/data-access/students/student-api.service';
import { StudentInput } from '@shared/data-access/students/student.model';
import { CanLeave } from '@shared/guards/can-leave.guard';
import { ApiError } from '@shared/models/api-error.model';
import { Belt, BELT_INFO, BELTS } from '@shared/models/belt.model';
import { FieldErrorPipe } from '@shared/pipes/field-error.pipe';
import { BeltBadgeComponent } from '@shared/ui/belt-badge.component';
import { ConfirmDialogComponent, confirmDialogConfig } from '@shared/ui/confirm-dialog.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { notInFutureValidator } from '@shared/validators/date.validators';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'sd-student-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageHeaderComponent,
    ErrorStateComponent,
    BeltBadgeComponent,
    FieldErrorPipe,
  ],
  templateUrl: './student-form-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentFormPageComponent implements CanLeave {
  private readonly api = inject(StudentApiService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly document = inject(DOCUMENT);

  /** Vem da rota (:id) — ausente ao cadastrar. */
  readonly id = input<string>();

  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly isSaving = signal(false);
  protected readonly belts = BELTS.map((belt) => ({ belt, label: BELT_INFO[belt].label }));
  protected readonly today = new Date();

  protected readonly student = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.get(id),
  });

  protected readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    belt: this.fb.control<Belt>('branca', Validators.required),
    birthDate: this.fb.control<Date | null>(null, notInFutureValidator()),
    enrollmentDate: this.fb.control<Date | null>(null, notInFutureValidator()),
    notes: ['', Validators.maxLength(500)],
  });

  constructor() {
    effect(() => {
      const student = this.student.value();
      if (student) {
        this.form.reset({
          fullName: student.fullName,
          belt: student.belt,
          birthDate: student.birthDate,
          enrollmentDate: student.enrollmentDate,
          notes: student.notes,
        });
      }
    });
  }

  canLeave(): boolean | Observable<boolean> {
    if (!this.form.dirty) {
      return true;
    }
    return this.dialog
      .open(
        ConfirmDialogComponent,
        confirmDialogConfig({
          title: 'Sair sem salvar?',
          message: 'As alterações feitas neste cadastro serão perdidas.',
          confirmLabel: 'Sair sem salvar',
          cancelLabel: 'Continuar editando',
          destructive: true,
        }),
      )
      .afterClosed()
      .pipe(map(Boolean));
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.document
        .querySelector<HTMLElement>('form input.ng-invalid, form mat-select.ng-invalid')
        ?.focus();
      return;
    }

    const input: StudentInput = this.form.getRawValue();
    const id = this.id();
    const request$ = id ? this.api.update(id, input) : this.api.create(input);

    this.isSaving.set(true);
    request$.subscribe({
      next: (student) => {
        this.form.markAsPristine();
        this.notifications.success(
          this.isEdit() ? 'Cadastro atualizado.' : `${student.fullName} foi cadastrado(a).`,
        );
        void this.router.navigate(['/students']);
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.applyServerErrors(error);
      },
    });
  }

  private applyServerErrors(error: ApiError): void {
    const fields = Object.entries(error.fieldErrors);
    if (fields.length === 0) {
      this.notifications.error(error.message);
      return;
    }
    for (const [field, message] of fields) {
      const control = this.form.get(field);
      control?.setErrors({ server: message });
      control?.markAsTouched();
    }
  }
}

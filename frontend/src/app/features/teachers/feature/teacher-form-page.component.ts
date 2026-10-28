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
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '@core/notifications/notification.service';
import { TeacherApiService } from '@shared/data-access/teachers/teacher-api.service';
import {
  DAN_LEVELS,
  formatDan,
  TEACHER_ROLE_INFO,
  TEACHER_ROLES,
  TeacherInput,
  TeacherRole,
} from '@shared/data-access/teachers/teacher.model';
import { CanLeave } from '@shared/guards/can-leave.guard';
import { ApiError } from '@shared/models/api-error.model';
import { Belt, BELT_INFO, BELTS } from '@shared/models/belt.model';
import { FieldErrorPipe } from '@shared/pipes/field-error.pipe';
import { BeltBadgeComponent } from '@shared/ui/belt-badge.component';
import { ConfirmDialogComponent, confirmDialogConfig } from '@shared/ui/confirm-dialog.component';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { formatPhone } from '@shared/utils/phone.utils';
import { phoneValidator } from '@shared/validators/phone.validator';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'sd-teacher-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    PageHeaderComponent,
    ErrorStateComponent,
    BeltBadgeComponent,
    FieldErrorPipe,
  ],
  templateUrl: './teacher-form-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherFormPageComponent implements CanLeave {
  private readonly api = inject(TeacherApiService);
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
  protected readonly danOptions = DAN_LEVELS.map((dan) => ({ dan, label: formatDan(dan) }));
  protected readonly roles = TEACHER_ROLES.map((role) => ({ role, ...TEACHER_ROLE_INFO[role] }));

  protected readonly teacher = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.get(id),
  });

  protected readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', phoneValidator()],
    role: this.fb.control<TeacherRole>('instructor', Validators.required),
    belt: this.fb.control<Belt>('preta', Validators.required),
    dan: this.fb.control<number | null>(1, Validators.required),
    federationId: ['', Validators.maxLength(30)],
    active: [true],
  });

  constructor() {
    // O grau (dan) só existe para faixa preta.
    this.form.controls.belt.valueChanges.pipe(takeUntilDestroyed()).subscribe((belt) => {
      const dan = this.form.controls.dan;
      if (belt === 'preta') {
        dan.enable({ emitEvent: false });
        if (dan.value === null) dan.setValue(1);
      } else {
        dan.setValue(null);
        dan.disable({ emitEvent: false });
      }
    });

    effect(() => {
      const teacher = this.teacher.value();
      if (teacher) {
        this.form.reset({
          fullName: teacher.fullName,
          email: teacher.email,
          phone: teacher.phone ? formatPhone(teacher.phone) : '',
          role: teacher.role,
          belt: teacher.belt,
          dan: teacher.dan,
          federationId: teacher.federationId,
          active: teacher.active,
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

  /** Formata o telefone ao sair do campo: "11987654321" → "(11) 98765-4321". */
  protected onPhoneBlur(): void {
    const control = this.form.controls.phone;
    if (control.valid && control.value) {
      control.setValue(formatPhone(control.value));
    }
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.document
        .querySelector<HTMLElement>('form input.ng-invalid, form mat-select.ng-invalid')
        ?.focus();
      return;
    }

    const input: TeacherInput = this.form.getRawValue();
    const id = this.id();
    const request$ = id ? this.api.update(id, input) : this.api.create(input);

    this.isSaving.set(true);
    request$.subscribe({
      next: (teacher) => {
        this.form.markAsPristine();
        this.notifications.success(
          this.isEdit() ? 'Cadastro atualizado.' : `${teacher.fullName} foi cadastrado(a).`,
        );
        void this.router.navigate(['/teachers']);
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

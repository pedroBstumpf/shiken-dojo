import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ApiError } from '@shared/models/api-error.model';
import { FieldErrorPipe } from '@shared/pipes/field-error.pipe';
import { EnsoLogoComponent } from '@shared/ui/enso-logo.component';

/** Mesmo mínimo do servidor. Sem regras de composição: uma frase longa vale mais. */
export const PASSWORD_MIN_LENGTH = 10;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirmation } = group.value as { password: string; confirmation: string };
  return confirmation && password !== confirmation ? { mismatch: true } : null;
}

@Component({
  selector: 'sd-accept-invite-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    EnsoLogoComponent,
    FieldErrorPipe,
  ],
  templateUrl: './accept-invite-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptInvitePageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  /**
   * O token vem no fragmento (#token=…), que o navegador não envia ao servidor nem no Referer.
   * Depois de lido, sai da barra de endereços e do histórico.
   */
  protected readonly token = new URLSearchParams(
    inject(ActivatedRoute).snapshot.fragment ?? '',
  ).get('token');

  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly isSubmitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      password: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(128)],
      ],
      confirmation: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    inject(Location).replaceState('/accept-invite');
  }

  protected onSubmit(): void {
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.formError.set(null);
    this.auth.acceptInvitation(this.token, this.form.getRawValue().password).subscribe({
      next: (session) => {
        this.notifications.success(`Bem-vindo(a) ao dojo, ${session.teacher.fullName}!`);
        void this.router.navigateByUrl('/');
      },
      error: (error: ApiError) => {
        this.isSubmitting.set(false);
        const passwordError = error.fieldErrors['password'];
        if (passwordError) {
          this.form.controls.password.setErrors({ server: passwordError });
          this.form.controls.password.markAsTouched();
        } else {
          this.formError.set(error.message);
        }
      },
    });
  }
}

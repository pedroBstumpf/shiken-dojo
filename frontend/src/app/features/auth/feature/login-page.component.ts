import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { safeReturnUrl } from '@core/auth/return-url';
import { ApiError } from '@shared/models/api-error.model';
import { FieldErrorPipe } from '@shared/pipes/field-error.pipe';
import { EnsoLogoComponent } from '@shared/ui/enso-logo.component';

@Component({
  selector: 'sd-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    EnsoLogoComponent,
    FieldErrorPipe,
  ],
  templateUrl: './login-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Página que o professor tentou abrir antes do login (?returnUrl=). */
  readonly returnUrl = input<string>();

  protected readonly isSubmitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.formError.set(null);
    this.auth.login(email.trim(), password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (error: ApiError) => {
        this.isSubmitting.set(false);
        // Mensagem genérica do servidor ("E-mail ou senha incorretos."): não revela se a conta existe.
        this.formError.set(error.message);
        this.form.controls.password.reset();
      },
    });
  }
}

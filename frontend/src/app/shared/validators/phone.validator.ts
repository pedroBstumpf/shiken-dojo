import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isValidPhone } from '@shared/utils/phone.utils';

/** Opcional: vazio é aceito; preenchido precisa ter DDD + número. */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    control.value && !isValidPhone(control.value) ? { phone: true } : null;
}

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { endOfDay } from 'date-fns';

export function notInFutureValidator(): ValidatorFn {
  return (control: AbstractControl<Date | null>): ValidationErrors | null => {
    const value = control.value;
    return value instanceof Date && value > endOfDay(new Date()) ? { futureDate: true } : null;
  };
}

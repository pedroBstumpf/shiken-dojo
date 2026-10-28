import { Pipe, PipeTransform } from '@angular/core';
import { ValidationErrors } from '@angular/forms';

/** Traduz os erros de um controle na mensagem a exibir no <mat-error>. */
@Pipe({ name: 'fieldError' })
export class FieldErrorPipe implements PipeTransform {
  transform(errors: ValidationErrors | null | undefined): string {
    if (!errors) return '';
    if (errors['server']) return String(errors['server']);
    if (errors['required']) return 'Campo obrigatório.';
    if (errors['minlength'])
      return `Use pelo menos ${errors['minlength'].requiredLength} caracteres.`;
    if (errors['maxlength'])
      return `Use no máximo ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['min']) return `O valor mínimo é ${errors['min'].min}.`;
    if (errors['max']) return `O valor máximo é ${errors['max'].max}.`;
    if (errors['matDatepickerParse']) return 'Data inválida. Use o formato dd/mm/aaaa.';
    if (errors['futureDate']) return 'A data não pode estar no futuro.';
    return 'Valor inválido.';
  }
}

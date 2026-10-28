import { Pipe, PipeTransform } from '@angular/core';
import { formatGrade } from '@shared/utils/grade.utils';

/** Nota no formato brasileiro: 7 → "7", 7.5 → "7,5". */
@Pipe({ name: 'grade' })
export class GradePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatGrade(value);
  }
}

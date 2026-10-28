import { fromIsoDateOrNull, toIsoDate } from '@shared/utils/date.utils';
import { StudentDto, StudentWriteDto } from './student.dto';
import { Student, StudentInput } from './student.model';

export function toStudent(dto: StudentDto): Student {
  return {
    id: dto.id,
    fullName: dto.fullName,
    belt: dto.belt,
    birthDate: fromIsoDateOrNull(dto.birthDate),
    enrollmentDate: fromIsoDateOrNull(dto.enrollmentDate),
    notes: dto.notes,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function toStudentWriteDto(input: StudentInput): StudentWriteDto {
  return {
    fullName: input.fullName.trim(),
    belt: input.belt,
    birthDate: input.birthDate ? toIsoDate(input.birthDate) : null,
    enrollmentDate: input.enrollmentDate ? toIsoDate(input.enrollmentDate) : null,
    notes: input.notes.trim(),
  };
}

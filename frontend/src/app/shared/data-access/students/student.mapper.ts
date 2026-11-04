import { fromFirestoreDate } from '@shared/data-access/firestore-date';
import { fromIsoDateOrNull, toIsoDate } from '@shared/utils/date.utils';
import { StudentDoc, StudentWriteDoc } from './student.dto';
import { Student, StudentInput } from './student.model';

export function toStudent(id: string, data: StudentDoc): Student {
  return {
    id,
    fullName: data.fullName,
    belt: data.belt,
    birthDate: fromIsoDateOrNull(data.birthDate),
    createdAt: fromFirestoreDate(data.createdAt),
    updatedAt: fromFirestoreDate(data.updatedAt),
  };
}

export function toStudentWriteDoc(input: StudentInput): StudentWriteDoc {
  return {
    fullName: input.fullName.trim(),
    belt: input.belt,
    birthDate: input.birthDate ? toIsoDate(input.birthDate) : null,
  };
}

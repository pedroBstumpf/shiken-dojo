import { fromFirestoreDate } from '@shared/data-access/firestore-date';
import { digitsOnly } from '@shared/utils/phone.utils';
import { TeacherDoc, TeacherWriteDoc } from './teacher.dto';
import { Teacher, TeacherInput } from './teacher.model';

/** O e-mail é normalizado assim em todo lugar: é o identificador do cadastro. */
export function teacherId(email: string): string {
  return email.trim().toLowerCase();
}

export function toTeacher(id: string, data: TeacherDoc): Teacher {
  const belt = data.belt ?? 'preta';
  return {
    id,
    fullName: data.fullName,
    email: id,
    phone: data.phone ?? '',
    role: data.role,
    belt,
    dan: data.dan ?? (belt === 'preta' ? 1 : null),
    federationId: data.federationId ?? '',
    active: data.active,
    invitationPending: data.invitationPending ?? false,
    createdAt: fromFirestoreDate(data.createdAt),
    updatedAt: fromFirestoreDate(data.updatedAt),
  };
}

export function toTeacherWriteDoc(input: TeacherInput): TeacherWriteDoc {
  return {
    fullName: input.fullName.trim(),
    phone: digitsOnly(input.phone),
    role: input.role,
    belt: input.belt,
    // Dan só existe para faixa preta.
    dan: input.belt === 'preta' ? input.dan : null,
    federationId: input.federationId.trim(),
    active: input.active,
  };
}

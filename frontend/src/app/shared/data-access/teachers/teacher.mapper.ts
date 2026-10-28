import { digitsOnly } from '@shared/utils/phone.utils';
import { TeacherDto, TeacherWriteDto } from './teacher.dto';
import { Teacher, TeacherInput } from './teacher.model';

export function toTeacher(dto: TeacherDto): Teacher {
  return { ...dto, createdAt: new Date(dto.createdAt), updatedAt: new Date(dto.updatedAt) };
}

export function toTeacherWriteDto(input: TeacherInput): TeacherWriteDto {
  return {
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: digitsOnly(input.phone),
    role: input.role,
    belt: input.belt,
    // Dan só existe para faixa preta.
    dan: input.belt === 'preta' ? input.dan : null,
    federationId: input.federationId.trim(),
    active: input.active,
  };
}

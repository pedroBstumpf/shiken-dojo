import { Belt } from '@shared/models/belt.model';
import { TeacherRole } from './teacher.model';

export interface TeacherDto {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly role: TeacherRole;
  readonly belt: Belt;
  readonly dan: number | null;
  readonly federationId: string;
  readonly active: boolean;
  /** true enquanto o professor não aceitou o convite (ainda não definiu a senha). */
  readonly invitationPending: boolean;
  /** ISO-8601 em UTC */
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type TeacherWriteDto = Omit<
  TeacherDto,
  'id' | 'invitationPending' | 'createdAt' | 'updatedAt'
>;

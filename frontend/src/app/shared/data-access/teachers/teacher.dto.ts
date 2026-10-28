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
  /** ISO-8601 em UTC */
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type TeacherWriteDto = Omit<TeacherDto, 'id' | 'createdAt' | 'updatedAt'>;

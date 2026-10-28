import { Belt } from '@shared/models/belt.model';

export interface StudentDto {
  readonly id: string;
  readonly fullName: string;
  readonly belt: Belt;
  /** yyyy-MM-dd */
  readonly birthDate: string | null;
  /** yyyy-MM-dd */
  readonly enrollmentDate: string | null;
  readonly notes: string;
  /** ISO-8601 em UTC */
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type StudentWriteDto = Pick<
  StudentDto,
  'fullName' | 'belt' | 'birthDate' | 'enrollmentDate' | 'notes'
>;

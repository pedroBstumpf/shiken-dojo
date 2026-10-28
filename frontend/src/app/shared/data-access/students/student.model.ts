import { Belt } from '@shared/models/belt.model';

export interface Student {
  readonly id: string;
  readonly fullName: string;
  readonly belt: Belt;
  readonly birthDate: Date | null;
  readonly enrollmentDate: Date | null;
  readonly notes: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Campos editáveis pelo professor. */
export type StudentInput = Pick<
  Student,
  'fullName' | 'belt' | 'birthDate' | 'enrollmentDate' | 'notes'
>;

import { Belt } from '@shared/models/belt.model';

export interface Student {
  readonly id: string;
  readonly fullName: string;
  readonly belt: Belt;
  /** A idade é calculada a partir daqui, assim não fica desatualizada. */
  readonly birthDate: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Campos editáveis pelo professor. */
export type StudentInput = Pick<Student, 'fullName' | 'belt' | 'birthDate'>;

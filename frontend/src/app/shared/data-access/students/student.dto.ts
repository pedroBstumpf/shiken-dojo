import { FirestoreDate } from '@shared/data-access/firestore-date';
import { Belt } from '@shared/models/belt.model';

/** Documento em /students/{id}. */
export interface StudentDoc {
  readonly fullName: string;
  readonly belt: Belt;
  /** yyyy-MM-dd */
  readonly birthDate: string | null;
  readonly createdAt: FirestoreDate;
  readonly updatedAt: FirestoreDate;
}

export type StudentWriteDoc = Pick<StudentDoc, 'fullName' | 'belt' | 'birthDate'>;

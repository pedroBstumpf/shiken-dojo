import { FirestoreDate } from '@shared/data-access/firestore-date';
import { Belt } from '@shared/models/belt.model';
import { TeacherRole } from './teacher.model';

/**
 * Documento em /teachers/{e-mail em minúsculas}. Ter este documento, ativo, é o que dá acesso ao
 * sistema. O primeiro professor é criado à mão no console e pode ter só `fullName`, `role` e `active`.
 */
export interface TeacherDoc {
  readonly fullName: string;
  readonly email?: string;
  readonly phone?: string;
  readonly role: TeacherRole;
  readonly belt?: Belt;
  readonly dan?: number | null;
  readonly federationId?: string;
  readonly active: boolean;
  /** true até o primeiro acesso do professor. */
  readonly invitationPending?: boolean;
  readonly createdAt?: FirestoreDate;
  readonly updatedAt?: FirestoreDate;
}

export interface TeacherWriteDoc {
  readonly fullName: string;
  readonly phone: string;
  readonly role: TeacherRole;
  readonly belt: Belt;
  readonly dan: number | null;
  readonly federationId: string;
  readonly active: boolean;
}

import { TeacherRole } from '@shared/data-access/teachers/teacher.model';

/** Professor logado. */
export interface Session {
  readonly teacher: {
    /** O e-mail em minúsculas: é também o identificador do cadastro. */
    readonly id: string;
    readonly fullName: string;
    readonly email: string;
    readonly role: TeacherRole;
  };
}

import { TeacherRole } from '@shared/data-access/teachers/teacher.model';

/** Resposta de /auth/session, /auth/login e /auth/invitations/accept. */
export interface SessionDto {
  readonly teacher: {
    readonly id: string;
    readonly fullName: string;
    readonly email: string;
    readonly role: TeacherRole;
  };
  readonly dojo: { readonly id: string; readonly name: string };
}

/** Professor logado. O cookie de sessão é HttpOnly: o front nunca vê nem guarda o token. */
export type Session = SessionDto;

export interface ActiveSessionDto {
  readonly id: string;
  /** ISO-8601 em UTC */
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly userAgent: string;
  readonly current: boolean;
}

export interface ActiveSession {
  readonly id: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly userAgent: string;
  readonly current: boolean;
}

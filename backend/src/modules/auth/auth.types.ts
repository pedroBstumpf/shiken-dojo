export const TEACHER_ROLES = ['head_instructor', 'instructor'] as const;
export type TeacherRole = (typeof TEACHER_ROLES)[number];

/** Quem está fazendo a requisição. Vem sempre da sessão validada, nunca do cliente. */
export interface AuthContext {
  readonly sessionId: string;
  readonly teacherId: string;
  readonly dojoId: string;
  readonly role: TeacherRole;
}

/** Metadados da requisição usados em sessões e na auditoria. */
export interface RequestMeta {
  readonly ip: string;
  readonly userAgent: string;
}

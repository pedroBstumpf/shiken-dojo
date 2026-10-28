import { Belt } from '@shared/models/belt.model';

export const TEACHER_ROLES = ['head_instructor', 'instructor'] as const;
export type TeacherRole = (typeof TEACHER_ROLES)[number];

export const TEACHER_ROLE_INFO: Readonly<
  Record<TeacherRole, { label: string; description: string }>
> = {
  head_instructor: {
    label: 'Sensei responsável',
    description: 'Responde pelo dojo: gerencia professores e tabelas de avaliação.',
  },
  instructor: {
    label: 'Instrutor(a)',
    description: 'Cadastra alunos e aplica provas de faixa.',
  },
};

/** Graus (dan) possíveis para quem é faixa preta. */
export const DAN_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface Teacher {
  readonly id: string;
  readonly fullName: string;
  /** E-mail de acesso ao sistema (único). */
  readonly email: string;
  /** Somente dígitos, com DDD. Vazio se não informado. */
  readonly phone: string;
  readonly role: TeacherRole;
  readonly belt: Belt;
  /** Grau da faixa preta (1º a 10º dan); null para outras faixas. */
  readonly dan: number | null;
  /** Número de registro na federação/associação. Vazio se não informado. */
  readonly federationId: string;
  /** Inativos continuam no histórico, mas não podem ser escolhidos como examinadores. */
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Campos editáveis. Senha NÃO faz parte do cadastro: o acesso será enviado por convite (ver docs). */
export type TeacherInput = Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>;

export function formatDan(dan: number | null): string {
  return dan === null ? '' : `${dan}º Dan`;
}

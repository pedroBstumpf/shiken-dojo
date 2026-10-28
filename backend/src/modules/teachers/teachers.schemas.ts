import { z } from 'zod';
import { beltSchema, personName, text } from '../../shared/validation/common.js';
import { TEACHER_ROLES } from '../auth/auth.types.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Allowlist do cadastro de professor. Senha não trafega aqui: o acesso é por convite. */
export const teacherWriteSchema = z
  .object({
    fullName: personName(),
    email: z
      .string({ error: 'E-mail inválido.' })
      .transform((value) => value.trim().toLowerCase())
      .pipe(z.string().max(254, 'E-mail inválido.').regex(EMAIL_PATTERN, 'E-mail inválido.')),
    phone: z
      .string({ error: 'Telefone inválido.' })
      .regex(/^(\d{10,11})?$/, 'Telefone inválido.')
      .default(''),
    role: z.enum(TEACHER_ROLES, { error: 'Função inválida.' }),
    belt: beltSchema,
    dan: z.number().int().min(1).max(10).nullable().default(null),
    federationId: text(30).default(''),
    active: z.boolean({ error: 'Situação inválida.' }),
  })
  .superRefine((teacher, ctx) => {
    if (teacher.belt === 'preta' && teacher.dan === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['dan'],
        message: 'Informe o grau (dan) da faixa preta.',
      });
    }
  })
  // Grau só existe para faixa preta.
  .transform((teacher) => ({ ...teacher, dan: teacher.belt === 'preta' ? teacher.dan : null }));
export type TeacherWrite = z.infer<typeof teacherWriteSchema>;

export const teacherSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  role: z.enum(TEACHER_ROLES),
  belt: beltSchema,
  dan: z.number().nullable(),
  federationId: z.string(),
  active: z.boolean(),
  /** true enquanto o professor não aceitou o convite (ainda não tem senha). */
  invitationPending: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TeacherDto = z.infer<typeof teacherSchema>;

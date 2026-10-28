import { z } from 'zod';
import {
  beltSchema,
  pastOrTodayDateSchema,
  personName,
  text,
} from '../../shared/validation/common.js';

/** Allowlist do que o cliente pode gravar: campos fora daqui são descartados. */
export const studentWriteSchema = z.object({
  fullName: personName(),
  belt: beltSchema,
  birthDate: pastOrTodayDateSchema.nullable().default(null),
  enrollmentDate: pastOrTodayDateSchema.nullable().default(null),
  notes: text(500).default(''),
});
export type StudentWrite = z.infer<typeof studentWriteSchema>;

export const studentSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  belt: beltSchema,
  birthDate: z.string().nullable(),
  enrollmentDate: z.string().nullable(),
  notes: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type StudentDto = z.infer<typeof studentSchema>;

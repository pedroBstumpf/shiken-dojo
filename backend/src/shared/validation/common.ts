import { z } from 'zod';

// Schemas reutilizados pelos módulos. Mensagens em português: o front-end as exibe nos campos.

export const BELTS = [
  'branca',
  'amarela',
  'vermelha',
  'laranja',
  'verde',
  'roxa',
  'marrom',
  'preta',
] as const;
export type Belt = (typeof BELTS)[number];

export const beltSchema = z.enum(BELTS, { error: 'Faixa inválida.' });

export const idParamsSchema = z.object({ id: z.uuid() });

/** Texto livre: remove espaços nas pontas e normaliza o Unicode (NFC) antes de validar. */
export function text(maxLength: number, message = `Máximo de ${maxLength} caracteres.`) {
  return z
    .string({ error: 'Valor inválido.' })
    .transform((value) => value.trim().normalize('NFC'))
    .pipe(z.string().max(maxLength, message));
}

export function personName() {
  const message = 'Informe o nome completo (2 a 120 caracteres).';
  return z
    .string({ error: message })
    .transform((value) => value.trim().replace(/\s+/g, ' ').normalize('NFC'))
    .pipe(z.string().min(2, message).max(120, message));
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Data de calendário 'yyyy-MM-dd' que existe de fato (rejeita 2026-02-30). */
export const calendarDateSchema = z
  .string({ error: 'Data inválida.' })
  .regex(DATE_PATTERN, 'Data inválida.')
  .refine(isRealDate, 'Data inválida.');

/** Hoje em UTC, o mesmo fuso das conexões com o banco. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export const pastOrTodayDateSchema = calendarDateSchema.refine(
  (value) => value <= todayUtc(),
  'A data não pode ser no futuro.',
);

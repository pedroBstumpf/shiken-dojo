import { format, isValid, parseISO } from 'date-fns';

/** Datas de calendário (sem horário) trafegam como "yyyy-MM-dd". */
export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromIsoDate(value: string): Date {
  const date = parseISO(value);
  if (!isValid(date)) {
    throw new Error(`Data inválida: ${value}`);
  }
  return date;
}

export function fromIsoDateOrNull(value: string | null): Date | null {
  return value === null ? null : fromIsoDate(value);
}

export function ageInYears(birthDate: Date, today = new Date()): number {
  const age = today.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  return hadBirthday ? age : age - 1;
}

import { format } from 'date-fns';

export interface BackupSource {
  readonly id: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface Backup {
  readonly app: 'ryu-kan';
  readonly version: 1;
  readonly exportedAt: string;
  readonly students: readonly Record<string, unknown>[];
  readonly exams: readonly Record<string, unknown>[];
}

function isTimestamp(value: object): value is { toDate(): Date } {
  return typeof (value as { toDate?: unknown }).toDate === 'function';
}

/** Datas do Firestore viram texto ISO-8601, legível e fácil de restaurar. */
function toPlain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value !== 'object' || value === null) return value;
  if (isTimestamp(value)) return value.toDate().toISOString();
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlain(item)]));
}

function toEntry(source: BackupSource): Record<string, unknown> {
  return { id: source.id, ...(toPlain(source.data) as Record<string, unknown>) };
}

export function buildBackup(
  students: readonly BackupSource[],
  exams: readonly BackupSource[],
  exportedAt: Date,
): Backup {
  return {
    app: 'ryu-kan',
    version: 1,
    exportedAt: exportedAt.toISOString(),
    students: students.map(toEntry),
    exams: exams.map(toEntry),
  };
}

export function backupFileName(date: Date): string {
  return `backup-ryu-kan-${format(date, 'yyyy-MM-dd')}.json`;
}

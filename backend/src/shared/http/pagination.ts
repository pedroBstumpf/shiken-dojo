import { z } from 'zod';
import { AppError } from './app-error.js';

export const MAX_PAGE_SIZE = 100;

/** ?limit=&cursor= — o servidor impõe o tamanho máximo da página (BACKEND.md §3). */
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
  cursor: z.string().max(512).optional(),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

export interface Page<T> {
  readonly items: T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

/** O cursor é opaco para o cliente: a posição da última linha, em base64url. */
export function encodeCursor(position: Record<string, string>): string {
  return Buffer.from(JSON.stringify(position)).toString('base64url');
}

export function decodeCursor<T>(schema: z.ZodType<T>, cursor: string | undefined): T | null {
  if (cursor === undefined) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return schema.parse(decoded);
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Parâmetros inválidos.', {
      cursor: 'Cursor inválido.',
    });
  }
}

/**
 * Monta a página a partir de `limit + 1` linhas buscadas (a linha extra só indica se há mais).
 */
export function toPage<Row, Item>(
  rows: readonly Row[],
  limit: number,
  toItem: (row: Row) => Item,
  toCursor: (row: Row) => Record<string, string>,
): Page<Item> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(toItem),
    nextCursor: hasMore && last ? encodeCursor(toCursor(last)) : null,
    hasMore,
  };
}

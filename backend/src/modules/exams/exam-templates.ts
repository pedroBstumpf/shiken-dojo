import type pg from 'pg';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Queryable } from '../../infra/db/pool.js';
import {
  decodeCursor,
  type Page,
  type PageQuery,
  pageQuerySchema,
  paginatedSchema,
  toPage,
} from '../../shared/http/pagination.js';
import { type Belt, beltSchema } from '../../shared/validation/common.js';
import { authOf } from '../auth/auth.guard.js';
import type { AuthContext } from '../auth/auth.types.js';

export const examSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  kanji: z.string(),
  showTotal: z.boolean(),
  items: z.array(z.object({ id: z.string(), label: z.string() })),
});
export type ExamSection = z.infer<typeof examSectionSchema>;

export const examTemplateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  fromBelt: beltSchema,
  toBelt: beltSchema,
  sections: z.array(examSectionSchema),
});
export type ExamTemplateDto = z.infer<typeof examTemplateSchema>;

interface TemplateRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fromBelt: Belt;
  readonly toBelt: Belt;
  readonly sections: ExamSection[];
}

const COLUMNS = `id, name, description, from_belt AS "fromBelt", to_belt AS "toBelt", sections`;

/** Templates do dojo + os padrões da associação (dojo_id NULL). */
export async function findVisibleTemplate(
  db: Queryable,
  dojoId: string,
  id: string,
): Promise<TemplateRow | null> {
  const { rows } = await db.query<TemplateRow>(
    `SELECT ${COLUMNS} FROM exam_templates
      WHERE id = $1 AND (dojo_id = $2 OR dojo_id IS NULL)`,
    [id, dojoId],
  );
  return rows[0] ?? null;
}

const cursorSchema = z.object({ name: z.string(), id: z.uuid() });

export class ExamTemplatesService {
  constructor(private readonly pool: pg.Pool) {}

  async list(auth: AuthContext, query: PageQuery): Promise<Page<ExamTemplateDto>> {
    const after = decodeCursor(cursorSchema, query.cursor);
    const { rows } = await this.pool.query<TemplateRow>(
      `SELECT ${COLUMNS} FROM exam_templates
        WHERE (dojo_id = $1 OR dojo_id IS NULL)
          AND ($2::text IS NULL OR (name, id) > ($2, $3::uuid))
        ORDER BY name, id
        LIMIT $4`,
      [auth.dojoId, after?.name ?? null, after?.id ?? null, query.limit + 1],
    );
    return toPage(
      rows,
      query.limit,
      (row) => row,
      (row) => ({ name: row.name, id: row.id }),
    );
  }
}

export const examTemplateRoutes: FastifyPluginAsyncZod<{ service: ExamTemplatesService }> = async (
  app,
  options,
) => {
  app.get(
    '/exam-templates',
    {
      schema: {
        tags: ['exams'],
        summary: 'Tabelas de avaliação disponíveis para o dojo',
        querystring: pageQuerySchema,
        response: { 200: paginatedSchema(examTemplateSchema) },
      },
    },
    async (request) => options.service.list(authOf(request), request.query),
  );
};

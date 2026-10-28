import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { pageQuerySchema, paginatedSchema } from '../../shared/http/pagination.js';
import { idParamsSchema } from '../../shared/validation/common.js';
import { authOf, requestMeta } from '../auth/auth.guard.js';
import {
  examCreateSchema,
  examGradesSchema,
  examSchema,
  examSummarySchema,
} from './exams.schemas.js';
import type { ExamsService } from './exams.service.js';

export interface ExamRoutesOptions {
  readonly service: ExamsService;
}

const tags = ['exams'];

export const examRoutes: FastifyPluginAsyncZod<ExamRoutesOptions> = async (app, options) => {
  const { service } = options;

  app.get(
    '/exams',
    {
      schema: {
        tags,
        summary: 'Provas do dojo, mais recentes primeiro',
        querystring: pageQuerySchema,
        response: { 200: paginatedSchema(examSummarySchema) },
      },
    },
    async (request) => service.list(authOf(request), request.query),
  );

  app.get(
    '/exams/:id',
    {
      schema: {
        tags,
        summary: 'Prova completa, com participantes e notas',
        params: idParamsSchema,
        response: { 200: examSchema },
      },
    },
    async (request) => service.get(authOf(request), request.params.id),
  );

  app.post(
    '/exams',
    {
      schema: {
        tags,
        summary: 'Aplicar prova (cria um rascunho)',
        body: examCreateSchema,
        response: { 201: examSchema },
      },
    },
    async (request, reply) => {
      const exam = await service.create(authOf(request), request.body, requestMeta(request));
      return reply.code(201).header('location', `/api/v1/exams/${exam.id}`).send(exam);
    },
  );

  app.put(
    '/exams/:id/grades',
    {
      schema: {
        tags,
        summary: 'Salvar a planilha de notas inteira (idempotente)',
        params: idParamsSchema,
        body: examGradesSchema,
        response: { 200: examSchema },
      },
    },
    async (request) => service.saveGrades(authOf(request), request.params.id, request.body.grades),
  );

  app.post(
    '/exams/:id/complete',
    {
      schema: {
        tags,
        summary: 'Finalizar a prova (exige todas as notas; depois disso é imutável)',
        params: idParamsSchema,
        response: { 200: examSchema },
      },
    },
    async (request) => service.complete(authOf(request), request.params.id, requestMeta(request)),
  );

  app.delete(
    '/exams/:id',
    {
      schema: {
        tags,
        summary: 'Excluir um rascunho de prova',
        params: idParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.remove(authOf(request), request.params.id, requestMeta(request));
      return reply.code(204).send(null);
    },
  );
};

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { pageQuerySchema, paginatedSchema } from '../../shared/http/pagination.js';
import { idParamsSchema } from '../../shared/validation/common.js';
import { authOf, requestMeta } from '../auth/auth.guard.js';
import { studentSchema, studentWriteSchema } from './students.schemas.js';
import type { StudentsService } from './students.service.js';

export interface StudentRoutesOptions {
  readonly service: StudentsService;
}

const tags = ['students'];

export const studentRoutes: FastifyPluginAsyncZod<StudentRoutesOptions> = async (app, options) => {
  const { service } = options;

  app.get(
    '/students',
    {
      schema: {
        tags,
        summary: 'Alunos do dojo, em ordem alfabética',
        querystring: pageQuerySchema,
        response: { 200: paginatedSchema(studentSchema) },
      },
    },
    async (request) => service.list(authOf(request), request.query),
  );

  app.get(
    '/students/:id',
    {
      schema: {
        tags,
        summary: 'Um aluno',
        params: idParamsSchema,
        response: { 200: studentSchema },
      },
    },
    async (request) => service.get(authOf(request), request.params.id),
  );

  app.post(
    '/students',
    {
      schema: {
        tags,
        summary: 'Cadastrar aluno',
        body: studentWriteSchema,
        response: { 201: studentSchema },
      },
    },
    async (request, reply) => {
      const student = await service.create(authOf(request), request.body, requestMeta(request));
      return reply.code(201).header('location', `/api/v1/students/${student.id}`).send(student);
    },
  );

  app.put(
    '/students/:id',
    {
      schema: {
        tags,
        summary: 'Atualizar aluno',
        params: idParamsSchema,
        body: studentWriteSchema,
        response: { 200: studentSchema },
      },
    },
    async (request) =>
      service.update(authOf(request), request.params.id, request.body, requestMeta(request)),
  );

  app.delete(
    '/students/:id',
    {
      schema: {
        tags,
        summary: 'Excluir aluno (o histórico de provas é mantido)',
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

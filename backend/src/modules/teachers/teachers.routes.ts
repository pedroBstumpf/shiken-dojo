import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { pageQuerySchema, paginatedSchema } from '../../shared/http/pagination.js';
import { idParamsSchema } from '../../shared/validation/common.js';
import { authOf, requestMeta } from '../auth/auth.guard.js';
import { teacherSchema, teacherWriteSchema } from './teachers.schemas.js';
import type { TeachersService } from './teachers.service.js';

export interface TeacherRoutesOptions {
  readonly service: TeachersService;
}

const tags = ['teachers'];

export const teacherRoutes: FastifyPluginAsyncZod<TeacherRoutesOptions> = async (app, options) => {
  const { service } = options;

  app.get(
    '/teachers',
    {
      schema: {
        tags,
        summary: 'Professores do dojo, em ordem alfabética',
        querystring: pageQuerySchema,
        response: { 200: paginatedSchema(teacherSchema) },
      },
    },
    async (request) => service.list(authOf(request), request.query),
  );

  app.get(
    '/teachers/:id',
    {
      schema: {
        tags,
        summary: 'Um professor',
        params: idParamsSchema,
        response: { 200: teacherSchema },
      },
    },
    async (request) => service.get(authOf(request), request.params.id),
  );

  app.post(
    '/teachers',
    {
      schema: {
        tags,
        summary: 'Cadastrar professor e enviar o convite (só sensei responsável)',
        body: teacherWriteSchema,
        response: { 201: teacherSchema },
      },
    },
    async (request, reply) => {
      const teacher = await service.create(authOf(request), request.body, requestMeta(request));
      return reply.code(201).header('location', `/api/v1/teachers/${teacher.id}`).send(teacher);
    },
  );

  app.put(
    '/teachers/:id',
    {
      schema: {
        tags,
        summary: 'Atualizar professor (só sensei responsável)',
        params: idParamsSchema,
        body: teacherWriteSchema,
        response: { 200: teacherSchema },
      },
    },
    async (request) =>
      service.update(authOf(request), request.params.id, request.body, requestMeta(request)),
  );

  app.delete(
    '/teachers/:id',
    {
      schema: {
        tags,
        summary: 'Excluir professor (só sensei responsável; prefira desativar)',
        params: idParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.remove(authOf(request), request.params.id, requestMeta(request));
      return reply.code(204).send(null);
    },
  );

  app.post(
    '/teachers/:id/invitation',
    {
      schema: {
        tags,
        summary: 'Reenviar o convite de acesso (só sensei responsável)',
        params: idParamsSchema,
        response: { 202: z.null() },
      },
      config: { rateLimit: { max: 10, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      await service.resendInvitation(authOf(request), request.params.id, requestMeta(request));
      return reply.code(202).send(null);
    },
  );
};

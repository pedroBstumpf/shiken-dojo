import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

/**
 * Contrato OpenAPI 3.1 gerado a partir dos schemas Zod das rotas (BACKEND.md §3):
 * o mesmo schema valida a entrada, filtra a saída e documenta a API.
 */
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Shiken Dojo API',
        description:
          'API do Shiken Dojo: professores, alunos e provas de faixa. ' +
          'Erros seguem o formato Problem Details (RFC 9457).',
        version: '1.0.0',
      },
      servers: [{ url: '/' }],
      tags: [
        { name: 'auth', description: 'Login, sessões e convites' },
        { name: 'teachers', description: 'Professores do dojo' },
        { name: 'students', description: 'Alunos do dojo' },
        { name: 'exams', description: 'Tabelas de avaliação e provas de faixa' },
      ],
      components: {
        securitySchemes: {
          session: { type: 'apiKey', in: 'cookie', name: '__Host-sd_session' },
        },
      },
      security: [{ session: [] }],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
}

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError, VALIDATION_MESSAGE } from './app-error.js';

const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

/** Mensagens genéricas para erros do próprio framework (JSON malformado, corpo grande demais…). */
const FRAMEWORK_MESSAGES: Readonly<Record<number, readonly [code: string, detail: string]>> = {
  400: ['BAD_REQUEST', 'Requisição inválida.'],
  404: ['NOT_FOUND', 'Recurso não encontrado.'],
  405: ['METHOD_NOT_ALLOWED', 'Método não permitido.'],
  406: ['NOT_ACCEPTABLE', 'Formato de resposta não suportado.'],
  413: ['PAYLOAD_TOO_LARGE', 'Os dados enviados passam do tamanho permitido.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'Formato de envio não suportado.'],
  429: ['RATE_LIMITED', 'Muitas tentativas seguidas. Aguarde um instante e tente novamente.'],
};

interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly traceId: string;
  readonly errors?: Readonly<Record<string, string>>;
}

export function sendProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  error: AppError,
): FastifyReply {
  const body: ProblemDetails = {
    type: `https://shiken-dojo.app/errors/${error.code.toLowerCase()}`,
    title: error.detail,
    status: error.status,
    code: error.code,
    detail: error.detail,
    traceId: request.id,
    ...(error.fieldErrors ? { errors: error.fieldErrors } : {}),
  };
  if (error.headers) reply.headers(error.headers);
  // Serializa à mão: a resposta de erro não passa pelo schema da rota.
  return reply
    .code(error.status)
    .type(PROBLEM_CONTENT_TYPE)
    .serializer((payload: unknown) => JSON.stringify(payload))
    .send(body);
}

/** Converte "/participants/0/name" em "participants.0.name" (chave usada pelo front-end). */
function fieldKey(instancePath: string): string {
  return instancePath.replace(/^\//, '').replaceAll('/', '.') || '_';
}

function toAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;

  if (hasZodFastifySchemaValidationErrors(error)) {
    const context = (error as FastifyError).validationContext;
    // ID malformado na URL equivale a "não existe".
    if (context === 'params') return new AppError(404, 'NOT_FOUND', 'Recurso não encontrado.');
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.validation) {
      fieldErrors[fieldKey(issue.instancePath)] ??= issue.message ?? 'Valor inválido.';
    }
    return context === 'body'
      ? new AppError(422, 'VALIDATION_FAILED', VALIDATION_MESSAGE, fieldErrors)
      : new AppError(400, 'BAD_REQUEST', 'Parâmetros inválidos.', fieldErrors);
  }

  const status = (error as Partial<FastifyError>).statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const [code, detail] = FRAMEWORK_MESSAGES[status] ?? ['BAD_REQUEST', 'Requisição inválida.'];
    return new AppError(status, code, detail);
  }
  return null;
}

/**
 * Handler global (BACKEND.md §15): erros esperados viram 4xx com log em nível baixo;
 * inesperados viram 500 genérico, sem stack trace, SQL ou nomes internos na resposta.
 */
export function errorHandler(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  const expected = toAppError(error);
  if (expected) {
    request.log.info({ code: expected.code, status: expected.status }, 'Requisição recusada');
    return sendProblem(request, reply, expected);
  }
  request.log.error({ err: error }, 'Erro inesperado');
  return sendProblem(
    request,
    reply,
    new AppError(
      500,
      'INTERNAL_ERROR',
      'Algo deu errado do nosso lado. Tente novamente em alguns instantes.',
    ),
  );
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return sendProblem(request, reply, new AppError(404, 'NOT_FOUND', 'Recurso não encontrado.'));
}

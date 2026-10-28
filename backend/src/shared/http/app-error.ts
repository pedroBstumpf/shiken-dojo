/**
 * Erro esperado da aplicação. O handler global o converte em Problem Details (RFC 9457).
 * `code` é estável e usado pelo front-end para lógica; `detail` é a mensagem para humanos.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
    readonly fieldErrors?: Readonly<Record<string, string>>,
    readonly headers?: Readonly<Record<string, string>>,
  ) {
    super(detail);
    this.name = 'AppError';
  }
}

export const VALIDATION_MESSAGE = 'Alguns campos precisam ser corrigidos.';

export function validationFailed(fieldErrors: Readonly<Record<string, string>>): AppError {
  return new AppError(422, 'VALIDATION_FAILED', VALIDATION_MESSAGE, fieldErrors);
}

export function notFound(code = 'NOT_FOUND', detail = 'Recurso não encontrado.'): AppError {
  return new AppError(404, code, detail);
}

export function unauthorized(
  code = 'UNAUTHENTICATED',
  detail = 'Sua sessão expirou. Entre novamente para continuar.',
): AppError {
  return new AppError(401, code, detail);
}

export function forbidden(detail = 'Você não tem permissão para realizar esta ação.'): AppError {
  return new AppError(403, 'FORBIDDEN', detail);
}

export function conflict(
  code: string,
  detail: string,
  fieldErrors?: Readonly<Record<string, string>>,
): AppError {
  return new AppError(409, code, detail, fieldErrors);
}

export function tooManyRequests(retryAfterSeconds: number): AppError {
  return new AppError(
    429,
    'RATE_LIMITED',
    'Muitas tentativas seguidas. Aguarde um instante e tente novamente.',
    undefined,
    { 'retry-after': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  );
}

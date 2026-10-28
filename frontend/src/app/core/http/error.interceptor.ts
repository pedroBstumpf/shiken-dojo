import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { ApiError, ProblemDetailsDto } from '@shared/models/api-error.model';
import { catchError, throwError } from 'rxjs';

const FALLBACK_MESSAGES: Readonly<Record<number, string>> = {
  0: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
  401: 'Sua sessão expirou. Entre novamente para continuar.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'Não encontramos o que você procurava.',
  429: 'Muitas tentativas seguidas. Aguarde um instante e tente novamente.',
};

/** Converte qualquer erro HTTP em ApiError, para os componentes lidarem com um só formato. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const problem = (
        typeof error.error === 'object' && error.error !== null ? error.error : {}
      ) as ProblemDetailsDto;
      const message =
        problem.detail ??
        FALLBACK_MESSAGES[error.status] ??
        'Algo deu errado do nosso lado. Tente novamente em alguns instantes.';
      return throwError(
        () =>
          new ApiError(
            error.status,
            problem.code ?? `HTTP_${error.status}`,
            message,
            problem.errors ?? {},
          ),
      );
    }),
  );

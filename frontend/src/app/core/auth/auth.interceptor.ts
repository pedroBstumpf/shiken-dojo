import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { API_BASE_URL } from '@shared/data-access/api-base-url.token';
import { ApiError } from '@shared/models/api-error.model';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { safeReturnUrl } from './return-url';

/**
 * Sessão expirada no meio do uso (401): esquece a sessão local e leva ao login, preservando a
 * página atual. Deve vir antes do errorInterceptor, para receber o erro já como ApiError.
 * As rotas de /auth tratam o próprio 401 (ex.: senha errada no login).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const authUrl = `${inject(API_BASE_URL)}/auth/`;

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof ApiError && error.status === 401 && !req.url.startsWith(authUrl)) {
        auth.clear();
        if (!router.url.startsWith('/login')) {
          void router.navigate(['/login'], {
            queryParams: { returnUrl: safeReturnUrl(router.url) },
          });
        }
      }
      return throwError(() => error);
    }),
  );
};

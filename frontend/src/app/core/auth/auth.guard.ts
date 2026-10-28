import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Rotas que exigem login. Guard não é segurança (quem decide é a API); ele só evita mostrar
 * telas que responderiam 401 e leva o professor ao login, voltando depois para onde estava.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toLogin = router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return auth.restore().pipe(
    map((session) => (session ? true : toLogin)),
    catchError(() => of(toLogin)),
  );
};

/** Login e convite: quem já está logado vai direto para o início. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.restore().pipe(
    map((session) => (session ? router.createUrlTree(['/']) : true)),
    catchError(() => of(true)),
  );
};

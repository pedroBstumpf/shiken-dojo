import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Rotas que exigem login. Guard não é segurança (quem decide são as regras do Firestore); ele só
 * evita mostrar telas sem permissão e leva o professor ao login, voltando depois para onde estava.
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

/** Editar professores: só o sensei responsável (as regras do Firestore também recusam). */
export const headInstructorGuard: CanActivateFn = () =>
  inject(AuthService).isHeadInstructor() ? true : inject(Router).createUrlTree(['/teachers']);

/** Login: quem já está logado vai direto para o início. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.restore().pipe(
    map((session) => (session ? router.createUrlTree(['/']) : true)),
    catchError(() => of(true)),
  );
};

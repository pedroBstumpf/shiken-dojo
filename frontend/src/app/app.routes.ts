import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('@features/auth/feature/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    // Sem guard: o link do convite precisa funcionar mesmo com outra sessão aberta no navegador.
    path: 'accept-invite',
    title: 'Definir senha',
    loadComponent: () =>
      import('@features/auth/feature/accept-invite-page.component').then(
        (m) => m.AcceptInvitePageComponent,
      ),
  },
  {
    // Tudo daqui para baixo exige professor logado.
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Início',
        loadComponent: () =>
          import('@features/dashboard/dashboard-page.component').then(
            (m) => m.DashboardPageComponent,
          ),
      },
      {
        path: 'teachers',
        loadChildren: () =>
          import('@features/teachers/teachers.routes').then((m) => m.TEACHERS_ROUTES),
      },
      {
        path: 'students',
        loadChildren: () =>
          import('@features/students/students.routes').then((m) => m.STUDENTS_ROUTES),
      },
      {
        path: 'exams',
        loadChildren: () => import('@features/exams/exams.routes').then((m) => m.EXAMS_ROUTES),
      },
      {
        path: 'history',
        loadChildren: () => import('@features/exams/exams.routes').then((m) => m.HISTORY_ROUTES),
      },
      {
        path: 'account/sessions',
        title: 'Sessões ativas',
        loadComponent: () =>
          import('@features/auth/feature/sessions-page.component').then(
            (m) => m.SessionsPageComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    title: 'Página não encontrada',
    loadComponent: () =>
      import('@core/layout/not-found.component').then((m) => m.NotFoundComponent),
  },
];

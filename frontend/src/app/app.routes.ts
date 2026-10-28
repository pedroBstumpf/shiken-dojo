import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Início',
    loadComponent: () =>
      import('@features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
  {
    path: 'students',
    loadChildren: () => import('@features/students/students.routes').then((m) => m.STUDENTS_ROUTES),
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
    path: '**',
    title: 'Página não encontrada',
    loadComponent: () =>
      import('@core/layout/not-found.component').then((m) => m.NotFoundComponent),
  },
];

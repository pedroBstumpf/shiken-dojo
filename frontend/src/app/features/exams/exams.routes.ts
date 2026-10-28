import { Routes } from '@angular/router';
import { canLeaveGuard } from '@shared/guards/can-leave.guard';

/** Aplicação de provas: configurar e avaliar. */
export const EXAMS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'new' },
  {
    path: 'new',
    title: 'Aplicar prova',
    loadComponent: () =>
      import('./feature/exam-setup-page.component').then((m) => m.ExamSetupPageComponent),
  },
  {
    path: ':id/grade',
    title: 'Avaliação',
    canDeactivate: [canLeaveGuard],
    loadComponent: () =>
      import('./feature/exam-grading-page.component').then((m) => m.ExamGradingPageComponent),
  },
];

/** Histórico de provas aplicadas. */
export const HISTORY_ROUTES: Routes = [
  {
    path: '',
    title: 'Histórico de provas',
    loadComponent: () =>
      import('./feature/exam-history-page.component').then((m) => m.ExamHistoryPageComponent),
  },
  {
    path: ':id',
    title: 'Resultado da prova',
    loadComponent: () =>
      import('./feature/exam-detail-page.component').then((m) => m.ExamDetailPageComponent),
  },
];

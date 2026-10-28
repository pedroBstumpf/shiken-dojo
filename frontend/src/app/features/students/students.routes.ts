import { Routes } from '@angular/router';
import { canLeaveGuard } from '@shared/guards/can-leave.guard';

export const STUDENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Alunos',
    loadComponent: () =>
      import('./feature/student-list-page.component').then((m) => m.StudentListPageComponent),
  },
  {
    path: 'new',
    title: 'Cadastrar aluno',
    canDeactivate: [canLeaveGuard],
    loadComponent: () =>
      import('./feature/student-form-page.component').then((m) => m.StudentFormPageComponent),
  },
  {
    path: ':id/edit',
    title: 'Editar aluno',
    canDeactivate: [canLeaveGuard],
    loadComponent: () =>
      import('./feature/student-form-page.component').then((m) => m.StudentFormPageComponent),
  },
];

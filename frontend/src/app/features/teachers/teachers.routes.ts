import { Routes } from '@angular/router';
import { canLeaveGuard } from '@shared/guards/can-leave.guard';

export const TEACHERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Professores',
    loadComponent: () =>
      import('./feature/teacher-list-page.component').then((m) => m.TeacherListPageComponent),
  },
  {
    path: 'new',
    title: 'Cadastrar professor',
    canDeactivate: [canLeaveGuard],
    loadComponent: () =>
      import('./feature/teacher-form-page.component').then((m) => m.TeacherFormPageComponent),
  },
  {
    path: ':id/edit',
    title: 'Editar professor',
    canDeactivate: [canLeaveGuard],
    loadComponent: () =>
      import('./feature/teacher-form-page.component').then((m) => m.TeacherFormPageComponent),
  },
];

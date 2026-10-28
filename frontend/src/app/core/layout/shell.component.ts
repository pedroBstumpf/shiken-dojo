import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { TEACHER_ROLE_INFO } from '@shared/data-access/teachers/teacher.model';
import { EnsoLogoComponent } from '@shared/ui/enso-logo.component';
import { InitialsAvatarComponent } from '@shared/ui/initials-avatar.component';
import { filter, skip } from 'rxjs';
import { ThemeService } from './theme.service';

interface NavLink {
  readonly path: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: string;
  readonly exact: boolean;
}

@Component({
  selector: 'sd-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    EnsoLogoComponent,
    InitialsAvatarComponent,
  ],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col' },
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly roleInfo = TEACHER_ROLE_INFO;

  protected readonly links: readonly NavLink[] = [
    { path: '/', label: 'Início', shortLabel: 'Início', icon: 'temple_buddhist', exact: true },
    { path: '/students', label: 'Alunos', shortLabel: 'Alunos', icon: 'groups', exact: false },
    {
      path: '/teachers',
      label: 'Professores',
      shortLabel: 'Senseis',
      icon: 'person_book',
      exact: false,
    },
    {
      path: '/exams',
      label: 'Aplicar prova',
      shortLabel: 'Prova',
      icon: 'sports_martial_arts',
      exact: false,
    },
    {
      path: '/history',
      label: 'Histórico',
      shortLabel: 'Histórico',
      icon: 'history_edu',
      exact: false,
    },
  ];

  protected logout(): void {
    // Recarrega a página ao sair: nada da sessão anterior (listas, notas) fica na memória.
    const leave = () => this.document.location.assign('/login');
    this.auth.logout().subscribe({ complete: leave, error: leave });
  }

  constructor() {
    // Ao trocar de página, leva o foco ao título (leitores de tela anunciam a nova página).
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        setTimeout(() =>
          this.document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }),
        );
      });
  }
}

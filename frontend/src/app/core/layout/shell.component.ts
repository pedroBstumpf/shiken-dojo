import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EnsoLogoComponent } from '@shared/ui/enso-logo.component';
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
    MatTooltipModule,
    EnsoLogoComponent,
  ],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col' },
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly theme = inject(ThemeService);

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

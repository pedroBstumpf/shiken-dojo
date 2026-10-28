import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EnsoLogoComponent } from '@shared/ui/enso-logo.component';

@Component({
  selector: 'sd-not-found',
  imports: [RouterLink, MatButtonModule, EnsoLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-center py-16 text-center' },
  template: `
    <sd-enso-logo [size]="96" class="mb-6" />
    <h1 class="text-3xl font-bold" tabindex="-1">Página não encontrada</h1>
    <p class="mt-3 max-w-md text-on-surface-variant">
      O caminho que você seguiu não leva a nenhum lugar do dojo. Volte ao início e recomece.
    </p>
    <a matButton="filled" routerLink="/" class="mt-6">Voltar ao início</a>
  `,
})
export class NotFoundComponent {}

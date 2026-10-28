import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'sd-error-state',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'bg-error-container text-on-error-container flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center',
    role: 'alert',
  },
  template: `
    <mat-icon class="sd-icon-lg" aria-hidden="true">cloud_off</mat-icon>
    <h2 class="text-lg font-bold">{{ title() }}</h2>
    <p class="max-w-md">{{ message() }}</p>
    <button matButton="outlined" type="button" (click)="retry.emit()">
      <mat-icon aria-hidden="true">refresh</mat-icon>
      Tentar novamente
    </button>
  `,
})
export class ErrorStateComponent {
  readonly title = input('Não foi possível carregar');
  readonly message = input.required<string>();

  readonly retry = output();
}

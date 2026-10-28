import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EnsoLogoComponent } from './enso-logo.component';

@Component({
  selector: 'sd-empty-state',
  imports: [MatButtonModule, MatIconModule, EnsoLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'border-outline-variant flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center',
  },
  template: `
    <sd-enso-logo [size]="72" class="mb-4 opacity-80" />
    <h2 class="text-xl font-bold text-on-surface">{{ title() }}</h2>
    @if (description()) {
      <p class="mt-2 max-w-md text-on-surface-variant">{{ description() }}</p>
    }
    @if (actionLabel()) {
      <button matButton="filled" class="mt-6" type="button" (click)="action.emit()">
        @if (actionIcon()) {
          <mat-icon aria-hidden="true">{{ actionIcon() }}</mat-icon>
        }
        {{ actionLabel() }}
      </button>
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly actionLabel = input('');
  readonly actionIcon = input('');

  readonly action = output();
}

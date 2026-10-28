import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Belt } from '@shared/models/belt.model';
import { BeltBadgeComponent } from './belt-badge.component';

@Component({
  selector: 'sd-belt-transition',
  imports: [BeltBadgeComponent, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-wrap items-center gap-1' },
  template: `
    <sd-belt-badge [belt]="from()" />
    <mat-icon class="sd-icon-sm text-on-surface-variant" aria-hidden="true">arrow_forward</mat-icon>
    <span class="sr-only">para</span>
    <sd-belt-badge [belt]="to()" />
  `,
})
export class BeltTransitionComponent {
  readonly from = input.required<Belt>();
  readonly to = input.required<Belt>();
}

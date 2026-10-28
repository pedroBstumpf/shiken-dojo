import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Belt, BELT_INFO } from '@shared/models/belt.model';

/** Faixa (obi) desenhada com nó, seguida do nome da cor. */
@Component({
  selector: 'sd-belt-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-1.5 align-middle' },
  template: `
    <svg viewBox="0 0 40 14" class="h-3.5 w-10 shrink-0" aria-hidden="true">
      <rect
        x="1"
        y="3.5"
        width="38"
        height="7"
        rx="2"
        [attr.fill]="info().color"
        [attr.stroke]="info().edge"
        stroke-width="1"
      />
      <path
        d="M17 3 l-4 10 h4 l3-5 3 5 h4 l-4-10z"
        [attr.fill]="info().color"
        [attr.stroke]="info().edge"
        stroke-width="1"
        stroke-linejoin="round"
      />
      <rect
        x="16.5"
        y="2.5"
        width="7"
        height="9"
        rx="1.5"
        [attr.fill]="info().color"
        [attr.stroke]="info().edge"
        stroke-width="1"
      />
    </svg>
    @if (showLabel()) {
      <span class="text-sm">{{ info().label }}</span>
    } @else {
      <span class="sr-only">Faixa {{ info().label }}</span>
    }
  `,
})
export class BeltBadgeComponent {
  readonly belt = input.required<Belt>();
  readonly showLabel = input(true);

  protected readonly info = computed(() => BELT_INFO[this.belt()]);
}

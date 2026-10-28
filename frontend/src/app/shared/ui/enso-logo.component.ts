import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Ensō (círculo zen pintado a pincel) com o sol vermelho ao centro. */
@Component({
  selector: 'sd-enso-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block shrink-0 text-ink',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
  template: `
    <svg viewBox="0 0 64 64" class="h-full w-full" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="24"
        fill="none"
        stroke="currentColor"
        stroke-width="5"
        stroke-linecap="round"
        stroke-dasharray="132 19"
        transform="rotate(-62 32 32)"
      />
      <circle
        cx="32"
        cy="32"
        r="20.5"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.3"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-dasharray="70 70"
        transform="rotate(-20 32 32)"
      />
      <circle cx="32" cy="32" r="10" fill="var(--sd-hanko)" />
    </svg>
  `,
})
export class EnsoLogoComponent {
  readonly size = input(40);
}

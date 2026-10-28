import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Traço de pincel usado como sublinhado de títulos. */
@Component({
  selector: 'sd-brush-stroke',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block text-primary', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 200 12" preserveAspectRatio="none" class="h-full w-full">
      <path
        d="M2 7C30 3 90 1.5 150 2.8 176 3.4 192 4.8 198 6.6 186 8 160 8.6 140 9 90 10.4 40 10.6 2 7Z"
        fill="currentColor"
      />
    </svg>
  `,
})
export class BrushStrokeComponent {}

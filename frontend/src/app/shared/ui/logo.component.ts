import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Logo da academia Ryu-kan. Decorativa: onde ela leva a algum lugar, o link tem o próprio rótulo. */
@Component({
  selector: 'sd-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block shrink-0',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
  template: `<img src="logo-ryu-kan.png" alt="" class="h-full w-full object-contain" />`,
})
export class LogoComponent {
  readonly size = input(48);
}

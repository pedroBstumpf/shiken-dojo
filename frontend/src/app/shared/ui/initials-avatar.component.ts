import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initials } from '@shared/utils/text.utils';

@Component({
  selector: 'sd-initials-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'bg-primary-container text-on-primary-container font-display inline-grid shrink-0 place-items-center rounded-full font-bold',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.38',
    'aria-hidden': 'true',
  },
  template: `{{ letters() }}`,
})
export class InitialsAvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(40);

  protected readonly letters = computed(() => initials(this.name()));
}

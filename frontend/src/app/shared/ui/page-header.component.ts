import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BrushStrokeComponent } from './brush-stroke.component';

/**
 * Cabeçalho de página: título com traço de pincel, kanji decorativo ao fundo
 * e espaço para ações (conteúdo projetado com o atributo `actions`).
 */
@Component({
  selector: 'sd-page-header',
  imports: [BrushStrokeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // overflow-clip (e não hidden): hidden permite rolagem programática, e o foco nos botões deslocava o título.
  host: { class: 'relative mb-6 block overflow-clip' },
  template: `
    <span
      class="pointer-events-none absolute -top-4 right-0 font-display text-8xl leading-none text-on-surface/5 select-none writing-vertical sm:text-9xl"
      aria-hidden="true"
      >{{ kanji() }}</span
    >
    <div class="relative flex flex-col gap-4 py-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-1 text-sm font-medium tracking-wide text-primary">
          <span class="font-display" aria-hidden="true">{{ kanji() }}</span>
          @if (kanjiReading()) {
            <span aria-hidden="true"> · </span><span>{{ kanjiReading() }}</span>
          }
        </p>
        <h1 class="text-3xl font-bold text-on-surface sm:text-4xl" tabindex="-1">{{ title() }}</h1>
        <sd-brush-stroke class="mt-1 h-2.5 w-28" />
        @if (description()) {
          <p class="mt-3 max-w-prose text-on-surface-variant">{{ description() }}</p>
        }
      </div>
      <div class="flex flex-wrap gap-2">
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly kanji = input('');
  readonly kanjiReading = input('');
  readonly description = input('');
}

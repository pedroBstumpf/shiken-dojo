import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'sd-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemPrefersDark = signal(this.matchDark()?.matches ?? false);
  private readonly _preference = signal<ThemePreference>(this.readPreference());

  readonly preference = this._preference.asReadonly();
  readonly isDark = computed(() => {
    const preference = this._preference();
    return preference === 'system' ? this.systemPrefersDark() : preference === 'dark';
  });

  constructor() {
    this.matchDark()?.addEventListener('change', (event) =>
      this.systemPrefersDark.set(event.matches),
    );

    // O tema Material usa light-dark(), então basta trocar color-scheme no <html>.
    effect(() => {
      const preference = this._preference();
      const root = this.document.documentElement;
      root.style.colorScheme = preference === 'system' ? 'light dark' : preference;
      root.dataset['theme'] = preference;
      this.writePreference(preference);
    });
  }

  toggle(): void {
    this._preference.set(this.isDark() ? 'light' : 'dark');
  }

  private matchDark(): MediaQueryList | undefined {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  }

  private readPreference(): ThemePreference {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private writePreference(preference: ThemePreference): void {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Preferência visual apenas; sem storage o app segue funcionando.
    }
  }
}

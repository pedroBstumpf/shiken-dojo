import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Session } from '@core/auth/auth.model';
import { AuthService } from '@core/auth/auth.service';
import { AppComponent } from './app.component';

const SESSION: Session = {
  teacher: {
    id: 'tch-001',
    fullName: 'Hiroshi Okada',
    email: 'okada@dojo.exemplo',
    role: 'head_instructor',
  },
  dojo: { id: 'dojo-001', name: 'Dojo Hien' },
};

async function render(session: Session | null): Promise<HTMLElement> {
  const state = signal(session);
  await TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      {
        provide: AuthService,
        useValue: { session: state, isAuthenticated: () => state() !== null },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AppComponent);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('AppComponent', () => {
  it('mostra a marca e a navegação principal para o professor logado', async () => {
    const element = await render(SESSION);
    expect(element.textContent).toContain('Shiken Dojo');
    expect(element.querySelectorAll('nav[aria-label="Navegação principal"]').length).toBe(2);
    expect(element.textContent).toContain('Histórico');
    expect(element.querySelector('[aria-label="Conta de Hiroshi Okada"]')).not.toBeNull();
  });

  it('esconde a navegação antes do login', async () => {
    const element = await render(null);
    expect(element.textContent).toContain('Shiken Dojo');
    expect(element.querySelectorAll('nav[aria-label="Navegação principal"]').length).toBe(0);
  });
});

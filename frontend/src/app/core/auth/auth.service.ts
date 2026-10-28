import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_BASE_URL } from '@shared/data-access/api-base-url.token';
import { ApiError } from '@shared/models/api-error.model';
import { catchError, finalize, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { ActiveSession, ActiveSessionDto, Session, SessionDto } from './auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/auth`;

  private readonly _session = signal<Session | null>(null);
  private restoring$: Observable<Session | null> | null = null;

  readonly session = this._session.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly isHeadInstructor = computed(() => this._session()?.teacher.role === 'head_instructor');

  /**
   * Descobre se o navegador já tem uma sessão válida (cookie HttpOnly). Chamadas simultâneas
   * (ex.: guard + shell) compartilham a mesma requisição.
   */
  restore(): Observable<Session | null> {
    const current = this._session();
    if (current) return of(current);
    this.restoring$ ??= this.http.get<SessionDto>(`${this.url}/session`).pipe(
      tap((session) => this._session.set(session)),
      catchError((error: unknown) =>
        error instanceof ApiError && error.status === 401 ? of(null) : throwError(() => error),
      ),
      finalize(() => (this.restoring$ = null)),
      shareReplay(1),
    );
    return this.restoring$;
  }

  login(email: string, password: string): Observable<Session> {
    return this.http
      .post<SessionDto>(`${this.url}/login`, { email, password })
      .pipe(tap((session) => this._session.set(session)));
  }

  /** Define a senha pelo link do convite e já entra no sistema. */
  acceptInvitation(token: string, password: string): Observable<Session> {
    return this.http
      .post<SessionDto>(`${this.url}/invitations/accept`, { token, password })
      .pipe(tap((session) => this._session.set(session)));
  }

  /** Encerra a sessão no servidor (não só no navegador). */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, {}).pipe(finalize(() => this.clear()));
  }

  /** Esquece a sessão local (ex.: o servidor respondeu 401). */
  clear(): void {
    this._session.set(null);
  }

  listSessions(): Observable<readonly ActiveSession[]> {
    return this.http.get<{ items: readonly ActiveSessionDto[] }>(`${this.url}/sessions`).pipe(
      map(({ items }) =>
        items.map((dto) => ({
          ...dto,
          createdAt: new Date(dto.createdAt),
          lastSeenAt: new Date(dto.lastSeenAt),
        })),
      ),
    );
  }

  revokeSession(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/sessions/${encodeURIComponent(id)}`);
  }
}

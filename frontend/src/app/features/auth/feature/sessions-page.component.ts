import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActiveSession } from '@core/auth/auth.model';
import { AuthService } from '@core/auth/auth.service';
import { NotificationService } from '@core/notifications/notification.service';
import { ApiError } from '@shared/models/api-error.model';
import { ErrorStateComponent } from '@shared/ui/error-state.component';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { describeUserAgent } from '../data-access/user-agent';

@Component({
  selector: 'sd-sessions-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, PageHeaderComponent, ErrorStateComponent],
  templateUrl: './sessions-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsPageComponent {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  protected readonly sessions = rxResource({ stream: () => this.auth.listSessions() });
  protected readonly revoking = signal<string | null>(null);
  protected readonly describe = describeUserAgent;

  protected revoke(session: ActiveSession): void {
    this.revoking.set(session.id);
    this.auth.revokeSession(session.id).subscribe({
      next: () => {
        this.revoking.set(null);
        this.notifications.success('Sessão encerrada.');
        this.sessions.reload();
      },
      error: (error: ApiError) => {
        this.revoking.set(null);
        this.notifications.error(error.message);
      },
    });
  }
}

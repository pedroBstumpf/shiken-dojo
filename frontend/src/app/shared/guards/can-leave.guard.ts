import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

/** Páginas com dados não salvos implementam esta interface. */
export interface CanLeave {
  canLeave(): boolean | Observable<boolean>;
}

export const canLeaveGuard: CanDeactivateFn<CanLeave> = (component) => component.canLeave();

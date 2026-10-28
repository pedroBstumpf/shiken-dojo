import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 4000 });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 8000, politeness: 'assertive' });
  }

  /** Mostra a mensagem com "Desfazer". Emite true se o usuário desfez, false se o prazo acabou. */
  withUndo(message: string): Observable<boolean> {
    return this.snackBar
      .open(message, 'Desfazer', { duration: 6000 })
      .afterDismissed()
      .pipe(map(({ dismissedByAction }) => dismissedByAction));
  }
}

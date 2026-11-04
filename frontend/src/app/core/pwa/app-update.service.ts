import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';

/**
 * O app abre a partir da cópia guardada no dispositivo. Quando há uma versão nova publicada, ela
 * é baixada em segundo plano e o professor escolhe a hora de atualizar: recarregar sem avisar
 * poderia interromper uma prova em andamento.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);
  private readonly document = inject(DOCUMENT);

  start(): void {
    if (!this.updates.isEnabled) return;

    this.updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.snackBar
          .open('Há uma nova versão do Ryu-kan.', 'Atualizar')
          .onAction()
          .subscribe(() => this.document.location.reload());
      }
    });

    // A cópia guardada ficou inutilizável (ex.: o navegador apagou parte dela): recarrega da rede.
    this.updates.unrecoverable.subscribe(() => this.document.location.reload());

    // Quem deixa o app aberto no celular também recebe as atualizações ao voltar para ele.
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        void this.updates.checkForUpdate().catch(() => undefined);
      }
    });
  }
}

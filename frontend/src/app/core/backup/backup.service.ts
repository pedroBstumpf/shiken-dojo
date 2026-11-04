import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { firebaseCall } from '@core/firebase/firebase-call';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { collection, getDocsFromServer } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { buildBackup, backupFileName } from './backup';

/** Baixa uma cópia dos alunos e das provas: o plano gratuito do Firebase não faz backup sozinho. */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly db = inject(FIRESTORE);
  private readonly document = inject(DOCUMENT);

  download(): Observable<void> {
    return firebaseCall(async () => {
      // Direto do servidor: um backup feito da cópia local poderia sair incompleto, sem aviso.
      const [students, exams] = await Promise.all([
        getDocsFromServer(collection(this.db, 'students')),
        getDocsFromServer(collection(this.db, 'exams')),
      ]);
      const now = new Date();
      const backup = buildBackup(
        students.docs.map((item) => ({ id: item.id, data: item.data() })),
        exams.docs.map((item) => ({ id: item.id, data: item.data() })),
        now,
      );
      const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(file);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = backupFileName(now);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url));
    });
  }
}

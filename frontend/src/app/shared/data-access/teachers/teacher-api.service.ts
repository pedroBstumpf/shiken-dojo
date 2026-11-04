import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { loginActionSettings } from '@core/auth/auth-action';
import { firebaseCall, readBack, settleWrite } from '@core/firebase/firebase-call';
import { AUTH_EMULATOR_URL, FIREBASE_AUTH, FIRESTORE } from '@core/firebase/firebase.providers';
import { environment } from '@env/environment';
import { ApiError } from '@shared/models/api-error.model';
import { deleteApp, FirebaseError, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { TeacherDoc } from './teacher.dto';
import { teacherId, toTeacher, toTeacherWriteDoc } from './teacher.mapper';
import { Teacher, TeacherInput } from './teacher.model';

const ESTIMATE = { serverTimestamps: 'estimate' } as const;

/** O cadastro foi criado, mas o e-mail do convite não saiu. */
export const INVITATION_EMAIL_FAILED = 'INVITATION_EMAIL_FAILED';

@Injectable({ providedIn: 'root' })
export class TeacherApiService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly origin = inject(DOCUMENT).location.origin;
  private readonly teachers = collection(this.db, 'teachers');

  /** Em ordem alfabética. */
  list(): Observable<readonly Teacher[]> {
    return firebaseCall(async () => {
      const snapshot = await getDocs(this.teachers);
      return snapshot.docs
        .map((item) => toTeacher(item.id, item.data(ESTIMATE) as TeacherDoc))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
    });
  }

  get(id: string): Observable<Teacher> {
    return firebaseCall(async () => {
      const snapshot = await getDoc(doc(this.teachers, id));
      if (!snapshot.exists()) {
        throw new ApiError(404, 'TEACHER_NOT_FOUND', 'Professor não encontrado.');
      }
      return toTeacher(snapshot.id, snapshot.data(ESTIMATE) as TeacherDoc);
    });
  }

  /**
   * Convida um professor: cria o login (com uma senha aleatória que ninguém conhece), grava o
   * cadastro e envia o e-mail do Firebase para ele definir a própria senha. O login vem antes
   * porque sozinho não dá acesso a nada: quem autoriza é o cadastro, validado pelas regras.
   */
  create(input: TeacherInput): Observable<Teacher> {
    return firebaseCall(async () => {
      const id = teacherId(input.email);
      const ref = doc(this.teachers, id);
      await this.createLogin(id);
      await runTransaction(this.db, async (transaction) => {
        if ((await transaction.get(ref)).exists()) {
          throw new ApiError(409, 'EMAIL_TAKEN', 'Já existe um professor com este e-mail.', {
            email: 'Já existe um professor com este e-mail.',
          });
        }
        transaction.set(ref, {
          ...toTeacherWriteDoc(input),
          email: id,
          invitationPending: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await this.sendInvitationEmail(id);
      // Direto do servidor: gravações em transação não aparecem na cópia local até a próxima leitura.
      const snapshot = await getDoc(ref);
      return toTeacher(snapshot.id, snapshot.data(ESTIMATE) as TeacherDoc);
    });
  }

  /** O e-mail não muda: é o identificador do login. */
  update(id: string, input: TeacherInput): Observable<Teacher> {
    return firebaseCall(async () => {
      const ref = doc(this.teachers, id);
      await settleWrite(
        updateDoc(ref, { ...toTeacherWriteDoc(input), updatedAt: serverTimestamp() }),
      );
      return this.read(ref);
    });
  }

  /** Envia um novo link para definir a senha. */
  resendInvitation(id: string): Observable<void> {
    return firebaseCall(async () => {
      await this.createLogin(id);
      await this.sendInvitationEmail(id);
    });
  }

  /** Tira o acesso na hora. O login continua existindo, sem acesso, e pode ser convidado de novo. */
  remove(id: string): Observable<void> {
    return firebaseCall(() => settleWrite(deleteDoc(doc(this.teachers, id))));
  }

  private async read(ref: DocumentReference): Promise<Teacher> {
    const snapshot = await readBack(ref);
    return toTeacher(snapshot.id, snapshot.data(ESTIMATE) as TeacherDoc);
  }

  private async sendInvitationEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email, loginActionSettings(this.origin));
    } catch {
      throw new ApiError(
        503,
        INVITATION_EMAIL_FAILED,
        'O professor foi cadastrado, mas o e-mail não saiu. Peça para usar "Esqueci minha senha" na tela de login.',
      );
    }
  }

  /**
   * Usa uma instância separada do Firebase: criar uma conta faz login nela, e isso não pode
   * trocar o professor que está usando o app. Nada desta instância fica salvo no dispositivo.
   */
  private async createLogin(email: string): Promise<void> {
    const app = initializeApp(environment.firebase, `invitation-${crypto.randomUUID()}`);
    try {
      const auth = initializeAuth(app, { persistence: inMemoryPersistence });
      if (environment.useEmulators) {
        connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
      }
      await createUserWithEmailAndPassword(auth, email, randomPassword());
    } catch (error) {
      // Já tem login (ex.: foi excluído e está sendo convidado de novo): basta enviar o link.
      if (!(error instanceof FirebaseError && error.code === 'auth/email-already-in-use')) {
        throw error;
      }
    } finally {
      await deleteApp(app);
    }
  }
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

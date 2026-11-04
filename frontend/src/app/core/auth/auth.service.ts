import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firebaseCall, settleWrite } from '@core/firebase/firebase-call';
import { FIREBASE_AUTH, FIRESTORE } from '@core/firebase/firebase.providers';
import { TeacherDoc } from '@shared/data-access/teachers/teacher.dto';
import { toTeacher } from '@shared/data-access/teachers/teacher.mapper';
import { ApiError } from '@shared/models/api-error.model';
import { FirebaseError } from 'firebase/app';
import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  terminate,
  updateDoc,
  waitForPendingWrites,
} from 'firebase/firestore';
import { finalize, Observable, of, shareReplay } from 'rxjs';
import { loginActionSettings } from './auth-action';
import { Session } from './auth.model';
import { safeReturnUrl } from './return-url';

const PENDING_WRITES_TIMEOUT_MS = 3_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly db = inject(FIRESTORE);
  private readonly router = inject(Router);
  private readonly origin = inject(DOCUMENT).location.origin;

  private readonly _session = signal<Session | null>(null);
  private restoring$: Observable<Session | null> | null = null;

  readonly session = this._session.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly isHeadInstructor = computed(() => this._session()?.teacher.role === 'head_instructor');

  constructor() {
    // Acesso encerrado em outra aba ou revogado no servidor: volta ao login.
    onAuthStateChanged(this.auth, (user) => {
      if (!user && this._session()) {
        this.clear();
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: safeReturnUrl(this.router.url) },
        });
      }
    });
  }

  /** Descobre se o dispositivo já tem um login válido. Chamadas simultâneas compartilham o resultado. */
  restore(): Observable<Session | null> {
    const current = this._session();
    if (current) return of(current);
    this.restoring$ ??= firebaseCall(() => this.restoreSession()).pipe(
      finalize(() => (this.restoring$ = null)),
      shareReplay(1),
    );
    return this.restoring$;
  }

  login(email: string, password: string): Observable<Session> {
    return firebaseCall(async () => {
      const { user } = await signInWithEmailAndPassword(this.auth, email, password);
      if (!user.emailVerified) {
        // Só quem comprovou ser dono do e-mail acessa os dados (regra também no servidor).
        await sendEmailVerification(user, loginActionSettings(this.origin));
        await signOut(this.auth);
        throw new ApiError(
          403,
          'EMAIL_NOT_VERIFIED',
          'Enviamos um link de confirmação para o seu e-mail. Confirme e entre novamente.',
        );
      }
      return this.startSession(user);
    });
  }

  /** Por segurança, a resposta é a mesma exista ou não uma conta com esse e-mail. */
  sendPasswordReset(email: string): Observable<void> {
    return firebaseCall(() =>
      sendPasswordResetEmail(
        this.auth,
        email.trim().toLowerCase(),
        loginActionSettings(this.origin),
      ),
    );
  }

  /** Encerra o login e apaga a cópia local dos dados deste dispositivo. */
  logout(): Observable<void> {
    return firebaseCall(async () => {
      const synced = await Promise.race([
        waitForPendingWrites(this.db).then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), PENDING_WRITES_TIMEOUT_MS),
        ),
      ]);
      if (!synced) {
        throw new ApiError(
          0,
          'PENDING_WRITES',
          'Há dados ainda não enviados. Conecte-se à internet antes de sair para não perdê-los.',
        );
      }
      this.clear();
      await signOut(this.auth);
      await terminate(this.db);
      // Falha se houver outra aba aberta; nesse caso a cópia é apagada no próximo logout.
      await clearIndexedDbPersistence(this.db).catch(() => undefined);
    });
  }

  clear(): void {
    this._session.set(null);
  }

  private async restoreSession(): Promise<Session | null> {
    await this.auth.authStateReady();
    const user = this.auth.currentUser;
    if (!user?.emailVerified) return null;
    try {
      return await this.startSession(user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) return null;
      throw error;
    }
  }

  /** Só entra quem tem cadastro ativo: a conta de login sozinha não dá acesso a nada. */
  private async startSession(user: User): Promise<Session> {
    const email = (user.email ?? '').toLowerCase();
    const ref = doc(this.db, 'teachers', email);
    const snapshot = await getDoc(ref).catch((error: unknown) => {
      if (error instanceof FirebaseError && error.code === 'permission-denied') return null;
      throw error;
    });
    const data = snapshot?.exists() ? (snapshot.data() as TeacherDoc) : null;

    if (!data?.active) {
      await signOut(this.auth);
      throw data
        ? new ApiError(403, 'INACTIVE', 'Seu cadastro está inativo. Fale com o sensei responsável.')
        : new ApiError(
            403,
            'NO_ACCESS',
            'Este e-mail não está cadastrado como professor. Peça um convite a um professor do dojo.',
          );
    }

    if (data.invitationPending) {
      // Primeiro acesso: o convite deixa de aparecer como pendente na lista de professores.
      await settleWrite(
        updateDoc(ref, { invitationPending: false, updatedAt: serverTimestamp() }),
      ).catch(() => undefined);
    }

    const teacher = toTeacher(email, data);
    const session: Session = {
      teacher: {
        id: teacher.id,
        fullName: teacher.fullName,
        email: teacher.email,
        role: teacher.role,
      },
    };
    this._session.set(session);
    void this.keepOfflineCopy();
    return session;
  }

  /** Sem isso, uma tela nunca aberta com internet (ex.: Alunos) apareceria vazia quando offline. */
  private async keepOfflineCopy(): Promise<void> {
    if (!navigator.onLine) return;
    await Promise.all(
      ['students', 'teachers', 'exams'].map((name) => getDocs(collection(this.db, name))),
    ).catch(() => undefined);
  }
}

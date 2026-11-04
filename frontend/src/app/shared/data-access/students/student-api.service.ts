import { inject, Injectable } from '@angular/core';
import { firebaseCall, readBack, settleWrite } from '@core/firebase/firebase-call';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { ApiError } from '@shared/models/api-error.model';
import {
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { StudentDoc } from './student.dto';
import { toStudent, toStudentWriteDoc } from './student.mapper';
import { Student, StudentInput } from './student.model';

const ESTIMATE = { serverTimestamps: 'estimate' } as const;

@Injectable({ providedIn: 'root' })
export class StudentApiService {
  private readonly db = inject(FIRESTORE);
  private readonly students = collection(this.db, 'students');

  /** Em ordem alfabética. */
  list(): Observable<readonly Student[]> {
    return firebaseCall(async () => {
      const snapshot = await getDocs(this.students);
      return snapshot.docs
        .map((item) => toStudent(item.id, item.data(ESTIMATE) as StudentDoc))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
    });
  }

  get(id: string): Observable<Student> {
    return firebaseCall(async () => {
      const snapshot = await getDoc(doc(this.students, id));
      if (!snapshot.exists()) {
        throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Aluno não encontrado.');
      }
      return toStudent(snapshot.id, snapshot.data(ESTIMATE) as StudentDoc);
    });
  }

  create(input: StudentInput): Observable<Student> {
    return firebaseCall(async () => {
      const ref = doc(this.students);
      await settleWrite(
        setDoc(ref, {
          ...toStudentWriteDoc(input),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
      return this.read(ref);
    });
  }

  update(id: string, input: StudentInput): Observable<Student> {
    return firebaseCall(async () => {
      const ref = doc(this.students, id);
      await settleWrite(
        updateDoc(ref, { ...toStudentWriteDoc(input), updatedAt: serverTimestamp() }),
      );
      return this.read(ref);
    });
  }

  /** O histórico de provas é mantido: cada prova guarda uma cópia do nome e da faixa do aluno. */
  remove(id: string): Observable<void> {
    return firebaseCall(() => settleWrite(deleteDoc(doc(this.students, id))));
  }

  private async read(ref: DocumentReference): Promise<Student> {
    const snapshot = await readBack(ref);
    return toStudent(snapshot.id, snapshot.data(ESTIMATE) as StudentDoc);
  }
}

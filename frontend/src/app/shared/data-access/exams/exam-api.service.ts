import { inject, Injectable } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { firebaseCall, readBack, settleWrite } from '@core/firebase/firebase-call';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { StudentDoc } from '@shared/data-access/students/student.dto';
import { TeacherDoc } from '@shared/data-access/teachers/teacher.dto';
import { ApiError } from '@shared/models/api-error.model';
import { toIsoDate } from '@shared/utils/date.utils';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { gradingProgress } from './exam-scoring';
import { EXAM_TEMPLATES } from './exam-templates';
import { ExamDoc } from './exam.dto';
import { toExam, toExamSummary } from './exam.mapper';
import {
  Exam,
  ExamParticipant,
  ExamPdfVariant,
  ExamSetup,
  ExamSummary,
  ExamTemplate,
  GradeSheet,
} from './exam.model';

const ESTIMATE = { serverTimestamps: 'estimate' } as const;

/** Prova lida de um PDF do próprio app, já validada. */
export type ImportedExam = Omit<Exam, 'updatedAt' | 'createdAt'>;

@Injectable({ providedIn: 'root' })
export class ExamApiService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);
  private readonly exams = collection(this.db, 'exams');

  listTemplates(): Observable<readonly ExamTemplate[]> {
    return of(EXAM_TEMPLATES);
  }

  /** Mais recentes primeiro. */
  list(): Observable<readonly ExamSummary[]> {
    return firebaseCall(async () => {
      const snapshot = await getDocs(this.exams);
      return snapshot.docs
        .map((item) => toExamSummary(toExam(item.id, item.data(ESTIMATE) as ExamDoc)))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
    });
  }

  get(id: string): Observable<Exam> {
    return firebaseCall(() => this.read(id));
  }

  /** Guarda uma cópia dos alunos, do examinador e da tabela como estão hoje. */
  create(setup: ExamSetup): Observable<Exam> {
    return firebaseCall(async () => {
      const template = EXAM_TEMPLATES.find((item) => item.id === setup.templateId);
      if (!template)
        throw new ApiError(422, 'INVALID_TEMPLATE', 'Escolha uma tabela de avaliação.');

      const examiner = await getDoc(doc(this.db, 'teachers', setup.examinerId));
      const examinerData = examiner.data() as TeacherDoc | undefined;
      if (!examinerData?.active) {
        throw new ApiError(
          422,
          'INVALID_EXAMINER',
          'Selecione um professor ativo como examinador.',
        );
      }

      const students = await Promise.all(
        setup.studentIds.map((id) => getDoc(doc(this.db, 'students', id))),
      );
      const participants: ExamParticipant[] = students.flatMap((student) => {
        const data = student.data() as StudentDoc | undefined;
        return data ? [{ studentId: student.id, fullName: data.fullName, belt: data.belt }] : [];
      });
      if (participants.length !== setup.studentIds.length || participants.length === 0) {
        throw new ApiError(422, 'INVALID_STUDENTS', 'Selecione alunos cadastrados para a prova.');
      }

      const ref = doc(this.exams);
      await settleWrite(
        setDoc(ref, {
          status: 'draft',
          templateId: template.id,
          templateName: template.name,
          fromBelt: template.fromBelt,
          toBelt: template.toBelt,
          sections: template.sections,
          date: toIsoDate(setup.date),
          location: setup.location.trim(),
          examinerId: examiner.id,
          examinerName: examinerData.fullName,
          passingGrade: setup.passingGrade,
          notes: setup.notes.trim(),
          participants,
          grades: {},
          completedAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
      return this.readLocal(ref.id);
    });
  }

  /** Substitui a planilha inteira. As regras recusam se a prova já estiver finalizada. */
  saveGrades(id: string, grades: GradeSheet): Observable<Exam> {
    return firebaseCall(async () => {
      await settleWrite(updateDoc(doc(this.exams, id), { grades, updatedAt: serverTimestamp() }));
      return this.readLocal(id);
    });
  }

  /** Depois de finalizada, a prova não pode mais ser alterada nem excluída. */
  complete(id: string): Observable<Exam> {
    return firebaseCall(async () => {
      const exam = await this.readLocal(id);
      const { graded, total } = gradingProgress(
        exam.sections,
        exam.participants.map((participant) => participant.studentId),
        exam.grades,
      );
      if (graded < total) {
        throw new ApiError(422, 'EXAM_INCOMPLETE', 'Lance todas as notas antes de finalizar.');
      }
      await settleWrite(
        updateDoc(doc(this.exams, id), {
          status: 'completed',
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
      return this.readLocal(id);
    });
  }

  remove(id: string): Observable<void> {
    return firebaseCall(() => settleWrite(deleteDoc(doc(this.exams, id))));
  }

  /** Registra o PDF gerado: a importação só aceita arquivos cujo conteúdo esteja neste registro. */
  registerPdfExport(hash: string, examId: string, variant: ExamPdfVariant): Promise<void> {
    return settleWrite(
      setDoc(doc(this.db, 'pdfExports', hash), {
        examId,
        variant,
        createdBy: this.auth.session()?.teacher.id ?? '',
        createdAt: serverTimestamp(),
      }),
    );
  }

  async isRegisteredPdfExport(hash: string): Promise<boolean> {
    return (await getDoc(doc(this.db, 'pdfExports', hash))).exists();
  }

  /** Nunca sobrescreve: se a prova já existe no sistema, ela prevalece sobre o conteúdo do PDF. */
  importExam(exam: ImportedExam): Promise<{ readonly created: boolean }> {
    const ref = doc(this.exams, exam.id);
    return runTransaction(this.db, async (transaction) => {
      if ((await transaction.get(ref)).exists()) return { created: false };
      transaction.set(ref, {
        status: exam.status,
        templateId: exam.templateId,
        templateName: exam.templateName,
        fromBelt: exam.fromBelt,
        toBelt: exam.toBelt,
        sections: exam.sections,
        date: toIsoDate(exam.date),
        location: exam.location,
        examinerId: exam.examinerId,
        examinerName: exam.examinerName,
        passingGrade: exam.passingGrade,
        notes: exam.notes,
        participants: exam.participants,
        grades: exam.grades,
        completedAt: exam.completedAt ? Timestamp.fromDate(exam.completedAt) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { created: true };
    });
  }

  private async read(id: string): Promise<Exam> {
    const snapshot = await getDoc(doc(this.exams, id));
    if (!snapshot.exists()) {
      throw new ApiError(404, 'EXAM_NOT_FOUND', 'Prova não encontrada.');
    }
    return toExam(snapshot.id, snapshot.data(ESTIMATE) as ExamDoc);
  }

  private async readLocal(id: string): Promise<Exam> {
    const snapshot = await readBack(doc(this.exams, id));
    if (!snapshot.exists()) {
      throw new ApiError(404, 'EXAM_NOT_FOUND', 'Prova não encontrada.');
    }
    return toExam(snapshot.id, snapshot.data(ESTIMATE) as ExamDoc);
  }
}

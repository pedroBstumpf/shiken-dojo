import { FirestoreDate } from '@shared/data-access/firestore-date';
import { Belt } from '@shared/models/belt.model';
import { ExamParticipant, ExamSection, ExamStatus, GradeSheet } from './exam.model';

/** Documento em /exams/{id}. Guarda cópias: o histórico não muda se os cadastros mudarem. */
export interface ExamDoc {
  readonly status: ExamStatus;
  readonly templateId: string;
  readonly templateName: string;
  readonly fromBelt: Belt;
  readonly toBelt: Belt;
  readonly sections: readonly ExamSection[];
  /** yyyy-MM-dd */
  readonly date: string;
  readonly location: string;
  readonly examinerId: string | null;
  readonly examinerName: string;
  readonly passingGrade: number;
  readonly notes: string;
  readonly participants: readonly ExamParticipant[];
  readonly grades: GradeSheet;
  readonly createdAt: FirestoreDate;
  readonly updatedAt: FirestoreDate;
  readonly completedAt: FirestoreDate;
}

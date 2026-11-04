import { fromFirestoreDate } from '@shared/data-access/firestore-date';
import { fromIsoDate } from '@shared/utils/date.utils';
import { gradingProgress, studentResult } from './exam-scoring';
import { ExamDoc } from './exam.dto';
import { Exam, ExamSummary } from './exam.model';

export function toExam(id: string, data: ExamDoc): Exam {
  return {
    id,
    status: data.status,
    templateId: data.templateId,
    templateName: data.templateName,
    fromBelt: data.fromBelt,
    toBelt: data.toBelt,
    sections: data.sections,
    date: fromIsoDate(data.date),
    location: data.location,
    examinerId: data.examinerId,
    examinerName: data.examinerName,
    passingGrade: data.passingGrade,
    notes: data.notes,
    participants: data.participants,
    grades: data.grades,
    createdAt: fromFirestoreDate(data.createdAt),
    updatedAt: fromFirestoreDate(data.updatedAt),
    completedAt: data.completedAt ? fromFirestoreDate(data.completedAt) : null,
  };
}

export function toExamSummary(exam: Exam): ExamSummary {
  const studentIds = exam.participants.map((participant) => participant.studentId);
  const { graded, total } = gradingProgress(exam.sections, studentIds, exam.grades);
  return {
    id: exam.id,
    status: exam.status,
    templateName: exam.templateName,
    fromBelt: exam.fromBelt,
    toBelt: exam.toBelt,
    date: exam.date,
    location: exam.location,
    examinerName: exam.examinerName,
    participantCount: studentIds.length,
    approvedCount: studentIds.filter(
      (id) =>
        studentResult(exam.sections, exam.grades[id], exam.passingGrade).status === 'approved',
    ).length,
    gradedCount: graded,
    totalCount: total,
  };
}

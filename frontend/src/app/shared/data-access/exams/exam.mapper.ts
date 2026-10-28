import { fromIsoDate, toIsoDate } from '@shared/utils/date.utils';
import { ExamCreateDto, ExamDto, ExamSummaryDto } from './exam.dto';
import { Exam, ExamSetup, ExamSummary } from './exam.model';

export function toExam(dto: ExamDto): Exam {
  return {
    ...dto,
    date: fromIsoDate(dto.date),
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    completedAt: dto.completedAt === null ? null : new Date(dto.completedAt),
  };
}

export function toExamSummary(dto: ExamSummaryDto): ExamSummary {
  return { ...dto, date: fromIsoDate(dto.date) };
}

export function toExamCreateDto(setup: ExamSetup): ExamCreateDto {
  return {
    templateId: setup.templateId,
    date: toIsoDate(setup.date),
    location: setup.location.trim(),
    examinerId: setup.examinerId,
    passingGrade: setup.passingGrade,
    notes: setup.notes.trim(),
    studentIds: setup.studentIds,
  };
}

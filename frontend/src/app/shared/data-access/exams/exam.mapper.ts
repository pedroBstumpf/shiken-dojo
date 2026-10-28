import { fromIsoDate, toIsoDate } from '@shared/utils/date.utils';
import { EmailDeliveryDto, ExamCreateDto, ExamDto, ExamSummaryDto } from './exam.dto';
import { EmailDelivery, Exam, ExamSetup, ExamSummary } from './exam.model';

export function toEmailDelivery(dto: EmailDeliveryDto): EmailDelivery {
  return { ...dto, sentAt: new Date(dto.sentAt) };
}

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

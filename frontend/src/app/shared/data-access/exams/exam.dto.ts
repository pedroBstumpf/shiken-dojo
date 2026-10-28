import { Belt } from '@shared/models/belt.model';
import { ExamParticipant, ExamSection, ExamStatus, ExamTemplate, GradeSheet } from './exam.model';

// Templates, seções e participantes não têm datas: o formato da API é o mesmo do modelo.
export type ExamTemplateDto = ExamTemplate;
export type ExamSectionDto = ExamSection;
export type ExamParticipantDto = ExamParticipant;

export interface ExamDto {
  readonly id: string;
  readonly status: ExamStatus;
  readonly templateId: string;
  readonly templateName: string;
  readonly fromBelt: Belt;
  readonly toBelt: Belt;
  readonly sections: readonly ExamSectionDto[];
  /** yyyy-MM-dd */
  readonly date: string;
  readonly location: string;
  readonly examinerId: string;
  readonly examinerName: string;
  readonly passingGrade: number;
  readonly notes: string;
  readonly participants: readonly ExamParticipantDto[];
  readonly grades: GradeSheet;
  /** ISO-8601 em UTC */
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface ExamSummaryDto {
  readonly id: string;
  readonly status: ExamStatus;
  readonly templateName: string;
  readonly fromBelt: Belt;
  readonly toBelt: Belt;
  readonly date: string;
  readonly location: string;
  readonly examinerName: string;
  readonly participantCount: number;
  readonly approvedCount: number;
  readonly gradedCount: number;
  readonly totalCount: number;
}

export interface ExamCreateDto {
  readonly templateId: string;
  readonly date: string;
  readonly location: string;
  /** O servidor grava também o nome do professor (retrato para o histórico). */
  readonly examinerId: string;
  readonly passingGrade: number;
  readonly notes: string;
  readonly studentIds: readonly string[];
}

export interface EmailDeliveryDto {
  readonly recipientEmail: string;
  /** ISO-8601 em UTC */
  readonly sentAt: string;
  readonly simulated: boolean;
}

export interface ExamGradesDto {
  readonly grades: GradeSheet;
}

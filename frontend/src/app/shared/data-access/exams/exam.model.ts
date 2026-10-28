import { Belt } from '@shared/models/belt.model';

export interface ExamItem {
  readonly id: string;
  /** Técnica avaliada, ex.: "Maegueri/zenkutso". */
  readonly label: string;
}

export interface ExamSection {
  readonly id: string;
  readonly title: string;
  /** Kanji decorativo exibido ao lado do título, ex.: 基本 (kihon). */
  readonly kanji: string;
  /** Se a tabela mostra a linha "Total" ao fim do bloco (como no formulário em papel). */
  readonly showTotal: boolean;
  readonly items: readonly ExamItem[];
}

export interface ExamTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fromBelt: Belt;
  readonly toBelt: Belt;
  readonly sections: readonly ExamSection[];
}

/** Retrato do aluno no dia da prova: o histórico não muda se o cadastro mudar depois. */
export interface ExamParticipant {
  readonly studentId: string;
  readonly fullName: string;
  readonly belt: Belt;
}

/** itemId → nota */
export type StudentGrades = Readonly<Record<string, number>>;
/** studentId → itemId → nota */
export type GradeSheet = Readonly<Record<string, StudentGrades>>;

export type ExamStatus = 'draft' | 'completed';

export interface Exam {
  readonly id: string;
  readonly status: ExamStatus;
  readonly templateId: string;
  readonly templateName: string;
  readonly fromBelt: Belt;
  readonly toBelt: Belt;
  readonly sections: readonly ExamSection[];
  readonly date: Date;
  readonly location: string;
  /** null se o professor examinador foi excluído. */
  readonly examinerId: string | null;
  /** Retrato do nome do examinador no dia da prova. */
  readonly examinerName: string;
  readonly passingGrade: number;
  readonly notes: string;
  readonly participants: readonly ExamParticipant[];
  readonly grades: GradeSheet;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

export interface ExamSummary {
  readonly id: string;
  readonly status: ExamStatus;
  readonly templateName: string;
  readonly fromBelt: Belt;
  readonly toBelt: Belt;
  readonly date: Date;
  readonly location: string;
  readonly examinerName: string;
  readonly participantCount: number;
  readonly approvedCount: number;
  readonly gradedCount: number;
  readonly totalCount: number;
}

/** "filled": com as notas lançadas (o que falta fica em branco); "blank": folha vazia para preencher à mão. */
export type ExamPdfVariant = 'filled' | 'blank';

export interface ExamEmailRequest {
  /** O PDF só pode ir para o e-mail de um professor cadastrado — nunca para um endereço livre. */
  readonly teacherId: string;
  readonly variant: ExamPdfVariant;
  readonly file: Blob;
  readonly fileName: string;
}

export interface EmailDelivery {
  readonly recipientEmail: string;
  readonly sentAt: Date;
  /** true enquanto não há servidor de e-mail (API simulada): nada foi enviado de fato. */
  readonly simulated: boolean;
}

export interface ExamSetup {
  readonly templateId: string;
  readonly date: Date;
  readonly location: string;
  readonly examinerId: string;
  readonly passingGrade: number;
  readonly notes: string;
  readonly studentIds: readonly string[];
}

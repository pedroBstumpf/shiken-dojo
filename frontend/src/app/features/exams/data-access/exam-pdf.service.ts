import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Exam, ExamPdfVariant } from '@shared/data-access/exams/exam.model';
import { buildExamSheet, examPdfFileName } from './exam-sheet';

export interface ExamPdfFile {
  readonly file: Blob;
  readonly fileName: string;
}

@Injectable({ providedIn: 'root' })
export class ExamPdfService {
  private readonly document = inject(DOCUMENT);

  /** Gera o PDF no navegador. O jsPDF só é baixado na primeira vez que alguém exporta. */
  async create(exam: Exam, variant: ExamPdfVariant): Promise<ExamPdfFile> {
    const { renderExamPdf } = await import('./exam-pdf');
    return {
      file: renderExamPdf(buildExamSheet(exam, variant)),
      fileName: examPdfFileName(exam, variant),
    };
  }

  async download(exam: Exam, variant: ExamPdfVariant): Promise<void> {
    const { file, fileName } = await this.create(exam, variant);
    const url = URL.createObjectURL(file);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }
}

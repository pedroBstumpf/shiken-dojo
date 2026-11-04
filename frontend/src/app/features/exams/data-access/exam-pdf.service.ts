import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { toApiError } from '@core/firebase/firebase-call';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { Exam, ExamPdfVariant } from '@shared/data-access/exams/exam.model';
import { ApiError } from '@shared/models/api-error.model';
import {
  decodeExamPdfData,
  encodeExamPdfData,
  extractExamPdfData,
  MAX_IMPORT_BYTES,
  sha256Hex,
} from './exam-pdf-data';
import { buildExamSheet, examPdfFileName } from './exam-sheet';

export interface ExamPdfFile {
  readonly file: Blob;
  readonly fileName: string;
}

export interface ExamPdfImport {
  readonly examId: string;
  /** false quando a prova já existia no sistema: nada foi alterado. */
  readonly created: boolean;
}

const NOT_RECOGNIZED = () =>
  new ApiError(
    422,
    'PDF_NOT_RECOGNIZED',
    'Este arquivo não é um PDF gerado pelo Shiken Dojo, ou foi alterado depois de exportado.',
  );

@Injectable({ providedIn: 'root' })
export class ExamPdfService {
  private readonly document = inject(DOCUMENT);
  private readonly examApi = inject(ExamApiService);

  /** Gera o PDF no navegador. O jsPDF só é baixado na primeira vez que alguém exporta. */
  async create(exam: Exam, variant: ExamPdfVariant): Promise<ExamPdfFile> {
    const { renderExamPdf } = await import('./exam-pdf');
    const { encoded, metadata } = encodeExamPdfData(exam, variant, crypto.randomUUID());
    await this.examApi.registerPdfExport(await sha256Hex(encoded), exam.id, variant);
    return {
      file: renderExamPdf(buildExamSheet(exam, variant), new Date(), metadata),
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

  /** Celular e alguns navegadores abrem a tela de compartilhar (WhatsApp, e-mail…). */
  canShare(): boolean {
    const navigator = this.document.defaultView?.navigator;
    const probe = new File([], 'prova.pdf', { type: 'application/pdf' });
    return !!navigator?.canShare?.({ files: [probe] });
  }

  async share(exam: Exam, variant: ExamPdfVariant): Promise<void> {
    const { file, fileName } = await this.create(exam, variant);
    const shared = new File([file], fileName, { type: 'application/pdf' });
    await this.document.defaultView?.navigator.share({ files: [shared], title: fileName });
  }

  /** Aceita só PDFs gerados pelo próprio app e registrados no momento da exportação. */
  async importFile(file: File): Promise<ExamPdfImport> {
    if (file.size > MAX_IMPORT_BYTES) throw NOT_RECOGNIZED();
    const encoded = extractExamPdfData(new Uint8Array(await file.arrayBuffer()));
    if (!encoded) throw NOT_RECOGNIZED();
    try {
      if (!(await this.examApi.isRegisteredPdfExport(await sha256Hex(encoded)))) {
        throw NOT_RECOGNIZED();
      }
      const exam = decodeExamPdfData(encoded);
      if (!exam) throw NOT_RECOGNIZED();
      const { created } = await this.examApi.importExam(exam);
      return { examId: exam.id, created };
    } catch (error) {
      throw toApiError(error);
    }
  }
}

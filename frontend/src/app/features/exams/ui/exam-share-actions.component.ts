import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NotificationService } from '@core/notifications/notification.service';
import { Exam, ExamPdfVariant } from '@shared/data-access/exams/exam.model';
import { ExamPdfService } from '../data-access/exam-pdf.service';

/** Botões "Exportar PDF" e "Compartilhar" de uma prova (completa ou não). */
@Component({
  selector: 'sd-exam-share-actions',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sd-no-print flex flex-wrap gap-2' },
  template: `
    <button
      matButton="outlined"
      type="button"
      [matMenuTriggerFor]="pdfMenu"
      [disabled]="isExporting()"
    >
      <mat-icon aria-hidden="true">{{
        isExporting() ? 'hourglass_top' : 'picture_as_pdf'
      }}</mat-icon>
      {{ isExporting() ? 'Gerando PDF…' : 'Exportar PDF' }}
    </button>
    <mat-menu #pdfMenu="matMenu" xPosition="before">
      <button mat-menu-item type="button" (click)="onDownload('filled')">
        <mat-icon aria-hidden="true">grading</mat-icon>
        <span>Com as notas lançadas</span>
      </button>
      <button mat-menu-item type="button" (click)="onDownload('blank')">
        <mat-icon aria-hidden="true">check_box_outline_blank</mat-icon>
        <span>Em branco, para preencher à mão</span>
      </button>
    </mat-menu>

    @if (canShare) {
      <button
        matButton="outlined"
        type="button"
        [matMenuTriggerFor]="shareMenu"
        [disabled]="isExporting()"
      >
        <mat-icon aria-hidden="true">share</mat-icon>
        Compartilhar
      </button>
      <mat-menu #shareMenu="matMenu" xPosition="before">
        <button mat-menu-item type="button" (click)="onShare('filled')">
          <mat-icon aria-hidden="true">grading</mat-icon>
          <span>Com as notas lançadas</span>
        </button>
        <button mat-menu-item type="button" (click)="onShare('blank')">
          <mat-icon aria-hidden="true">check_box_outline_blank</mat-icon>
          <span>Em branco, para preencher à mão</span>
        </button>
      </mat-menu>
    }
  `,
})
export class ExamShareActionsComponent {
  private readonly pdf = inject(ExamPdfService);
  private readonly notifications = inject(NotificationService);

  /** A prova como está na tela (inclui notas ainda não salvas na avaliação). */
  readonly exam = input.required<Exam>();

  protected readonly canShare = this.pdf.canShare();
  protected readonly isExporting = signal(false);

  protected onDownload(variant: ExamPdfVariant): Promise<void> {
    return this.run(() => this.pdf.download(this.exam(), variant));
  }

  protected onShare(variant: ExamPdfVariant): Promise<void> {
    return this.run(() => this.pdf.share(this.exam(), variant));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.isExporting.set(true);
    try {
      await action();
    } catch (error) {
      // Fechar a tela de compartilhar não é um erro.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.notifications.error('Não foi possível gerar o PDF. Tente novamente.');
      }
    } finally {
      this.isExporting.set(false);
    }
  }
}

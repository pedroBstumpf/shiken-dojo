import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NotificationService } from '@core/notifications/notification.service';
import { EmailDelivery, Exam, ExamPdfVariant } from '@shared/data-access/exams/exam.model';
import { ExamPdfService } from '../data-access/exam-pdf.service';
import {
  SendExamEmailDialogComponent,
  SendExamEmailDialogData,
} from './send-exam-email-dialog.component';

/** Botões "Exportar PDF" e "Enviar por e-mail" de uma prova (completa ou não). */
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

    <button matButton="outlined" type="button" (click)="onSendEmail()">
      <mat-icon aria-hidden="true">forward_to_inbox</mat-icon>
      Enviar por e-mail
    </button>
  `,
})
export class ExamShareActionsComponent {
  private readonly pdf = inject(ExamPdfService);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);

  /** A prova como está na tela (inclui notas ainda não salvas na avaliação). */
  readonly exam = input.required<Exam>();

  protected readonly isExporting = signal(false);

  protected async onDownload(variant: ExamPdfVariant): Promise<void> {
    this.isExporting.set(true);
    try {
      await this.pdf.download(this.exam(), variant);
    } catch {
      this.notifications.error('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      this.isExporting.set(false);
    }
  }

  protected onSendEmail(): void {
    this.dialog
      .open<SendExamEmailDialogComponent, SendExamEmailDialogData, EmailDelivery>(
        SendExamEmailDialogComponent,
        { data: { exam: this.exam() }, width: '30rem', maxWidth: 'calc(100vw - 2rem)' },
      )
      .afterClosed()
      .subscribe((delivery) => {
        if (!delivery) return;
        this.notifications.success(
          delivery.simulated
            ? `Envio simulado para ${delivery.recipientEmail}: o servidor ainda não tem um provedor de e-mail configurado.`
            : `PDF enviado para ${delivery.recipientEmail}.`,
        );
      });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { EmailDelivery, Exam, ExamPdfVariant } from '@shared/data-access/exams/exam.model';
import { TeacherApiService } from '@shared/data-access/teachers/teacher-api.service';
import { ApiError } from '@shared/models/api-error.model';
import { ExamPdfService } from '../data-access/exam-pdf.service';

export interface SendExamEmailDialogData {
  readonly exam: Exam;
}

/** Fecha com o EmailDelivery quando o envio dá certo; com undefined se cancelar. */
@Component({
  selector: 'sd-send-exam-email-dialog',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatRadioModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Enviar prova por e-mail</h2>
    <mat-dialog-content>
      @if (teachers.isLoading()) {
        <div class="h-32 animate-pulse rounded-xl bg-surface-container" aria-busy="true"></div>
      } @else if (teachers.error(); as error) {
        <p class="text-error" role="alert">{{ error.message }}</p>
      } @else if (recipients().length === 0) {
        <p>
          Não há professores ativos cadastrados para receber o PDF.
          <a routerLink="/teachers/new" mat-dialog-close class="text-primary underline"
            >Cadastrar professor</a
          >
        </p>
      } @else {
        <form
          [formGroup]="form"
          id="send-exam-email"
          (ngSubmit)="onSend()"
          class="space-y-4 pt-2"
          novalidate
        >
          <mat-form-field class="w-full">
            <mat-label>Professor(a)</mat-label>
            <mat-select formControlName="teacherId">
              @for (teacher of recipients(); track teacher.id) {
                <mat-option [value]="teacher.id">{{ teacher.fullName }}</mat-option>
              }
            </mat-select>
            <mat-hint>{{ recipientHint() }}</mat-hint>
          </mat-form-field>

          <fieldset>
            <legend class="mb-2 text-sm font-semibold">Versão do PDF</legend>
            <mat-radio-group formControlName="variant" class="flex flex-col">
              <mat-radio-button value="filled">Com as notas lançadas</mat-radio-button>
              <mat-radio-button value="blank">Em branco, para preencher à mão</mat-radio-button>
            </mat-radio-group>
          </fieldset>

          @if (data.exam.status === 'draft' && variant() === 'filled') {
            <p class="flex gap-2 rounded-xl bg-surface-low p-3 text-sm text-on-surface-variant">
              <mat-icon class="shrink-0" aria-hidden="true">info</mat-icon>
              A prova ainda está em andamento: as notas que faltam sairão como quadrados em branco.
            </p>
          }
          @if (errorMessage(); as message) {
            <p class="text-sm text-error" role="alert">{{ message }}</p>
          }
        </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Cancelar</button>
      <button
        matButton="filled"
        type="submit"
        form="send-exam-email"
        [disabled]="isSending() || recipients().length === 0"
      >
        <mat-icon aria-hidden="true">{{
          isSending() ? 'hourglass_top' : 'forward_to_inbox'
        }}</mat-icon>
        {{ isSending() ? 'Enviando…' : 'Enviar PDF' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class SendExamEmailDialogComponent {
  private readonly teacherApi = inject(TeacherApiService);
  private readonly examApi = inject(ExamApiService);
  private readonly pdf = inject(ExamPdfService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly dialogRef =
    inject<MatDialogRef<SendExamEmailDialogComponent, EmailDelivery>>(MatDialogRef);
  protected readonly data = inject<SendExamEmailDialogData>(MAT_DIALOG_DATA);

  protected readonly teachers = rxResource({ stream: () => this.teacherApi.list() });
  protected readonly isSending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.group({
    teacherId: ['', Validators.required],
    variant: this.fb.control<ExamPdfVariant>('filled'),
  });

  private readonly teacherId = toSignal(this.form.controls.teacherId.valueChanges, {
    initialValue: '',
  });
  protected readonly variant = toSignal(this.form.controls.variant.valueChanges, {
    initialValue: this.form.controls.variant.value,
  });

  /** Só professores ativos; o e-mail é sempre o do cadastro (não dá para digitar outro). */
  protected readonly recipients = computed(() =>
    (this.teachers.value() ?? []).filter((teacher) => teacher.active),
  );

  protected readonly recipientHint = computed(() => {
    const teacher = this.recipients().find((t) => t.id === this.teacherId());
    return teacher ? `Será enviado para ${teacher.email}` : 'Escolha quem vai receber o PDF';
  });

  constructor() {
    // Sugere o examinador da prova como destinatário.
    effect(() => {
      const recipients = this.recipients();
      if (recipients.length > 0 && !this.form.controls.teacherId.value) {
        const examiner = recipients.find((t) => t.id === this.data.exam.examinerId);
        this.form.controls.teacherId.setValue((examiner ?? recipients[0]!).id);
      }
    });
  }

  protected async onSend(): Promise<void> {
    if (this.form.invalid || this.isSending()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSending.set(true);
    this.errorMessage.set(null);
    const { teacherId, variant } = this.form.getRawValue();
    try {
      const { file, fileName } = await this.pdf.create(this.data.exam, variant);
      this.examApi
        .sendPdfByEmail(this.data.exam.id, { teacherId, variant, file, fileName })
        .subscribe({
          next: (delivery) => this.dialogRef.close(delivery),
          error: (error: ApiError) => this.fail(error.message),
        });
    } catch {
      this.fail('Não foi possível gerar o PDF. Tente novamente.');
    }
  }

  private fail(message: string): void {
    this.isSending.set(false);
    this.errorMessage.set(message);
  }
}

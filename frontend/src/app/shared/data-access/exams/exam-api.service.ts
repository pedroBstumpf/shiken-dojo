import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Paginated } from '@shared/models/paginated.model';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url.token';
import {
  EmailDeliveryDto,
  ExamDto,
  ExamGradesDto,
  ExamSummaryDto,
  ExamTemplateDto,
} from './exam.dto';
import { toEmailDelivery, toExam, toExamCreateDto, toExamSummary } from './exam.mapper';
import {
  EmailDelivery,
  Exam,
  ExamEmailRequest,
  ExamSetup,
  ExamSummary,
  ExamTemplate,
  GradeSheet,
} from './exam.model';

const PAGE_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class ExamApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/exams`;

  listTemplates(): Observable<readonly ExamTemplate[]> {
    return this.http
      .get<Paginated<ExamTemplateDto>>(`${this.baseUrl}/exam-templates`)
      .pipe(map((page) => page.items));
  }

  list(): Observable<readonly ExamSummary[]> {
    const params = new HttpParams().set('limit', PAGE_LIMIT);
    return this.http
      .get<Paginated<ExamSummaryDto>>(this.url, { params })
      .pipe(map((page) => page.items.map(toExamSummary)));
  }

  get(id: string): Observable<Exam> {
    return this.http.get<ExamDto>(this.examUrl(id)).pipe(map(toExam));
  }

  create(setup: ExamSetup): Observable<Exam> {
    return this.http.post<ExamDto>(this.url, toExamCreateDto(setup)).pipe(map(toExam));
  }

  saveGrades(id: string, grades: GradeSheet): Observable<Exam> {
    const body: ExamGradesDto = { grades };
    return this.http.put<ExamDto>(`${this.examUrl(id)}/grades`, body).pipe(map(toExam));
  }

  complete(id: string): Observable<Exam> {
    return this.http.post<ExamDto>(`${this.examUrl(id)}/complete`, {}).pipe(map(toExam));
  }

  /** Envia o PDF da prova (multipart) para o e-mail cadastrado do professor escolhido. */
  sendPdfByEmail(id: string, request: ExamEmailRequest): Observable<EmailDelivery> {
    const body = new FormData();
    body.append('teacherId', request.teacherId);
    body.append('variant', request.variant);
    body.append('file', request.file, request.fileName);
    return this.http
      .post<EmailDeliveryDto>(`${this.examUrl(id)}/email`, body)
      .pipe(map(toEmailDelivery));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.examUrl(id));
  }

  private examUrl(id: string): string {
    return `${this.url}/${encodeURIComponent(id)}`;
  }
}

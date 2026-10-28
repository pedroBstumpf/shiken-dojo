import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { errorInterceptor } from '@core/http/error.interceptor';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { StudentApiService } from '@shared/data-access/students/student-api.service';
import { ApiError } from '@shared/models/api-error.model';
import { firstValueFrom } from 'rxjs';
import { mockApiInterceptor } from './mock-api.interceptor';

describe('mockApiInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor, mockApiInterceptor]))],
    });
  });

  it('lista os alunos de exemplo em ordem alfabética', async () => {
    const students = await firstValueFrom(TestBed.inject(StudentApiService).list());
    expect(students.length).toBeGreaterThan(0);
    const names = students.map((s) => s.fullName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('responde 422 com erros por campo, no formato Problem Details', async () => {
    const api = TestBed.inject(StudentApiService);
    const error = await firstValueFrom(
      api.create({
        fullName: 'A',
        belt: 'branca',
        birthDate: null,
        enrollmentDate: null,
        notes: '',
      }),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).fieldErrors['fullName']).toBeTruthy();
  });

  it('não finaliza prova com notas faltando e bloqueia edição depois de finalizada', async () => {
    const api = TestBed.inject(ExamApiService);
    const [template] = await firstValueFrom(api.listTemplates());
    const [student] = await firstValueFrom(TestBed.inject(StudentApiService).list());
    const exam = await firstValueFrom(
      api.create({
        templateId: template!.id,
        date: new Date(2026, 9, 28),
        location: '',
        examinerName: 'Sensei Teste',
        passingGrade: 6,
        notes: '',
        studentIds: [student!.id],
      }),
    );
    expect(exam.status).toBe('draft');

    const incomplete = await firstValueFrom(api.complete(exam.id)).catch(
      (e: unknown) => e as ApiError,
    );
    expect((incomplete as ApiError).code).toBe('EXAM_INCOMPLETE');

    const allGrades = Object.fromEntries(
      template!.sections.flatMap((s) => s.items).map((item) => [item.id, 8]),
    );
    await firstValueFrom(api.saveGrades(exam.id, { [student!.id]: allGrades }));
    const completed = await firstValueFrom(api.complete(exam.id));
    expect(completed.status).toBe('completed');

    const locked = await firstValueFrom(api.saveGrades(exam.id, {})).catch(
      (e: unknown) => e as ApiError,
    );
    expect((locked as ApiError).status).toBe(409);
  });
});

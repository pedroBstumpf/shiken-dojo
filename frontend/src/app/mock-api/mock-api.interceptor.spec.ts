import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { errorInterceptor } from '@core/http/error.interceptor';
import { ExamApiService } from '@shared/data-access/exams/exam-api.service';
import { StudentApiService } from '@shared/data-access/students/student-api.service';
import { TeacherApiService } from '@shared/data-access/teachers/teacher-api.service';
import { TeacherInput } from '@shared/data-access/teachers/teacher.model';
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

  it('descarta notas acima de 3 enviadas à API', async () => {
    const api = TestBed.inject(ExamApiService);
    const [template] = await firstValueFrom(api.listTemplates());
    const [student] = await firstValueFrom(TestBed.inject(StudentApiService).list());
    const [examiner] = await firstValueFrom(TestBed.inject(TeacherApiService).list());
    const exam = await firstValueFrom(
      api.create({
        templateId: template!.id,
        date: new Date(2026, 9, 28),
        location: '',
        examinerId: examiner!.id,
        passingGrade: 2,
        notes: '',
        studentIds: [student!.id],
      }),
    );
    const [first, second] = template!.sections[0]!.items;
    const saved = await firstValueFrom(
      api.saveGrades(exam.id, { [student!.id]: { [first!.id]: 7, [second!.id]: 2.5 } }),
    );
    expect(saved.grades[student!.id]).toEqual({ [second!.id]: 2.5 });
  });

  it('cadastra professor, exige dan para faixa preta e recusa e-mail repetido', async () => {
    const api = TestBed.inject(TeacherApiService);
    const input: TeacherInput = {
      fullName: 'Kenji Watanabe',
      email: 'Kenji@Dojo.Exemplo',
      phone: '(21) 99876-5432',
      role: 'instructor',
      belt: 'preta',
      dan: 2,
      federationId: '',
      active: true,
    };
    const created = await firstValueFrom(api.create(input));
    expect(created.email).toBe('kenji@dojo.exemplo');
    expect(created.phone).toBe('21998765432');

    const duplicate = await firstValueFrom(
      api.create({ ...input, fullName: 'Outro Nome', email: 'kenji@dojo.exemplo' }),
    ).catch((e: unknown) => e as ApiError);
    expect((duplicate as ApiError).status).toBe(409);
    expect((duplicate as ApiError).fieldErrors['email']).toBeTruthy();

    const brown = await firstValueFrom(
      api.update(created.id, { ...input, belt: 'marrom', dan: 3 }),
    );
    expect(brown.dan).toBeNull();
  });

  it('só aceita professor ativo como examinador', async () => {
    const teachers = TestBed.inject(TeacherApiService);
    const [examiner] = await firstValueFrom(teachers.list());
    await firstValueFrom(teachers.update(examiner!.id, { ...examiner!, active: false }));

    const api = TestBed.inject(ExamApiService);
    const [template] = await firstValueFrom(api.listTemplates());
    const [student] = await firstValueFrom(TestBed.inject(StudentApiService).list());
    const error = await firstValueFrom(
      api.create({
        templateId: template!.id,
        date: new Date(2026, 9, 28),
        location: '',
        examinerId: examiner!.id,
        passingGrade: 2,
        notes: '',
        studentIds: [student!.id],
      }),
    ).catch((e: unknown) => e as ApiError);
    expect((error as ApiError).fieldErrors['examinerId']).toBeTruthy();
  });

  it('não finaliza prova com notas faltando e bloqueia edição depois de finalizada', async () => {
    const api = TestBed.inject(ExamApiService);
    const [template] = await firstValueFrom(api.listTemplates());
    const [student] = await firstValueFrom(TestBed.inject(StudentApiService).list());
    const [examiner] = await firstValueFrom(TestBed.inject(TeacherApiService).list());
    const exam = await firstValueFrom(
      api.create({
        templateId: template!.id,
        date: new Date(2026, 9, 28),
        location: '',
        examinerId: examiner!.id,
        passingGrade: 2,
        notes: '',
        studentIds: [student!.id],
      }),
    );
    expect(exam.status).toBe('draft');
    expect(exam.examinerName).toBe(examiner!.fullName);

    const incomplete = await firstValueFrom(api.complete(exam.id)).catch(
      (e: unknown) => e as ApiError,
    );
    expect((incomplete as ApiError).code).toBe('EXAM_INCOMPLETE');

    const allGrades = Object.fromEntries(
      template!.sections.flatMap((s) => s.items).map((item) => [item.id, 3]),
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

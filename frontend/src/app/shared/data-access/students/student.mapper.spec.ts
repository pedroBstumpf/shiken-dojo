import { toStudent, toStudentWriteDto } from './student.mapper';

describe('student.mapper', () => {
  it('converte datas de calendário sem deslocar o dia', () => {
    const student = toStudent({
      id: '1',
      fullName: 'Ana Souza',
      belt: 'branca',
      birthDate: '2014-03-12',
      enrollmentDate: null,
      notes: '',
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:00.000Z',
    });
    expect(student.birthDate?.getFullYear()).toBe(2014);
    expect(student.birthDate?.getMonth()).toBe(2);
    expect(student.birthDate?.getDate()).toBe(12);
    expect(student.enrollmentDate).toBeNull();
  });

  it('envia somente os campos editáveis, sem espaços sobrando', () => {
    expect(
      toStudentWriteDto({
        fullName: '  Ana Souza ',
        belt: 'amarela',
        birthDate: new Date(2014, 2, 12),
        enrollmentDate: null,
        notes: ' ',
      }),
    ).toEqual({
      fullName: 'Ana Souza',
      belt: 'amarela',
      birthDate: '2014-03-12',
      enrollmentDate: null,
      notes: '',
    });
  });
});

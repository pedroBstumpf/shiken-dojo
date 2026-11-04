import { toStudent, toStudentWriteDoc } from './student.mapper';

const at = (iso: string) => ({ toDate: () => new Date(iso) });

describe('student.mapper', () => {
  it('converte datas de calendário sem deslocar o dia', () => {
    const student = toStudent('1', {
      fullName: 'Ana Souza',
      belt: 'branca',
      birthDate: '2014-03-12',
      createdAt: at('2026-01-01T12:00:00.000Z'),
      updatedAt: at('2026-01-01T12:00:00.000Z'),
    });
    expect(student.birthDate?.getFullYear()).toBe(2014);
    expect(student.birthDate?.getMonth()).toBe(2);
    expect(student.birthDate?.getDate()).toBe(12);
  });

  it('grava somente os campos editáveis, sem espaços sobrando', () => {
    expect(
      toStudentWriteDoc({
        fullName: '  Ana Souza ',
        belt: 'amarela',
        birthDate: new Date(2014, 2, 12),
      }),
    ).toEqual({ fullName: 'Ana Souza', belt: 'amarela', birthDate: '2014-03-12' });
  });
});

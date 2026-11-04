import { backupFileName, buildBackup } from './backup';

const at = (iso: string) => ({ toDate: () => new Date(iso) });

describe('backup', () => {
  it('guarda alunos e provas com o identificador de cada um', () => {
    const backup = buildBackup(
      [{ id: 's1', data: { fullName: 'Ana Souza', belt: 'branca', birthDate: '2014-03-12' } }],
      [{ id: 'e1', data: { status: 'draft', grades: { s1: { k1: 2.5 } } } }],
      new Date('2026-11-04T12:00:00.000Z'),
    );

    expect(backup).toEqual({
      app: 'ryu-kan',
      version: 1,
      exportedAt: '2026-11-04T12:00:00.000Z',
      students: [{ id: 's1', fullName: 'Ana Souza', belt: 'branca', birthDate: '2014-03-12' }],
      exams: [{ id: 'e1', status: 'draft', grades: { s1: { k1: 2.5 } } }],
    });
  });

  it('converte datas do Firestore em texto, inclusive dentro de listas e objetos', () => {
    const backup = buildBackup(
      [],
      [
        {
          id: 'e1',
          data: {
            completedAt: at('2026-06-20T15:00:00.000Z'),
            notNull: null,
            sections: [{ items: [{ when: at('2026-01-01T00:00:00.000Z') }] }],
          },
        },
      ],
      new Date(),
    );

    expect(backup.exams[0]).toEqual({
      id: 'e1',
      completedAt: '2026-06-20T15:00:00.000Z',
      notNull: null,
      sections: [{ items: [{ when: '2026-01-01T00:00:00.000Z' }] }],
    });
  });

  it('o resultado sobrevive à conversão para JSON', () => {
    const backup = buildBackup(
      [{ id: 's1', data: { createdAt: at('2026-01-01T00:00:00.000Z') } }],
      [],
      new Date('2026-11-04T12:00:00.000Z'),
    );

    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup);
  });

  it('o nome do arquivo traz a data', () => {
    expect(backupFileName(new Date(2026, 10, 4))).toBe('backup-ryu-kan-2026-11-04.json');
  });
});

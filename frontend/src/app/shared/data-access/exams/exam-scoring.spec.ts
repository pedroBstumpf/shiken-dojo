import { gradingProgress, sectionTotal, studentResult } from './exam-scoring';

const sections = [{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }];

describe('exam-scoring', () => {
  it('soma apenas as notas lançadas do bloco', () => {
    expect(sectionTotal(sections[0]!, { a: 7, b: 8.5 })).toBe(15.5);
    expect(sectionTotal(sections[0]!, { a: 7 })).toBe(7);
    expect(sectionTotal(sections[0]!, {})).toBeNull();
    expect(sectionTotal(sections[0]!, undefined)).toBeNull();
  });

  it('fica pendente enquanto faltar alguma nota', () => {
    const result = studentResult(sections, { a: 9, b: 9 }, 6);
    expect(result).toEqual({ average: 9, gradedCount: 2, totalCount: 3, status: 'pending' });
  });

  it('aprova quando a média (com uma casa) atinge a nota mínima', () => {
    // (6 + 6 + 5.9) / 3 = 5.966… → 6.0 arredondado: aprovado, coerente com o que a tela mostra.
    expect(studentResult(sections, { a: 6, b: 6, c: 5.9 }, 6).status).toBe('approved');
    expect(studentResult(sections, { a: 5, b: 6, c: 6 }, 6).status).toBe('failed');
  });

  it('conta o progresso da avaliação da turma', () => {
    const sheet = { s1: { a: 7, b: 7, c: 7 }, s2: { a: 5 } };
    expect(gradingProgress(sections, ['s1', 's2'], sheet)).toEqual({ graded: 4, total: 6 });
  });
});

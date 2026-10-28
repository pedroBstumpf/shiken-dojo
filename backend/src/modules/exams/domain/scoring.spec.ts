import { describe, expect, it } from 'vitest';
import { gradingProgress, isValidGrade, studentResult } from './scoring.js';

// Mesmos cenários de frontend/.../exam-scoring.spec.ts: as duas implementações devem concordar.

const sections = [{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }];

describe('pontuação', () => {
  it('fica pendente enquanto faltar alguma nota', () => {
    const result = studentResult(sections, { a: 3, b: 3 }, 2);
    expect(result).toEqual({ average: 3, gradedCount: 2, totalCount: 3, status: 'pending' });
  });

  it('aprova quando a média (com uma casa) atinge a nota mínima', () => {
    // (2 + 2 + 1.9) / 3 = 1.966… → 2.0 arredondado: aprovado, coerente com o que a tela mostra.
    expect(studentResult(sections, { a: 2, b: 2, c: 1.9 }, 2).status).toBe('approved');
    expect(studentResult(sections, { a: 1, b: 2, c: 2 }, 2).status).toBe('failed');
  });

  it('conta o progresso da avaliação da turma', () => {
    const sheet = { s1: { a: 2, b: 2, c: 2 }, s2: { a: 1 } };
    expect(gradingProgress(sections, ['s1', 's2'], sheet)).toEqual({ graded: 4, total: 6 });
  });

  it('aceita notas de 0 a 3 com uma casa decimal', () => {
    expect([0, 1, 2.5, 2.3, 3].every(isValidGrade)).toBe(true);
    expect([-0.5, 3.5, 2.25, Number.NaN, Infinity].some(isValidGrade)).toBe(false);
  });
});

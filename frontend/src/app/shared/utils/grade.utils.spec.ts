import { formatGrade, formatScore, isAcceptableGradeDraft, parseGrade } from './grade.utils';

describe('parseGrade', () => {
  it('aceita notas de 0 a 3, inteiras ou com decimais (vírgula ou ponto)', () => {
    expect(parseGrade('0')).toEqual({ ok: true, value: 0 });
    expect(parseGrade('2')).toEqual({ ok: true, value: 2 });
    expect(parseGrade('2,5')).toEqual({ ok: true, value: 2.5 });
    expect(parseGrade(' 1.25 ')).toEqual({ ok: true, value: 1.3 });
    expect(parseGrade('3')).toEqual({ ok: true, value: 3 });
  });

  it('trata vazio como "sem nota"', () => {
    expect(parseGrade('')).toEqual({ ok: true, value: null });
    expect(parseGrade('   ')).toEqual({ ok: true, value: null });
  });

  it('rejeita valores acima de 3, negativos ou que não são números', () => {
    expect(parseGrade('3,5')).toEqual({ ok: false });
    expect(parseGrade('4')).toEqual({ ok: false });
    expect(parseGrade('10')).toEqual({ ok: false });
    expect(parseGrade('-1')).toEqual({ ok: false });
    expect(parseGrade('abc')).toEqual({ ok: false });
    expect(parseGrade('2,5,1')).toEqual({ ok: false });
  });
});

describe('isAcceptableGradeDraft', () => {
  it('permite o que pode virar uma nota de 0 a 3 durante a digitação', () => {
    for (const text of ['', '0', '2', '2,', '2,5', '3', '3,0', '1.']) {
      expect(isAcceptableGradeDraft(text), text).toBe(true);
    }
  });

  it('bloqueia o que já passou de 3 ou não é número', () => {
    for (const text of ['4', '9', '12', '3,5', '3,1', ',', 'a', '-1', '2,55']) {
      expect(isAcceptableGradeDraft(text), text).toBe(false);
    }
  });
});

describe('formatGrade / formatScore', () => {
  it('formata no padrão brasileiro', () => {
    expect(formatGrade(2.5)).toBe('2,5');
    expect(formatGrade(3)).toBe('3');
    expect(formatGrade(undefined)).toBe('');
    expect(formatScore(24)).toBe('24,0');
    expect(formatScore(null)).toBe('—');
  });
});

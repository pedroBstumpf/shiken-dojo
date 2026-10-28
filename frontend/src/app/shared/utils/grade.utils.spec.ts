import { formatGrade, formatScore, parseGrade } from './grade.utils';

describe('parseGrade', () => {
  it('aceita inteiros e decimais com vírgula ou ponto', () => {
    expect(parseGrade('7')).toEqual({ ok: true, value: 7 });
    expect(parseGrade('7,5')).toEqual({ ok: true, value: 7.5 });
    expect(parseGrade(' 8.25 ')).toEqual({ ok: true, value: 8.3 });
    expect(parseGrade('10')).toEqual({ ok: true, value: 10 });
    expect(parseGrade('0')).toEqual({ ok: true, value: 0 });
  });

  it('trata vazio como "sem nota"', () => {
    expect(parseGrade('')).toEqual({ ok: true, value: null });
    expect(parseGrade('   ')).toEqual({ ok: true, value: null });
  });

  it('rejeita valores fora de 0 a 10 ou que não são números', () => {
    expect(parseGrade('11')).toEqual({ ok: false });
    expect(parseGrade('-1')).toEqual({ ok: false });
    expect(parseGrade('abc')).toEqual({ ok: false });
    expect(parseGrade('7,5,1')).toEqual({ ok: false });
  });
});

describe('formatGrade / formatScore', () => {
  it('formata no padrão brasileiro', () => {
    expect(formatGrade(7.5)).toBe('7,5');
    expect(formatGrade(8)).toBe('8');
    expect(formatGrade(undefined)).toBe('');
    expect(formatScore(60)).toBe('60,0');
    expect(formatScore(null)).toBe('—');
  });
});

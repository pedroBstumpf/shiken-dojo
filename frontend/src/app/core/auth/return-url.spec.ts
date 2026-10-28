import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('mantém caminhos internos, com query string', () => {
    expect(safeReturnUrl('/students?belt=verde')).toBe('/students?belt=verde');
    expect(safeReturnUrl('/exams/abc/grading')).toBe('/exams/abc/grading');
  });

  it('bloqueia destinos externos (open redirect)', () => {
    for (const url of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil']) {
      expect(safeReturnUrl(url)).toBe('/');
    }
  });

  it('não volta para as próprias telas de acesso', () => {
    expect(safeReturnUrl('/login?returnUrl=/x')).toBe('/');
    expect(safeReturnUrl(null)).toBe('/');
  });
});

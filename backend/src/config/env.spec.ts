import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgres://app:secret@localhost:5432/app',
  CSRF_SECRET: 'x'.repeat(32),
};

const PRODUCTION = {
  ...REQUIRED,
  NODE_ENV: 'production',
  APP_BASE_URL: 'https://app.shiken-dojo.app',
  MAIL_TRANSPORT: 'smtp',
  SMTP_URL: 'smtps://user:pass@smtp.example.com',
};

describe('loadConfig', () => {
  it('aplica valores padrão em desenvolvimento', () => {
    const config = loadConfig(REQUIRED);
    expect(config).toMatchObject({ env: 'development', port: 3000, isProduction: false });
  });

  it('recusa configuração inválida sem expor os valores', () => {
    try {
      loadConfig({ ...REQUIRED, PORT: 'segredo-123' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toContain('PORT');
      expect((error as ConfigError).message).not.toContain('segredo-123');
    }
  });

  it('liga cookies seguros em produção e não deixa desligar', () => {
    expect(loadConfig(PRODUCTION).cookieSecure).toBe(true);
    expect(() => loadConfig({ ...PRODUCTION, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
  });

  it('não sobe em produção sem envio real de e-mail', () => {
    expect(() => loadConfig({ ...PRODUCTION, MAIL_TRANSPORT: 'file' })).toThrow(/MAIL_TRANSPORT/);
    expect(() => loadConfig({ ...PRODUCTION, SMTP_URL: undefined })).toThrow(/SMTP_URL/);
  });

  it('exige a conexão com o banco', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});

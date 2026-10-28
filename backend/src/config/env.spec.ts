import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './env.js';

const REQUIRED = { DATABASE_URL: 'postgres://app:secret@localhost:5432/app' };

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

  it('exige a conexão com o banco', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});

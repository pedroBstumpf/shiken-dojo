import { z } from 'zod';

// Toda configuração vem do ambiente e é validada na inicialização:
// com configuração inválida a aplicação não sobe (BACKEND.md §2).

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Quantos proxies confiáveis existem na frente da API (0 = acesso direto). Define o IP do cliente. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  /** Origens com CORS liberado, separadas por vírgula. Vazio = mesma origem apenas. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ }))),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(300),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  readonly env: Env['NODE_ENV'];
  readonly isProduction: boolean;
  readonly host: string;
  readonly port: number;
  readonly logLevel: Env['LOG_LEVEL'];
  /** Quantos saltos de proxy são confiáveis para descobrir o IP do cliente. */
  readonly trustProxyHops: number;
  readonly corsOrigins: readonly string[];
  readonly globalRateLimitPerMinute: number;
}

export class ConfigError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Configuração inválida:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Mostra só o nome da variável e o problema, nunca o valor (pode ser um segredo).
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const env = result.data;
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    corsOrigins: env.CORS_ORIGINS,
    globalRateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
  };
}

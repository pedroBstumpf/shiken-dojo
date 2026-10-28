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
  /** Conexão da API: papel com apenas SELECT/INSERT/UPDATE/DELETE. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'Informe uma URL postgres://' }),
  /** Cookies só por HTTPS. Padrão: ligado em produção (onde é obrigatório). */
  COOKIE_SECURE: z.stringbool().optional(),
  /** Chave para assinar o token anti-CSRF. Gere com: openssl rand -base64 48 */
  CSRF_SECRET: z.string().min(32, 'Use pelo menos 32 caracteres aleatórios.'),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(720),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  /** Recusa senhas que aparecem em vazamentos (Have I Been Pwned, por k-anonymity). */
  BREACHED_PASSWORD_CHECK: z.stringbool().default(true),
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
  readonly databaseUrl: string;
  readonly cookieSecure: boolean;
  readonly csrfSecret: string;
  readonly session: { readonly idleMinutes: number; readonly absoluteHours: number };
  readonly breachedPasswordCheck: boolean;
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
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && env.COOKIE_SECURE === false) {
    throw new ConfigError(['COOKIE_SECURE: cookies sem HTTPS não são permitidos em produção']);
  }
  return {
    env: env.NODE_ENV,
    isProduction,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    corsOrigins: env.CORS_ORIGINS,
    globalRateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    databaseUrl: env.DATABASE_URL,
    cookieSecure: env.COOKIE_SECURE ?? isProduction,
    csrfSecret: env.CSRF_SECRET,
    session: { idleMinutes: env.SESSION_IDLE_MINUTES, absoluteHours: env.SESSION_ABSOLUTE_HOURS },
    breachedPasswordCheck: env.BREACHED_PASSWORD_CHECK,
  };
}

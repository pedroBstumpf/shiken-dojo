import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import type { App } from '../../src/app.js';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

function randomOctet(): number {
  return Math.floor(Math.random() * 254) + 1;
}

/**
 * Cliente de teste que se comporta como o navegador + HttpClient do Angular:
 * guarda os cookies recebidos e copia o XSRF-TOKEN no header X-XSRF-TOKEN.
 */
export class TestClient {
  private readonly cookies = new Map<string, string>();
  /** Cada cliente tem um IP próprio, como usuários diferentes (o rate limit é por IP). */
  private readonly ip = `10.${randomOctet()}.${randomOctet()}.${randomOctet()}`;

  constructor(private readonly app: App) {}

  get(url: string): Promise<LightMyRequestResponse> {
    return this.request('GET', url);
  }

  post(url: string, payload?: unknown): Promise<LightMyRequestResponse> {
    return this.request('POST', url, payload);
  }

  put(url: string, payload?: unknown): Promise<LightMyRequestResponse> {
    return this.request('PUT', url, payload);
  }

  delete(url: string): Promise<LightMyRequestResponse> {
    return this.request('DELETE', url);
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  async login(email: string, password: string): Promise<LightMyRequestResponse> {
    const response = await this.post('/api/v1/auth/login', { email, password });
    if (response.statusCode !== 200) {
      throw new Error(`Login falhou (${response.statusCode}): ${response.body}`);
    }
    return response;
  }

  async request(
    method: Method,
    url: string,
    payload?: unknown,
    extra: Partial<InjectOptions> = {},
  ): Promise<LightMyRequestResponse> {
    // Como o Angular: antes de alterar estado, garante que já recebeu o cookie anti-CSRF.
    if (method !== 'GET' && !this.cookies.has('XSRF-TOKEN')) {
      await this.request('GET', '/api/v1/openapi.json');
    }
    const xsrf = this.cookies.get('XSRF-TOKEN');
    const options: InjectOptions = {
      method,
      url,
      remoteAddress: this.ip,
      ...extra,
      headers: {
        ...(xsrf && method !== 'GET' ? { 'x-xsrf-token': xsrf } : {}),
        ...extra.headers,
      },
      cookies: Object.fromEntries(this.cookies),
    };
    if (payload !== undefined) options.payload = payload as NonNullable<InjectOptions['payload']>;
    const response: LightMyRequestResponse = await this.app.inject(options);
    for (const cookie of response.cookies) {
      const expired =
        cookie.value === '' || (cookie.expires && cookie.expires.getTime() < Date.now());
      if (expired) this.cookies.delete(cookie.name);
      else this.cookies.set(cookie.name, cookie.value);
    }
    return response;
  }
}

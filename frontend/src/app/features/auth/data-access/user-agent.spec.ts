import { describeUserAgent } from './user-agent';

describe('describeUserAgent', () => {
  it('reconhece navegador e sistema', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0',
      ),
    ).toEqual({ label: 'Edge no Windows', icon: 'computer' });
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ label: 'Safari no iPhone', icon: 'smartphone' });
  });

  it('não quebra com User-Agent vazio', () => {
    expect(describeUserAgent('')).toEqual({ label: 'Aparelho desconhecido', icon: 'devices' });
  });
});

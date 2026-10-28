export interface DeviceDescription {
  readonly label: string;
  readonly icon: string;
}

const BROWSERS: readonly [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: readonly [RegExp, string, string][] = [
  [/iPhone/, 'iPhone', 'smartphone'],
  [/iPad/, 'iPad', 'tablet'],
  [/Android.*Mobile/, 'Android', 'smartphone'],
  [/Android/, 'Android', 'tablet'],
  [/Windows/, 'Windows', 'computer'],
  [/Mac OS X/, 'Mac', 'computer'],
  [/Linux/, 'Linux', 'computer'],
];

/** "Chrome no Windows", a partir do User-Agent. Só para o professor reconhecer o aparelho. */
export function describeUserAgent(userAgent: string): DeviceDescription {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent));
  if (!browser && !system) return { label: 'Aparelho desconhecido', icon: 'devices' };
  const label = [browser ?? 'Navegador', system ? `no ${system[1]}` : ''].join(' ').trim();
  return { label, icon: system?.[2] ?? 'devices' };
}

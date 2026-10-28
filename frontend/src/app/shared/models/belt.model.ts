// Sequência de faixas (kyu). Ajuste conforme a graduação adotada pela associação.
export const BELTS = [
  'branca',
  'amarela',
  'vermelha',
  'laranja',
  'verde',
  'roxa',
  'marrom',
  'preta',
] as const;

export type Belt = (typeof BELTS)[number];

export interface BeltInfo {
  readonly label: string;
  readonly color: string;
  /** Cor da borda, para faixas claras continuarem visíveis em fundo claro. */
  readonly edge: string;
}

export const BELT_INFO: Readonly<Record<Belt, BeltInfo>> = {
  branca: { label: 'Branca', color: '#f4f1ea', edge: '#9a948a' },
  amarela: { label: 'Amarela', color: '#f2c12e', edge: '#b38a10' },
  vermelha: { label: 'Vermelha', color: '#c62828', edge: '#8e1b1b' },
  laranja: { label: 'Laranja', color: '#ef7d22', edge: '#b25811' },
  verde: { label: 'Verde', color: '#2e7d32', edge: '#1d5420' },
  roxa: { label: 'Roxa', color: '#6a3d9a', edge: '#472668' },
  marrom: { label: 'Marrom', color: '#6d4c35', edge: '#4a3222' },
  preta: { label: 'Preta', color: '#1d1b18', edge: '#000000' },
};

export function isBelt(value: unknown): value is Belt {
  return typeof value === 'string' && (BELTS as readonly string[]).includes(value);
}

/** Remove acentos e caixa para buscas ("João" encontra "joao"). */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** "Maria Clara Souza" → "Maria Souza" (primeiro e último nome). */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length <= 2 ? parts.join(' ') : `${parts[0]} ${parts[parts.length - 1]}`;
}

export function initials(fullName: string): string {
  const parts = shortName(fullName).split(' ');
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

/** Para inputs ligados a query params: o roteador envia undefined quando o parâmetro não está na URL. */
export function emptyIfMissing(value: string | undefined): string {
  return value ?? '';
}

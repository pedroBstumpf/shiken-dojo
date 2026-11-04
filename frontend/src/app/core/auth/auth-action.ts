/** Depois de definir a senha na página do Firebase, o botão "Continuar" volta para o login. */
export function loginActionSettings(origin: string): { url: string } {
  return { url: `${origin}/login` };
}

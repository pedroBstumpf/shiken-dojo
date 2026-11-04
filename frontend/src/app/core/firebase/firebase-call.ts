import { ApiError } from '@shared/models/api-error.model';
import { FirebaseError } from 'firebase/app';
import { DocumentReference, DocumentSnapshot, getDoc, getDocFromCache } from 'firebase/firestore';
import { catchError, defer, from, Observable, throwError } from 'rxjs';

const OFFLINE_MESSAGE = 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
const GENERIC_MESSAGE = 'Algo deu errado. Tente novamente em alguns instantes.';
const BAD_CREDENTIALS = 'E-mail ou senha incorretos.';

const ERRORS: Readonly<Record<string, readonly [number, string]>> = {
  'permission-denied': [403, 'Você não tem permissão para realizar esta ação.'],
  'not-found': [404, 'Não encontramos o que você procurava.'],
  unavailable: [0, OFFLINE_MESSAGE],
  unauthenticated: [401, 'Sua sessão expirou. Entre novamente para continuar.'],
  'resource-exhausted': [429, 'O limite diário do plano gratuito foi atingido. Tente amanhã.'],
  // A mesma mensagem nos três casos: não revela se o e-mail tem conta.
  'auth/invalid-credential': [401, BAD_CREDENTIALS],
  'auth/wrong-password': [401, BAD_CREDENTIALS],
  'auth/user-not-found': [401, BAD_CREDENTIALS],
  'auth/invalid-email': [422, 'Informe um e-mail válido.'],
  'auth/user-disabled': [403, 'Este acesso foi desativado. Fale com o sensei responsável.'],
  'auth/too-many-requests': [429, 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.'],
  'auth/network-request-failed': [0, OFFLINE_MESSAGE],
};

/** Converte qualquer erro do Firebase em ApiError, para as telas lidarem com um só formato. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof FirebaseError) {
    const known = ERRORS[error.code];
    return known
      ? new ApiError(known[0], error.code, known[1])
      : new ApiError(500, error.code, GENERIC_MESSAGE);
  }
  console.error('Erro inesperado', error);
  return new ApiError(500, 'UNKNOWN', GENERIC_MESSAGE);
}

/** Executa uma chamada ao Firebase como Observable, com erros já normalizados. */
export function firebaseCall<T>(work: () => Promise<T>): Observable<T> {
  return defer(() => from(work())).pipe(catchError((error) => throwError(() => toApiError(error))));
}

const ACK_TIMEOUT_MS = 4_000;

/**
 * Sem internet, a promessa de uma escrita do Firestore só termina quando a conexão volta, embora
 * a gravação já esteja na cópia local e na fila de envio. Por isso só esperamos a confirmação
 * quando há rede, e por tempo limitado; assim a tela não fica presa em "Salvando…".
 */
export async function settleWrite(write: Promise<void>): Promise<void> {
  if (!globalThis.navigator?.onLine) {
    write.catch((error: unknown) => console.error('Escrita recusada ao sincronizar', error));
    return;
  }
  await Promise.race([write, new Promise((resolve) => setTimeout(resolve, ACK_TIMEOUT_MS))]);
}

/** Lê o documento já com as escritas pendentes: a cópia local é a versão mais recente. */
export async function readBack(ref: DocumentReference): Promise<DocumentSnapshot> {
  try {
    const cached = await getDocFromCache(ref);
    // A cópia local também guarda a marca de documentos excluídos: nesse caso, vale o servidor.
    return cached.exists() ? cached : await getDoc(ref);
  } catch {
    return getDoc(ref);
  }
}

/** Parte do Timestamp do Firestore que usamos; ausente em cadastros criados à mão no console. */
export type FirestoreDate = { toDate(): Date } | null | undefined;

export function fromFirestoreDate(value: FirestoreDate): Date {
  return value?.toDate() ?? new Date(0);
}

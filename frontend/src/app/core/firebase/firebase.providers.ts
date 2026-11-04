import { inject, InjectionToken } from '@angular/core';
import { environment } from '@env/environment';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  disableNetwork,
  enableNetwork,
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

/**
 * Sozinho, o Firestore leva cerca de 10 segundos para concluir que está sem rede e, até lá, as
 * leituras ficam presas. Avisando na hora, abrir o app offline mostra os dados imediatamente.
 */
function followNetworkStatus(db: Firestore): void {
  // Depois do logout o Firestore já foi encerrado: não há mais o que atualizar.
  const ignoreClosed = () => undefined;
  if (!navigator.onLine) void disableNetwork(db).catch(ignoreClosed);
  addEventListener('offline', () => void disableNetwork(db).catch(ignoreClosed));
  addEventListener('online', () => void enableNetwork(db).catch(ignoreClosed));
}

export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_HOST = '127.0.0.1';
const FIRESTORE_EMULATOR_PORT = 8080;

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP', {
  providedIn: 'root',
  factory: () => initializeApp(environment.firebase),
});

export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH', {
  providedIn: 'root',
  factory: () => {
    const auth = getAuth(inject(FIREBASE_APP));
    // E-mails de convite e de senha em português.
    auth.languageCode = 'pt-BR';
    if (environment.useEmulators) {
      connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
    }
    return auth;
  },
});

export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE', {
  providedIn: 'root',
  factory: () => {
    // Cópia local no dispositivo: o app continua funcionando sem internet e sincroniza depois.
    const db = initializeFirestore(inject(FIREBASE_APP), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (environment.useEmulators) {
      connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    }
    followNetworkStatus(db);
    return db;
  },
});

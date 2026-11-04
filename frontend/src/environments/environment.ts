// Configuração pública do app web do Firebase (não é segredo: quem protege os dados são as
// regras em firestore.rules). Veja docs/FIREBASE.md.
export const environment = {
  production: true,
  useEmulators: false,
  firebase: {
    apiKey: 'AIzaSyDouIi7RQfX_s_--1xCP4V4CZzrM3w0Ca0',
    authDomain: 'shiken-dojo.firebaseapp.com',
    projectId: 'shiken-dojo',
    appId: '1:673969539938:web:3303ea22d8db4a7c167a3b',
  },
};

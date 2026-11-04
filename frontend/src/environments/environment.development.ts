// Em desenvolvimento tudo roda nos emuladores locais: `npm run emulators`.
// Projetos "demo-" nunca acessam a nuvem, então não há risco de tocar em dados reais.
export const environment = {
  production: false,
  useEmulators: true,
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-shiken-dojo.firebaseapp.com',
    projectId: 'demo-shiken-dojo',
    appId: 'demo-app-id',
  },
};

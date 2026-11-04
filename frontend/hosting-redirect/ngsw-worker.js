// Endereço antigo: substitui a cópia do app que tenha sido instalada aqui. Sem isso, quem abriu o
// endereço antigo continuaria preso a essa cópia, porque ela não receberia mais atualizações.
// Não apaga o IndexedDB: pode haver notas lançadas sem internet ainda não enviadas.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.registration.unregister();
      // Recarrega as abas abertas, que agora recebem a página que leva ao endereço novo.
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((client) => client.navigate(client.url)));
    })(),
  );
});

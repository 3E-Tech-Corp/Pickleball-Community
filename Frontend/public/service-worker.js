// This file unregisters the old service worker and redirects to VitePWA's sw.js
// Safe to delete this file after a few weeks when all users have updated

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      console.log('Old service worker unregistered, VitePWA sw.js will take over');
      return self.clients.matchAll();
    }).then((clients) => {
      clients.forEach(client => client.navigate(client.url));
    })
  );
});

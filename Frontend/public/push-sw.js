// Push Notification Service Worker
// This handles Web Push notifications for the Pickleball Community app

// Handle push events
self.addEventListener('push', function(event) {
  console.log('[Push SW] Push message received:', event);

  let data = {
    title: 'Pickleball Community',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/notifications'
  };

  // Parse the push data if available
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.warn('[Push SW] Failed to parse push data:', e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/notifications',
      timestamp: data.timestamp || Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    // Keep notification until user interacts with it
    requireInteraction: false,
    // Tag to replace previous notifications of the same type
    tag: data.tag || 'pickleball-notification'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[Push SW] Notification clicked:', event);

  event.notification.close();

  // Handle action buttons
  if (event.action === 'dismiss') {
    return;
  }

  // Open the URL associated with the notification
  const urlToOpen = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate existing window to the notification URL
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('[Push SW] Notification closed:', event);
});

// Handle push subscription change (when browser refreshes the subscription)
self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[Push SW] Push subscription changed:', event);

  event.waitUntil(
    // Re-subscribe with the same options
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(function(subscription) {
        // Send the new subscription to the server
        return fetch('/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription)
        });
      })
  );
});

console.log('[Push SW] Push notification service worker loaded');

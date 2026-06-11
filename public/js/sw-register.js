// sw-register.js — Service Worker registration + Push Notification subscription
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('SW registered:', registration.scope);

      // Subscribe to push notifications after login
      if (localStorage.getItem('cc_token')) {
        await subscribeToPush(registration);
      }
    } catch (err) {
      console.warn('SW registration failed:', err);
    }
  });
}

async function subscribeToPush(registration) {
  try {
    // Check if push is supported
    if (!('PushManager' in window)) {
      console.warn('Push notifications not supported in this browser');
      return;
    }

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Fetch the VAPID public key from our server
      const response = await fetch('/api/notifications/vapid-key');
      const { publicKey } = await response.json();

      if (!publicKey) {
        console.warn('No VAPID public key configured on server');
        return;
      }

      // Convert VAPID key to Uint8Array
      const vapidKey = urlBase64ToUint8Array(publicKey);

      // Request permission and subscribe
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey
      });

      console.log('🔔 Push subscription created');
    }

    // Send the subscription to our server
    const token = localStorage.getItem('cc_token');
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(subscription)
    });

    console.log('✅ Push subscription saved to server');
  } catch (err) {
    if (Notification.permission === 'denied') {
      console.warn('🚫 Notification permission denied by user');
    } else {
      console.error('Push subscription error:', err);
    }
  }
}

// Helper: Convert Base64 URL-encoded string to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

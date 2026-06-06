import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { supabase } from './supabase';

const app = initializeApp({
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
});

export const messaging = getMessaging(app);

export async function initFCM(userId, dept) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Register the Firebase messaging service worker separately from the PWA SW
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      await supabase.from('fcm_tokens').upsert(
        { user_id: userId, dept, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    }
  } catch (err) {
    console.warn('FCM init:', err);
  }
}

// Foreground message handler — call this once in App
export function listenForeground(onAlert) {
  return onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    onAlert({ title, body, data: payload.data });
  });
}

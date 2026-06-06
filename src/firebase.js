import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from './supabase';

const app = initializeApp({
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
});

// Don't init at module level — getMessaging throws on unsupported browsers
let messaging = null;
async function getMsg() {
  if (messaging) return messaging;
  try {
    if (await isSupported()) messaging = getMessaging(app);
  } catch {}
  return messaging;
}

export async function initFCM(userId, dept) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  try {
    const msg = await getMsg();
    if (!msg) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(msg, {
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

export function listenForeground(onAlert) {
  let unsub = () => {};
  getMsg().then(msg => {
    if (!msg) return;
    unsub = onMessage(msg, payload => {
      const { title, body } = payload.notification || {};
      onAlert({ title, body, data: payload.data });
    });
  }).catch(() => {});
  return () => unsub();
}

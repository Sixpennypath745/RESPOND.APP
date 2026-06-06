importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyA7o-NA-bpVdCHFDQ2u4ULFfQ3TG2KC_cY",
  authDomain:        "respond-app-b59bd.firebaseapp.com",
  projectId:         "respond-app-b59bd",
  storageBucket:     "respond-app-b59bd.firebasestorage.app",
  messagingSenderId: "262496103218",
  appId:             "1:262496103218:web:1da6423706b764676f052b",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'RESPOND ALERT';
  const body  = payload.notification?.body  || 'New dispatch';
  self.registration.showNotification(title, {
    body,
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [100, 50, 100, 50, 200],
    data:    payload.data,
    actions: [{ action: 'open', title: 'Open App' }],
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

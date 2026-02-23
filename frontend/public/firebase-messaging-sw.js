/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// This file MUST be in /public for FCM to work

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDcZcIkmeZph_GGd7Na9dZr5ICsoSvRj2k",
    authDomain: "smart-proto-inv-2026.firebaseapp.com",
    projectId: "smart-proto-inv-2026",
    storageBucket: "smart-proto-inv-2026.firebasestorage.app",
    messagingSenderId: "1050411652100",
    appId: "1:1050411652100:web:f4e249b0c4eaef7c8b5151",
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message:', payload);

    const { title, body, icon, badge, data } = payload.notification || {};
    const notifTitle = title || 'Scorenix';
    const notifOptions = {
        body: body || 'New value bet found!',
        icon: icon || '/icons/icon-192.png',
        badge: badge || '/icons/badge-72.png',
        tag: data?.tag || 'scorenix-notification',
        data: payload.data || {},
        actions: [
            { action: 'view', title: '확인하기' },
            { action: 'dismiss', title: '닫기' },
        ],
        vibrate: [200, 100, 200],
        requireInteraction: true,
    };

    self.registration.showNotification(notifTitle, notifOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';

    if (event.action === 'view' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
                // Focus existing window if found
                for (const client of windowClients) {
                    if (client.url.includes('scorenix') && 'focus' in client) {
                        return client.focus().then((c) => c.navigate(url));
                    }
                }
                // Open new window
                return clients.openWindow(url);
            })
        );
    }
});

// ============================================================
// OPENY OS – Firebase Cloud Messaging Service Worker
// Required for FCM to deliver background push notifications.
// This file must live at the root of the served domain (/firebase-messaging-sw.js).
// ============================================================

importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAhXa5gLCMIIxuFIAj0RFeFEvAcE5TiilY",
  authDomain: "openy-suite.firebaseapp.com",
  projectId: "openy-suite",
  storageBucket: "openy-suite.firebasestorage.app",
  messagingSenderId: "735713304757",
  appId: "1:735713304757:web:62a46c1670e281efa2defc",
  measurementId: "G-6VJ1ZZPD5E",
});

const messaging = firebase.messaging();

// Handle background messages (app is not in focus).
messaging.onBackgroundMessage((payload) => {
  const { title = "OPENY OS", body = "" } = payload.notification ?? {};
  self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    data: payload.data,
  });
});

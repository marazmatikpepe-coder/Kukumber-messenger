importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBYNJPhbs8YaNAhdjSUIdj1Ok433N19GJM",
    authDomain: "kukumber-messenger.firebaseapp.com",
    databaseURL: "https://kukumber-messenger-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kukumber-messenger",
    storageBucket: "kukumber-messenger.firebasestorage.app",
    messagingSenderId: "738635892211",
    appId: "1:738635892211:web:4bf2a45b562d22e41b3e86"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('Фоновое сообщение:', payload);
    const notificationTitle = payload.notification?.title || 'K Messenger';
    const notificationOptions = {
        body: payload.notification?.body || 'Новое сообщение',
        icon: 'https://i.ibb.co/jPd3zD4K/039-C01-D0-CD06-45-F1-8151-5-B9634-D4-CBFA.png',
        badge: 'https://i.ibb.co/23pNfd0W/F449-F920-46-E7-4-E73-85-EF-26-CFF5-CAD938.jpg',
        vibrate: [200, 100, 200],
        data: payload.data || {}
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});

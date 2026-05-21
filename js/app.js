// KUKUMBER MESSENGER - APP.JS (исправленный: поиск, настройки, профиль)
var firebaseConfig = {
    apiKey: "AIzaSyBYNJPhbs8YaNAhdjSUIdj1Ok433N19GJM",
    authDomain: "kukumber-messenger.firebaseapp.com",
    databaseURL: "https://kukumber-messenger-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kukumber-messenger",
    storageBucket: "kukumber-messenger.firebasestorage.app",
    messagingSenderId: "738635892211",
    appId: "1:738635892211:web:4bf2a45b562d22e41b3e86"
};

firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var database = firebase.database();

var currentUser = null;
var currentUserData = null;
var currentChatId = null;
var currentChatUser = null;
var messagesListener = null;
var currentTab = 'chats';
var isSuperAdmin = false;

window.addEventListener('load', function() {
    setTimeout(function() {
        var loading = document.getElementById('loading-screen');
        if (loading) loading.classList.add('hidden');
        checkAuthState();
    }, 1500);
    initEmojiPicker();
});

function checkAuthState() {
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            loadUserData();
        } else {
            currentUser = null;
            currentUserData = null;
            showAuthScreen();
        }
    });
}

function loadUserData() {
    if (!currentUser) return;
    database.ref('users/' + currentUser.uid).on('value', function(snapshot) {
        currentUserData = snapshot.val();
        if (currentUserData) {
            updateUserDisplay();
            checkSuperAdmin();
            showMainScreen();
            
            // ОБЯЗАТЕЛЬНО ЗАГРУЖАЕМ ЧАТЫ
            if (typeof loadChats === 'function') {
                setTimeout(function() {
                    loadChats();
                }, 500);
            }
            
            // ... остальной код
            // Обновляем аватарку в Slices
            var slicesAvatar = document.getElementById('slices-user-avatar');
            if (slicesAvatar) {
                if (currentUserData.avatar) {
                    slicesAvatar.style.backgroundImage = 'url(' + currentUserData.avatar + ')';
                    slicesAvatar.style.backgroundSize = 'cover';
                    slicesAvatar.textContent = '';
                } else {
                    slicesAvatar.style.backgroundImage = '';
                    slicesAvatar.textContent = '🥒';
                }
            }
            
            // ===== ДОБАВЬ ЭТИ СТРОКИ ДЛЯ PUSH-УВЕДОМЛЕНИЙ =====
            if (typeof requestNotificationPermission === 'function') {
                requestNotificationPermission();
                setupForegroundMessages();
            }
            // ================================================
        }
    });
}
function checkSuperAdmin() {
    database.ref('users/' + currentUser.uid + '/isSuperAdmin').once('value').then(function(snap) {
        isSuperAdmin = snap.val() === true;
        window.isSuperAdmin = isSuperAdmin;
    });
}

function updateUserDisplay() {
    if (!currentUserData) return;
    var username = currentUserData.username || 'Пользователь';
    var avatar = currentUserData.avatar || '';
    document.getElementById('current-username').textContent = username;
    document.getElementById('settings-username').textContent = username;
    
    // Функция для установки аватарки с дефолтом
    function setAvatar(element, avatarUrl, type) {
        if (!element) return;
        if (avatarUrl) {
            element.style.backgroundImage = 'url(' + avatarUrl + ')';
            element.style.backgroundSize = 'cover';
            element.textContent = '';
            element.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
        } else {
            element.style.backgroundImage = '';
            element.classList.add('default-avatar-' + type);
            element.textContent = '';
        }
    }
    
    setAvatar(document.getElementById('user-avatar'), avatar, 'user');
    setAvatar(document.getElementById('settings-avatar'), avatar, 'user');
    
    // Для Slices аватарки
    var slicesAvatar = document.getElementById('slices-user-avatar');
    if (slicesAvatar) {
        if (avatar) {
            slicesAvatar.style.backgroundImage = 'url(' + avatar + ')';
            slicesAvatar.style.backgroundSize = 'cover';
            slicesAvatar.textContent = '';
            slicesAvatar.classList.remove('default-avatar-user');
        } else {
            slicesAvatar.style.backgroundImage = '';
            slicesAvatar.classList.add('default-avatar-user');
            slicesAvatar.textContent = '';
        }
    }
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
}

function showMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    
    // Загружаем чаты
    if (typeof loadChats === 'function') {
        console.log('Загрузка чатов...');
        loadChats();
    } else {
        console.error('loadChats не определена');
    }
    
    // Загружаем слайсы
    setTimeout(function() {
        if (typeof loadSlices === 'function') {
            loadSlices();
        }
    }, 300);
}
function switchToTab(tabName) {
    currentTab = tabName;
    
    document.getElementById('chats-tab').classList.add('hidden');
    document.getElementById('reels-tab').classList.add('hidden');
    document.getElementById('settings-tab').classList.add('hidden');
    
    document.getElementById('nav-chats').classList.remove('active');
    document.getElementById('nav-reels').classList.remove('active');
    document.getElementById('nav-settings').classList.remove('active');
    
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.getElementById('nav-' + tabName).classList.add('active');
    
    if (tabName === 'reels' && typeof loadSlices === 'function') {
        loadSlices();
    }
    if (tabName === 'chats' && typeof loadChats === 'function') {
        console.log('Переключение на чаты, загрузка...');
        loadChats();
    }
    if (tabName === 'settings' && typeof updateUserDisplay === 'function') {
        updateUserDisplay();
        // Обновляем язык в настройках
        if (typeof applyTranslations === 'function') applyTranslations();
    }
    
    closeSidebar();
}
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = now - date;
    if (diff < 60000) return 'сейчас';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин';
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatLastSeen(timestamp) {
    if (!timestamp) return 'неизвестно';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' минут назад';
    if (diff < 86400) return 'сегодня в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    return date.toLocaleDateString('ru-RU') + ' в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
}

function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + '_' + userId2 : userId2 + '_' + userId1;
}

function showNotification(message, type) {
    type = type || 'info';
    var container = document.getElementById('notifications-container');
    if (!container) return;
    var notif = document.createElement('div');
    notif.className = 'notification ' + type;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(function() { if (notif) notif.remove(); }, 3000);
}

function initEmojiPicker() {
    var emojis = ['😀','😂','🥰','😎','🤔','😢','😡','👍','👎','❤️','🔥','✨','🎉','🥒','💚','🌿','🍀','🌱','👋','🙏','😊','😍','🤣','😘','😜','🙄','😴','🤮','💪','🎂','🎁','🎄','☀️','🌙','⭐','🌈'];
    var grid = document.querySelector('.emoji-grid');
    if (grid) {
        grid.innerHTML = '';
        emojis.forEach(function(emoji) {
            var span = document.createElement('span');
            span.textContent = emoji;
            span.onclick = function() { insertEmoji(emoji); };
            grid.appendChild(span);
        });
    }
}

function toggleEmojiPicker() {
    var picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.toggle('hidden');
}

function insertEmoji(emoji) {
    var input = document.getElementById('message-input');
    if (input) {
        input.value += emoji;
        input.focus();
    }
}

document.addEventListener('click', function(e) {
    var picker = document.getElementById('emoji-picker');
    if (picker && !picker.classList.contains('hidden') && !picker.contains(e.target) && !e.target.closest('.emoji-btn')) {
        picker.classList.add('hidden');
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAllModals();
});

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(function(m) {
        m.classList.add('hidden');
    });
    var picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.add('hidden');
}

// Функции для настроек (чтобы не падали ошибки)
//function showNotificationSettings() { showNotification('Уведомления: в разработке', 'info'); }
//function showPrivacySettings() { showNotification('Конфиденциальность: в разработке', 'info'); }
//function showThemeSettings() { showNotification('Тема: в разработке', 'info'); }
function showLanguageSettings() { 
    if (typeof window.showLanguageSettings === 'function') {
        window.showLanguageSettings();
    } else {
        showNotification('Язык: в разработке', 'info');
    }
}
function showStorageSettings() { showNotification('Данные и память: в разработке', 'info'); }
function showAbout() { alert('K Messenger v1.0\nСвежее общение каждый день 🥒'); }
function showHelp() { showNotification('Помощь: в разработке', 'info'); }
function logout() {
    if (!confirm('Вы уверены, что хотите выйти?')) return;
    if (messagesListener) messagesListener.off();
    auth.signOut().then(function() {
        currentUser = null;
        currentUserData = null;
        currentChatId = null;
        currentChatUser = null;
        showNotification('Вы вышли', 'info');
        location.reload(); // Принудительная перезагрузка
    }).catch(function() { 
        showNotification('Ошибка выхода', 'error'); 
    });
}
// ========== PUSH-УВЕДОМЛЕНИЯ ==========
async function requestNotificationPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        console.log('Push-уведомления не поддерживаются');
        return false;
    }
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.log('Разрешение на уведомления не получено');
        return false;
    }
    
    try {
        const messaging = firebase.messaging();
        
        // Регистрируем Service Worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker зарегистрирован');
        
        // Получаем токен
        const token = await messaging.getToken({
            serviceWorkerRegistration: registration,
            vapidKey: 'BJSObaY_-k70LbjMB89bpLyBV9zL4KhzzwbRpyIHjT6pjjOM09S7xDagdlMnTV4XiISYklhrVZNk3HetaTuL5a4'
        });
        
        if (token) {
            console.log('FCM Token:', token);
            // Сохраняем токен в базе
            if (currentUser) {
                await database.ref('users/' + currentUser.uid + '/fcmToken').set(token);
            }
            return true;
        }
    } catch (err) {
        console.error('Ошибка получения токена:', err);
    }
    return false;
}

// Обработка уведомлений когда приложение открыто
function setupForegroundMessages() {
    const messaging = firebase.messaging();
    messaging.onMessage((payload) => {
        console.log('Уведомление в активном окне:', payload);
        // Показываем уведомление даже если сайт открыт
        if (Notification.permission === 'granted') {
            new Notification(payload.notification?.title || 'K Messenger', {
                body: payload.notification?.body || 'Новое сообщение',
                icon: 'https://i.ibb.co/jPd3zD4K/039-C01-D0-CD06-45-F1-8151-5-B9634-D4-CBFA.png'
            });
        }
    });
}

// Вызови эти функции после входа пользователя
// Например, в loadUserData() добавь:
// requestNotificationPermission();
// setupForegroundMessages();
// ========== СВАЙПЫ МЕЖДУ ВКЛАДКАМИ ==========
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let isSwiping = false;

const tabs = ['chats', 'reels', 'settings'];
let currentTabIndex = 0;

function getCurrentTabIndex() {
    const activeTab = document.querySelector('.tab-content:not(.hidden)').id;
    return tabs.indexOf(activeTab.replace('-tab', ''));
}

function switchToTabBySwipe(direction) {
    let currentIdx = getCurrentTabIndex();
    let newIdx = currentIdx + direction;
    
    if (newIdx >= 0 && newIdx < tabs.length) {
        switchToTab(tabs[newIdx]);
    }
}

document.getElementById('main-screen').addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    isSwiping = true;
}, { passive: true });

document.getElementById('main-screen').addEventListener('touchend', function(e) {
    if (!isSwiping) return;
    
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Горизонтальный свайп (игнорируем вертикальные)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
            // Свайп вправо → предыдущая вкладка
            switchToTabBySwipe(-1);
        } else {
            // Свайп влево → следующая вкладка
            switchToTabBySwipe(1);
        }
    }
    
    isSwiping = false;
}, { passive: true });
// ========== СВАЙП ДЛЯ ЗАКРЫТИЯ МОДАЛЬНЫХ ОКОН ==========
document.querySelectorAll('.modal').forEach(modal => {
    let modalStartY = 0;
    let modalCurrentY = 0;
    
    modal.addEventListener('touchstart', function(e) {
        modalStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    modal.addEventListener('touchend', function(e) {
        modalCurrentY = e.changedTouches[0].screenY;
        const deltaY = modalCurrentY - modalStartY;
        
        // Свайп вниз на 100px → закрыть
        if (deltaY > 100) {
            modal.classList.add('hidden');
            closeAllModals();
        }
    }, { passive: true });
});
// ========== СВАЙП ДЛЯ БОКОВОЙ ПАНЕЛИ ==========
let sidebarStartX = 0;
let sidebarEndX = 0;

document.getElementById('chat-area').addEventListener('touchstart', function(e) {
    sidebarStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.getElementById('chat-area').addEventListener('touchend', function(e) {
    sidebarEndX = e.changedTouches[0].screenX;
    const deltaX = sidebarEndX - sidebarStartX;
    
    // Свайп от левого края (первые 30px) вправо → открыть панель
    if (sidebarStartX < 30 && deltaX > 50) {
        openSidebar();
    }
    
    // Свайп влево при открытой панели → закрыть
    if (deltaX < -50) {
        closeSidebar();
    }
}, { passive: true });

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
}
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    
    sidebar.classList.toggle('open');
    
    // Скрываем/показываем кнопку меню при открытии панели
    if (sidebar.classList.contains('open')) {
        if (menuBtn) menuBtn.style.opacity = '0';
    } else {
        if (menuBtn) menuBtn.style.opacity = '1';
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    
    sidebar.classList.remove('open');
    if (menuBtn) menuBtn.style.opacity = '1';
}
// ========== СВАЙП ВЛЕВО ДЛЯ ЗАКРЫТИЯ ПАНЕЛИ ==========
const sidebarElement = document.getElementById('sidebar');
let sidebarSwipeStartX = 0;

sidebarElement.addEventListener('touchstart', function(e) {
    sidebarSwipeStartX = e.changedTouches[0].screenX;
}, { passive: true });

sidebarElement.addEventListener('touchend', function(e) {
    const sidebarSwipeEndX = e.changedTouches[0].screenX;
    const deltaX = sidebarSwipeEndX - sidebarSwipeStartX;
    
    // Свайп влево (отрицательный) — закрыть панель
    if (deltaX < -50) {
        closeSidebar();
    }
}, { passive: true });
// ===== ФИКС ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК =====
var originalSwitchToTab = window.switchToTab;
window.switchToTab = function(tabName) {
    document.getElementById('chats-tab').classList.add('hidden');
    document.getElementById('reels-tab').classList.add('hidden');
    document.getElementById('settings-tab').classList.add('hidden');
    
    document.getElementById('nav-chats').classList.remove('active');
    document.getElementById('nav-reels').classList.remove('active');
    document.getElementById('nav-settings').classList.remove('active');
    
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.getElementById('nav-' + tabName).classList.add('active');
    
    if (tabName === 'reels' && typeof loadSlices === 'function') loadSlices();
    if (tabName === 'chats' && typeof loadChats === 'function') loadChats();
    if (tabName === 'settings' && typeof updateUserDisplay === 'function') updateUserDisplay();
    
    closeSidebar();
};
// Глобальная функция для открытия профиля пользователя
window.openUserProfile = function(userId) {
    if (typeof openUserProfileFromChat === 'function') {
        openUserProfileFromChat(userId);
    } else if (typeof openUserProfile === 'function') {
        openUserProfile(userId);
    } else if (typeof window.openUserProfileModal === 'function') {
        window.openUserProfileModal(userId);
    } else {
        console.warn('Функция профиля не найдена, загружаем slices.js');
        if (typeof loadSlices === 'function') {
            showNotification('Профиль загружается...', 'info');
        }
    }
};
// ========== ПРИНУДИТЕЛЬНАЯ АВТОРИЗАЦИЯ ==========
// Перехватываем ошибки Firebase
window.addEventListener('load', function() {
    console.log('Страница загружена, проверяем авторизацию...');
    
    // Проверяем, есть ли сохранённая сессия
    setTimeout(function() {
        if (!currentUser) {
            console.log('Нет активного пользователя, проверяем Firebase...');
            
            // Пробуем получить текущего пользователя напрямую
            var firebaseUser = auth.currentUser;
            if (firebaseUser) {
                console.log('Найден пользователь через auth.currentUser:', firebaseUser.uid);
                currentUser = firebaseUser;
                loadUserData();
            } else {
                console.log('Пользователь не найден, показываем экран входа');
                showAuthScreen();
            }
        }
    }, 1000);
});

// Форсированная проверка каждые 2 секунды (на случай, если Firebase долго инициализируется)
var authCheckInterval = setInterval(function() {
    if (auth && auth.currentUser) {
        if (!currentUser) {
            console.log('Интервал: найден пользователь!', auth.currentUser.uid);
            currentUser = auth.currentUser;
            loadUserData();
            clearInterval(authCheckInterval);
        }
    } else if (document.getElementById('main-screen') && !document.getElementById('main-screen').classList.contains('hidden')) {
        // Если main-screen виден, но пользователя нет - показываем вход
        if (!currentUser && !auth.currentUser) {
            showAuthScreen();
        }
    }
}, 2000);

// Исправление входа
window.forceLogin = function(email, password) {
    console.log('Принудительный вход:', email);
    return auth.signInWithEmailAndPassword(email, password);
};

// Исправление регистрации
window.forceRegister = function(username, email, password) {
    console.log('Принудительная регистрация:', email);
    return auth.createUserWithEmailAndPassword(email, password).then(function(userCredential) {
        var user = userCredential.user;
        return database.ref('users/' + user.uid).set({
            username: username,
            email: email,
            avatar: '',
            bio: '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: { online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP }
        }).then(function() {
            return database.ref('usernames/' + username.toLowerCase()).set(user.uid);
        });
    });
};
// ========== PUSH-УВЕДОМЛЕНИЯ ==========
async function sendPushNotification(recipientId, title, body, chatId) {
    try {
        const tokenSnapshot = await database.ref('users/' + recipientId + '/fcmToken').once('value');
        const token = tokenSnapshot.val();
        
        if (!token) {
            console.log('Нет токена у пользователя', recipientId);
            return;
        }
        
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=AAAAvNcyvSU:APA91bE2G-ybuDgJLvKv2rJghVQVYOE74w3Jq6yLdgpQv9YGlJ__P21hUq70dMsQ15cBPG0OZ1-JnMj0v3c6K7OQthRdua2RkS5MQe5N2ypAt4ooScdrBWY5VrHD-K4pO-0SeWXh33MF'
            },
            body: JSON.stringify({
                to: token,
                notification: {
                    title: title,
                    body: body,
                    icon: 'https://i.ibb.co/jPd3zD4K/039-C01-D0-CD06-45-F1-8151-5-B9634-D4-CBFA.png',
                    badge: 'https://i.ibb.co/23pNfd0W/F449-F920-46-E7-4-E73-85-EF-26-CFF5-CAD938.jpg',
                    vibrate: [200, 100, 200],
                    sound: 'default'
                },
                data: {
                    chatId: chatId,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                }
            })
        });
        
        const data = await response.json();
        console.log('Push отправлен:', data);
        
    } catch (err) {
        console.error('Ошибка отправки push:', err);
    }
}

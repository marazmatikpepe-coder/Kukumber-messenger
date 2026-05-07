// KUKUMBER MESSENGER - APP.JS (исправленный)
var firebaseConfig = {
    apiKey: "AIzaSyBYNJPhbs8YaNAhdjSUIdj1Ok433N19GJM",
    authDomain: "kukumber-messenger.firebaseapp.com",
    databaseURL: "https://kukumber-messenger-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kukumber-messenger",
    storageBucket: "kukumber-messenger.firebasestorage.app",
    messagingSenderId: "738635892211",
    appId: "1:738635892211:web:4bf2a45b562d22e41b3e86"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var database = firebase.database();

// Глобальные переменные
var currentUser = null;
var currentUserData = null;
var currentChatId = null;
var currentChatUser = null;
var messagesListener = null;
var currentTab = 'chats';
var isSuperAdmin = false;

// Загрузка страницы
window.addEventListener('load', function() {
    // Показываем загрузку 1.5 секунды
    setTimeout(function() {
        var loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
        checkAuthState();
    }, 1500);
    initEmojiPicker();
});

// Проверка авторизации
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

// Загрузка данных пользователя
function loadUserData() {
    if (!currentUser) return;
    
    var userRef = database.ref('users/' + currentUser.uid);
    userRef.on('value', function(snapshot) {
        currentUserData = snapshot.val();
        
        if (currentUserData) {
            // Обновляем отображение
            updateUserDisplay();
            checkSuperAdmin();
            
            // Показываем главный экран
            showMainScreen();
            
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
        }
    }, function(error) {
        console.error('Ошибка загрузки данных пользователя:', error);
    });
}

// Проверка суперадмина
function checkSuperAdmin() {
    database.ref('users/' + currentUser.uid + '/isSuperAdmin').once('value').then(function(snap) {
        isSuperAdmin = snap.val() === true;
        window.isSuperAdmin = isSuperAdmin;
    });
}

// Обновление отображения пользователя
function updateUserDisplay() {
    if (!currentUserData) return;
    
    var username = currentUserData.username || 'Пользователь';
    var avatar = currentUserData.avatar || '';
    
    // Обновляем имя везде
    var usernameElements = ['current-username', 'settings-username'];
    usernameElements.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = username;
    });
    
    // Обновляем аватарку
    var avatarElements = ['user-avatar', 'settings-avatar'];
    avatarElements.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            if (avatar) {
                el.style.backgroundImage = 'url(' + avatar + ')';
                el.style.backgroundSize = 'cover';
                el.textContent = '';
            } else {
                el.style.backgroundImage = '';
                el.textContent = '🥒';
            }
        }
    });
}

// Показать экран авторизации
function showAuthScreen() {
    var authScreen = document.getElementById('auth-screen');
    var mainScreen = document.getElementById('main-screen');
    if (authScreen) authScreen.classList.remove('hidden');
    if (mainScreen) mainScreen.classList.add('hidden');
}

// Показать главный экран
function showMainScreen() {
    var authScreen = document.getElementById('auth-screen');
    var mainScreen = document.getElementById('main-screen');
    
    if (authScreen) authScreen.classList.add('hidden');
    if (mainScreen) mainScreen.classList.remove('hidden');
    
    // Загружаем чаты
    if (typeof loadChats === 'function') {
        loadChats();
    }
    
    // Загружаем Slices с небольшой задержкой
    setTimeout(function() {
        if (typeof loadSlices === 'function') {
            loadSlices();
        }
    }, 300);
}

// Переключение вкладок
function switchToTab(tabName) {
    if (!tabName) return;
    
    currentTab = tabName;
    
    // Скрываем все вкладки
    var tabs = ['chats-tab', 'reels-tab', 'settings-tab'];
    tabs.forEach(function(tab) {
        var el = document.getElementById(tab);
        if (el) el.classList.add('hidden');
    });
    
    // Убираем active со всех кнопок
    var navBtns = ['nav-chats', 'nav-reels', 'nav-settings'];
    navBtns.forEach(function(btn) {
        var el = document.getElementById(btn);
        if (el) el.classList.remove('active');
    });
    
    // Показываем выбранную вкладку
    var activeTab = document.getElementById(tabName + '-tab');
    if (activeTab) activeTab.classList.remove('hidden');
    
    // Активируем кнопку
    var activeBtn = document.getElementById('nav-' + tabName);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Действия при переключении
    if (tabName === 'reels') {
        if (typeof loadSlices === 'function') {
            loadSlices();
        }
    }
    if (tabName === 'settings') {
        updateUserDisplay();
    }
    if (tabName === 'chats') {
        if (typeof loadChats === 'function') {
            loadChats();
        }
    }
    
    // Закрываем боковое меню на мобильных
    closeSidebar();
}

// Открыть/закрыть боковое меню
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

function closeSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Форматирование времени
function formatTime(timestamp) {
    if (!timestamp) return '';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = now - date;
    
    if (diff < 60000) return 'сейчас';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин';
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// Форматирование последнего визита
function formatLastSeen(timestamp) {
    if (!timestamp) return 'неизвестно';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' минут назад';
    if (diff < 86400) {
        return 'сегодня в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    }
    return date.toLocaleDateString('ru-RU') + ' в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
}

// Генерация ID чата
function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + '_' + userId2 : userId2 + '_' + userId1;
}

// Показать уведомление
function showNotification(message, type) {
    type = type || 'info';
    var container = document.getElementById('notifications-container');
    if (!container) return;
    
    var notif = document.createElement('div');
    notif.className = 'notification ' + type;
    notif.textContent = message;
    container.appendChild(notif);
    
    setTimeout(function() {
        if (notif && notif.remove) notif.remove();
    }, 3000);
}

// Инициализация эмодзи
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

// Показать/скрыть панель эмодзи
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

// Закрытие модалок по Escape
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

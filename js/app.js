// KUKUMBER MESSENGER - APP.JS (основной файл)
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
        document.getElementById('loading-screen').classList.add('hidden'); 
        checkAuthState(); 
    }, 2000);
    initEmojiPicker();
});

function checkAuthState() {
    auth.onAuthStateChanged(function(user) {
        if (user) { 
            currentUser = user; 
            loadUserData(); 
            showMainScreen(); 
        }
        else { 
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
    });
}

function checkSuperAdmin() { 
    database.ref('users/' + currentUser.uid + '/isSuperAdmin').once('value').then(snap => { 
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
    ['user-avatar', 'settings-avatar'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            if (avatar) { 
                el.style.backgroundImage = 'url(' + avatar + ')'; 
                el.style.backgroundSize = 'cover'; 
                el.textContent = ''; 
            }
            else { 
                el.style.backgroundImage = ''; 
                el.textContent = '🥒'; 
            }
        }
    });
}

function showAuthScreen() { 
    document.getElementById('auth-screen').classList.remove('hidden'); 
    document.getElementById('main-screen').classList.add('hidden'); 
}

function showMainScreen() { 
    document.getElementById('auth-screen').classList.add('hidden'); 
    document.getElementById('main-screen').classList.remove('hidden'); 
    loadChats(); 
    // Загружаем Slices сразу, но с небольшой задержкой для авторизации
    setTimeout(function() {
        if (typeof loadSlices === 'function') {
            loadSlices();
        }
    }, 500);
}

function switchToTab(tabName) {
    currentTab = tabName;
    
    // Скрываем все вкладки
    document.getElementById('chats-tab').classList.add('hidden');
    document.getElementById('reels-tab').classList.add('hidden');
    document.getElementById('settings-tab').classList.add('hidden');
    
    // Убираем active со всех кнопок навигации
    document.getElementById('nav-chats').classList.remove('active');
    document.getElementById('nav-reels').classList.remove('active');
    document.getElementById('nav-settings').classList.remove('active');
    
    // Показываем выбранную вкладку
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.getElementById('nav-' + tabName).classList.add('active');
    
    // Действия при переключении на конкретные вкладки
    if (tabName === 'reels') { 
        if (typeof loadSlices === 'function') {
            loadSlices(); 
        }
    }
    if (tabName === 'settings') { 
        updateUserDisplay(); 
    }
    if (tabName === 'chats') {
        loadChats();
    }
    
    closeSidebar();
}

function toggleSidebar() { 
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open'); 
}

function closeSidebar() { 
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open'); 
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
    setTimeout(function() { 
        if (notif) notif.remove(); 
    }, 3000);
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
    var emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker) emojiPicker.classList.add('hidden');
}

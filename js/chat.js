// KUKUMBER MESSENGER - CHAT.JS (ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ)

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var messagesListener = null;
var chatsListener = null;
var typingTimeout = null;
var loadedMessageIds = new Set();

// Кэши для оптимизации
var userCache = {
    names: {},
    avatars: {},
    statuses: {}
};

// Функция для получения текущего пользователя из app.js
function getCurrentUser() {
    return window.currentUser;
}

function getCurrentUserData() {
    return window.currentUserData;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
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
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatLastSeen(timestamp) {
    if (!timestamp) return 'неизвестно';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff / 60) + ' минут назад';
    if (diff < 86400) {
        return 'сегодня в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU') + ' в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + '_' + userId2 : userId2 + '_' + userId1;
}

function showNotification(message, type) {
    type = type || 'info';
    var container = document.getElementById('notifications-container');
    if (!container) {
        console.log('Уведомление:', message);
        alert(message);
        return;
    }
    var notif = document.createElement('div');
    notif.className = 'notification ' + type;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(function() {
        if (notif) notif.remove();
    }, 3000);
}

// ========== ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ==========
async function getUserData(userId) {
    if (!userId) return null;
    
    if (userCache.names[userId] && Date.now() - (userCache.names[userId]._time || 0) < 60000) {
        return {
            username: userCache.names[userId].value,
            avatar: userCache.avatars[userId]?.value || '',
            status: userCache.statuses[userId]?.value || { online: false }
        };
    }
    
    try {
        var snapshot = await window.database.ref('users/' + userId).once('value');
        var data = snapshot.val();
        if (data) {
            userCache.names[userId] = { value: data.username || 'Пользователь', _time: Date.now() };
            userCache.avatars[userId] = { value: data.avatar || '', _time: Date.now() };
            userCache.statuses[userId] = { value: data.status || { online: false }, _time: Date.now() };
            return {
                username: data.username || 'Пользователь',
                avatar: data.avatar || '',
                status: data.status || { online: false }
            };
        }
    } catch (err) {
        console.error('Ошибка получения данных пользователя:', err);
    }
    return { username: 'Пользователь', avatar: '', status: { online: false } };
}

function getUsername(userId) {
    return getUserData(userId).then(data => data.username);
}

function getUserAvatar(userId) {
    return getUserData(userId).then(data => data.avatar);
}

function getUserStatus(userId) {
    return getUserData(userId).then(data => data.status);
}

// ========== ЗАГРУЗКА СПИСКА ЧАТОВ ==========
function loadChats() {
    console.log('loadChats() вызвана');
    
    var currentUser = getCurrentUser();
    if (!currentUser || !currentUser.uid) {
        console.log('Нет авторизованного пользователя');
        return;
    }
    
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) {
        console.error('Элемент chats-list не найден');
        return;
    }
    
    chatsList.innerHTML = '<div class="empty-chats">🔄 Загрузка чатов...</div>';
    
    if (chatsListener) {
        chatsListener.off();
    }
    
    chatsListener = window.database.ref('userChats/' + currentUser.uid);
    chatsListener.on('value', async function(snapshot) {
        var userChats = snapshot.val();
        
        if (!userChats || Object.keys(userChats).length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов. Начните диалог!</div>';
            return;
        }
        
        var chatIds = Object.keys(userChats);
        var chatsData = {};
        
        for (var i = 0; i < chatIds.length; i++) {
            var chatId = chatIds[i];
            try {
                var chatSnap = await window.database.ref('chats/' + chatId).once('value');
                var chat = chatSnap.val();
                if (chat) {
                    chatsData[chatId] = chat;
                }
            } catch (err) {
                console.error('Ошибка загрузки чата', chatId, err);
            }
        }
        
        renderChatsList(chatsData);
        
    }, function(error) {
        console.error('Ошибка загрузки чатов:', error);
        chatsList.innerHTML = '<div class="empty-chats">❌ Ошибка загрузки чатов</div>';
    });
}

function renderChatsList(chatsData) {
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) return;
    
    var chatIds = Object.keys(chatsData);
    if (chatIds.length === 0) {
        chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов</div>';
        return;
    }
    
    var chatsArray = [];
    for (var chatId in chatsData) {
        chatsArray.push({
            id: chatId,
            data: chatsData[chatId]
        });
    }
    
    chatsArray.sort(function(a, b) {
        return (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0);
    });
    
    chatsList.innerHTML = '';
    
    for (var i = 0; i < chatsArray.length; i++) {
        (function(chat) {
            createChatItem(chat.id, chat.data, chatsList);
        })(chatsArray[i]);
    }
    
    setTimeout(function() {
        attachChatClickHandlers();
    }, 100);
}

async function createChatItem(chatId, chatData, container) {
    var currentUser = getCurrentUser();
    var div = document.createElement('div');
    div.className = 'chat-item';
    div.setAttribute('data-chat-id', chatId);
    
    if (window.currentChatId === chatId) {
        div.classList.add('active');
    }
    
    var name = '';
    var avatarUrl = '';
    var avatarContent = '';
    var badge = '';
    var isOnline = false;
    var preview = chatData.lastMessage || 'Нет сообщений';
    var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
    
    if (preview.length > 50) {
        preview = preview.substring(0, 47) + '...';
    }
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatarUrl = chatData.avatar || '';
        avatarContent = avatarUrl ? '' : '👥';
        badge = '<span class="chat-type-badge">👥</span>';
        renderItem();
    } 
    else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatarUrl = chatData.avatar || '';
        avatarContent = avatarUrl ? '' : '📢';
        badge = '<span class="chat-type-badge">📢</span>';
        renderItem();
    } 
    else {
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== currentUser.uid) {
                    otherUserId = chatData.participants[i];
                    break;
                }
            }
        }
        
        if (otherUserId) {
            var userData = await getUserData(otherUserId);
            name = userData.username;
            avatarUrl = userData.avatar;
            isOnline = userData.status.online === true;
            avatarContent = avatarUrl ? '' : '👤';
            renderItem();
        } else {
            name = 'Пользователь';
            renderItem();
        }
    }
    
    function renderItem() {
        var avatarStyle = avatarUrl ? 'background-image: url(' + avatarUrl + '); background-size: cover; background-position: center;' : '';
        
        div.innerHTML = `
            <div class="chat-item-avatar">
                <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                ${isOnline ? '<div class="online-indicator"></div>' : ''}
                ${badge}
            </div>
            <div class="chat-item-info">
                <div class="chat-item-header">
                    <span class="chat-item-name">${escapeHtml(name)}</span>
                    <span class="chat-item-time">${time}</span>
                </div>
                <div class="chat-item-preview">${escapeHtml(preview)}</div>
            </div>
        `;
        
        container.appendChild(div);
    }
}

function attachChatClickHandlers() {
    var chatItems = document.querySelectorAll('.chat-item');
    console.log('Привязка обработчиков к чатам, найдено:', chatItems.length);
    
    chatItems.forEach(function(item) {
        var chatId = item.getAttribute('data-chat-id');
        if (!chatId) return;
        
        item.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Клик по чату:', chatId);
            openChatById(chatId);
            return false;
        };
        
        item.style.cursor = 'pointer';
    });
}

// ========== ОТКРЫТИЕ ЧАТА ==========
async function openChatById(chatId) {
    console.log('openChatById:', chatId);
    
    var currentUser = getCurrentUser();
    
    if (!chatId) {
        console.error('Нет ID чата');
        return;
    }
    
    if (!currentUser || !currentUser.uid) {
        console.error('Нет пользователя');
        return;
    }
    
    if (window.innerWidth <= 768) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    }
    
    try {
        var chatSnap = await window.database.ref('chats/' + chatId).once('value');
        var chatData = chatSnap.val();
        
        if (!chatData) {
            showNotification('Чат не найден', 'error');
            return;
        }
        
        openChatWithData(chatId, chatData);
    } catch (err) {
        console.error('Ошибка открытия чата:', err);
        showNotification('Ошибка открытия чата', 'error');
    }
}

function openChatWithData(chatId, chatData) {
    console.log('openChatWithData:', chatId, chatData.type);
    
    // Сохраняем глобальные переменные
    window.currentChatId = chatId;
    window.currentChatData = chatData;
    window.currentChatData.chatId = chatId;
    
    // Обновляем активный класс в списке чатов
    document.querySelectorAll('.chat-item').forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('data-chat-id') === chatId) {
            item.classList.add('active');
        }
    });
    
    // ПОКАЗЫВАЕМ ОБЛАСТЬ ЧАТА - ЭТО САМОЕ ГЛАВНОЕ!
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    if (noChatElement) {
        noChatElement.classList.add('hidden');
        console.log('Скрыли no-chat-selected');
    }
    if (activeChatElement) {
        activeChatElement.classList.remove('hidden');
        console.log('Показали active-chat');
    }
    
    // Очищаем контейнер сообщений
    var messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
        loadedMessageIds.clear();
    }
    
    // Обновляем шапку чата
    updateChatHeaderAsync(chatId, chatData);
    
    // Загружаем сообщения
    loadMessages(chatId);
    
    // Настраиваем слушатель печати
    setupTypingListener(chatId);
    
    // Настраиваем клик по шапке
    var chatUserInfo = document.querySelector('.chat-user-info');
    if (chatUserInfo) {
        var newElement = chatUserInfo.cloneNode(true);
        chatUserInfo.parentNode.replaceChild(newElement, chatUserInfo);
        
        newElement.onclick = function() {
            openChatProfileInfo();
        };
    }
    
    console.log('Чат успешно открыт:', chatId);
}

async function updateChatHeaderAsync(chatId, chatData) {
    var currentUser = getCurrentUser();
    var chatUsername = document.getElementById('chat-username');
    var chatStatus = document.getElementById('chat-status');
    var chatAvatar = document.getElementById('chat-avatar');
    
    if (!chatUsername) return;
    
    if (chatData.type === 'group') {
        chatUsername.textContent = chatData.name || 'Группа';
        if (chatStatus) {
            var membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
            chatStatus.textContent = membersCount + ' участников';
        }
        if (chatAvatar) {
            if (chatData.avatar) {
                chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
                chatAvatar.style.backgroundSize = 'cover';
                chatAvatar.textContent = '';
            } else {
                chatAvatar.style.backgroundImage = '';
                chatAvatar.textContent = '👥';
            }
        }
    } 
    else if (chatData.type === 'channel') {
        chatUsername.textContent = chatData.name || 'Канал';
        if (chatStatus) {
            var subsCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
            chatStatus.textContent = subsCount + ' подписчиков';
        }
        if (chatAvatar) {
            if (chatData.avatar) {
                chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
                chatAvatar.style.backgroundSize = 'cover';
                chatAvatar.textContent = '';
            } else {
                chatAvatar.style.backgroundImage = '';
                chatAvatar.textContent = '📢';
            }
        }
    } 
    else {
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== currentUser.uid) {
                    otherUserId = chatData.participants[i];
                    break;
                }
            }
        }
        
        if (otherUserId) {
            window.currentChatData.otherUserId = otherUserId;
            var userData = await getUserData(otherUserId);
            
            chatUsername.textContent = userData.username;
            
            if (chatStatus) {
                if (userData.status.online) {
                    chatStatus.innerHTML = 'в сети';
                } else {
                    chatStatus.innerHTML = formatLastSeen(userData.status.lastSeen);
                }
            }
            
            if (chatAvatar) {
                if (userData.avatar) {
                    chatAvatar.style.backgroundImage = 'url(' + userData.avatar + ')';
                    chatAvatar.style.backgroundSize = 'cover';
                    chatAvatar.textContent = '';
                } else {
                    chatAvatar.style.backgroundImage = '';
                    chatAvatar.textContent = '👤';
                }
            }
        } else {
            chatUsername.textContent = 'Пользователь';
            if (chatStatus) chatStatus.textContent = 'неизвестно';
        }
    }
}

function openChatProfileInfo() {
    if (!window.currentChatData) return;
    
    if (window.currentChatData.type === 'private' && window.currentChatData.otherUserId) {
        if (typeof window.openUserProfile === 'function') {
            window.openUserProfile(window.currentChatData.otherUserId);
        } else {
            showNotification('Профиль пользователя', 'info');
        }
    } else if (window.currentChatData.type === 'group') {
        showNotification('Информация о группе', 'info');
    } else if (window.currentChatData.type === 'channel') {
        showNotification('Информация о канале', 'info');
    }
}

function closeChat() {
    console.log('closeChat вызвана');
    
    if (messagesListener) {
        messagesListener.off();
        messagesListener = null;
    }
    
    window.currentChatId = null;
    window.currentChatData = null;
    loadedMessageIds.clear();
    
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    if (noChatElement) noChatElement.classList.remove('hidden');
    if (activeChatElement) activeChatElement.classList.add('hidden');
    
    var messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) messagesContainer.innerHTML = '';
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    if (messagesListener) {
        messagesListener.off();
    }
    
    messagesListener = window.database.ref('messages/' + chatId)
        .orderByChild('timestamp')
        .limitToLast(50);
    
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        var messageId = snapshot.key;
        
        if (loadedMessageIds.has(messageId)) return;
        loadedMessageIds.add(messageId);
        
        message.id = messageId;
        appendMessage(message);
        
        setTimeout(function() {
            container.scrollTop = container.scrollHeight;
        }, 100);
    });
}

function appendMessage(message) {
    var currentUser = getCurrentUser();
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var isSent = message.senderId === currentUser?.uid;
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
    messageDiv.setAttribute('data-message-id', message.id);
    
    var content = '';
    
    if (message.type === 'image') {
        content = '<div class="message-image" onclick="openLightbox(\'' + message.imageUrl + '\')"><img src="' + message.imageUrl + '" style="max-width:250px; max-height:250px; border-radius:12px;"></div>';
        if (message.caption) content += '<div class="message-text">' + escapeHtml(message.caption) + '</div>';
    } 
    else if (message.type === 'gif') {
        content = '<div class="gif-message" onclick="openLightbox(\'' + message.gifUrl + '\')"><img src="' + message.gifUrl + '" style="max-width:250px; max-height:250px; border-radius:12px;"><span class="gif-badge">GIF</span></div>';
    }
    else if (message.type === 'audio') {
        content = '<div class="audio-message">🎤 Голосовое сообщение</div>';
    }
    else if (message.type === 'video') {
        content = '<div class="video-message"><video src="' + message.videoUrl + '" controls style="max-width:250px; max-height:300px; border-radius:12px;"></video></div>';
    }
    else if (message.type === 'file') {
        content = '<div class="file-message">📎 <a href="' + message.fileUrl + '" target="_blank">' + escapeHtml(message.fileName) + '</a></div>';
    }
    else {
        var textContent = formatMessageText(message.text || '');
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content = '<div class="message-text" style="word-break:break-word; white-space:normal;">' + textContent + '</div>';
    }
    
    messageDiv.innerHTML = '<div class="message-content">' + content + '<div class="message-time">' + formatTime(message.timestamp) + '</div></div>';
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function formatMessageText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #228B22;">$1</a>');
    text = text.replace(/@(\w+)/g, '<span style="color:#228B22;">@$1</span>');
    return text;
}

// ========== ОТПРАВКА СООБЩЕНИЙ ==========
function sendMessage() {
    var currentUser = getCurrentUser();
    var input = document.getElementById('message-input');
    if (!input) return;
    
    var text = input.value.trim();
    if (!text || !window.currentChatId) return;
    
    var message = {
        type: 'text',
        text: text,
        senderId: currentUser.uid,
        timestamp: window.firebase.database.ServerValue.TIMESTAMP
    };
    
    input.value = '';
    
    window.database.ref('messages/' + window.currentChatId).push(message).then(function() {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        window.database.ref('chats/' + window.currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: window.firebase.database.ServerValue.TIMESTAMP
        });
    }).catch(function(err) {
        console.error('Ошибка отправки:', err);
        showNotification('Ошибка отправки', 'error');
        input.value = text;
    });
}

function handleMessageKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function onTyping() {
    var currentUser = getCurrentUser();
    if (!window.currentChatId) return;
    window.database.ref('typing/' + window.currentChatId + '/' + currentUser.uid).set(true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() {
        window.database.ref('typing/' + window.currentChatId + '/' + currentUser.uid).remove();
    }, 1000);
}

function setupTypingListener(chatId) {
    var currentUser = getCurrentUser();
    var typingRef = window.database.ref('typing/' + chatId);
    typingRef.off();
    
    typingRef.on('value', function(snapshot) {
        var data = snapshot.val();
        var statusEl = document.getElementById('chat-status');
        if (!statusEl) return;
        
        var typingUsers = [];
        for (var uid in data) {
            if (uid !== currentUser?.uid && data[uid] === true) {
                typingUsers.push(uid);
            }
        }
        
        if (typingUsers.length > 0) {
            statusEl.innerHTML = 'печатает...';
        }
    });
}

// ========== ПОИСК ПОЛЬЗОВАТЕЛЕЙ (КРАТКАЯ ВЕРСИЯ) ==========
function searchGlobalNew() {
    var query = document.getElementById('global-search-input').value.trim().toLowerCase();
    var resultsContainer = document.getElementById('global-search-results');
    
    if (!query || query.length < 2) {
        if (resultsContainer) resultsContainer.style.display = 'none';
        return;
    }
    
    if (resultsContainer) resultsContainer.style.display = 'flex';
    searchUsersGlobal(query);
}

async function searchUsersGlobal(query) {
    var currentUser = getCurrentUser();
    var snapshot = await window.database.ref('users').once('value');
    var users = snapshot.val();
    var results = [];
    var searchQuery = query.replace('@', '');
    var container = document.getElementById('search-results-list');
    
    if (!container) return;
    container.innerHTML = '<div style="padding: 20px;">🔍 Поиск...</div>';
    
    for (var uid in users) {
        if (uid === currentUser.uid) continue;
        var user = users[uid];
        var username = (user.username || '').toLowerCase();
        var userTag = (user.userTag || '').toLowerCase().replace('@', '');
        
        if (username.includes(searchQuery) || userTag.includes(searchQuery)) {
            results.push({
                uid: uid,
                username: user.username || 'Пользователь',
                userTag: user.userTag || '',
                avatar: user.avatar || ''
            });
        }
        if (results.length >= 20) break;
    }
    
    container.innerHTML = '';
    if (results.length === 0) {
        container.innerHTML = '<div style="padding: 20px;">👤 Ничего не найдено</div>';
        return;
    }
    
    results.forEach(function(user) {
        var div = document.createElement('div');
        div.className = 'search-result-item';
        var avatarStyle = user.avatar ? 'background-image: url(' + user.avatar + '); background-size: cover;' : '';
        var avatarContent = user.avatar ? '' : '👤';
        
        div.innerHTML = `
            <div class="search-result-avatar" style="${avatarStyle}">${avatarContent}</div>
            <div class="search-result-info">
                <div class="search-result-name">${escapeHtml(user.username)}</div>
                <div class="search-result-username">${user.userTag ? '@' + user.userTag : '@' + user.username.toLowerCase().replace(/\s/g, '')}</div>
            </div>
        `;
        div.onclick = function() { startPrivateChat(user.uid, user); };
        container.appendChild(div);
    });
}

function closeSearchResults() {
    var resultsContainer = document.getElementById('global-search-results');
    if (resultsContainer) resultsContainer.style.display = 'none';
    var searchInput = document.getElementById('global-search-input');
    if (searchInput) searchInput.value = '';
}

function closeSearchModal() {
    closeSearchResults();
}

// ========== НОВЫЙ ЧАТ (КРАТКАЯ ВЕРСИЯ) ==========
function openCreateMenu() {
    var menu = document.getElementById('create-menu-modal');
    if (menu) menu.classList.remove('hidden');
}

function closeCreateMenu() {
    var menu = document.getElementById('create-menu-modal');
    if (menu) menu.classList.add('hidden');
}

function openNewChatFromMenu() {
    closeCreateMenu();
    showNewChatDialog();
}

function showNewChatDialog() {
    var modalHtml = `
        <div id="new-chat-dialog" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>💬 Новый чат</h3>
                    <button onclick="closeNewChatDialog()" class="btn-close">×</button>
                </div>
                <div style="padding: 15px;">
                    <input type="text" id="new-chat-search" placeholder="Имя пользователя..." 
                           style="width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 30px;"
                           oninput="searchUsersForNewChat()">
                    <div id="new-chat-users-list" style="margin-top: 15px; max-height: 400px; overflow-y: auto;">
                        <div style="text-align: center; padding: 20px;">🔍 Введите имя для поиска</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('new-chat-dialog');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeNewChatDialog() {
    var modal = document.getElementById('new-chat-dialog');
    if (modal) modal.remove();
}

var searchTimeout = null;

function searchUsersForNewChat() {
    var query = document.getElementById('new-chat-search').value.trim().toLowerCase();
    var container = document.getElementById('new-chat-users-list');
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (!query || query.length < 2) {
        if (container) container.innerHTML = '<div style="text-align: center; padding: 20px;">🔍 Введите минимум 2 символа</div>';
        return;
    }
    
    if (container) container.innerHTML = '<div style="text-align: center; padding: 20px;">🔍 Поиск...</div>';
    
    searchTimeout = setTimeout(async function() {
        var currentUser = getCurrentUser();
        var snapshot = await window.database.ref('users').once('value');
        var users = snapshot.val();
        var results = [];
        var searchQuery = query.replace('@', '');
        
        for (var uid in users) {
            if (uid === currentUser.uid) continue;
            var user = users[uid];
            var username = (user.username || '').toLowerCase();
            var userTag = (user.userTag || '').toLowerCase().replace('@', '');
            
            if (username.includes(searchQuery) || userTag.includes(searchQuery)) {
                results.push({
                    uid: uid,
                    username: user.username || 'Пользователь',
                    userTag: user.userTag || '',
                    avatar: user.avatar || ''
                });
            }
            if (results.length >= 20) break;
        }
        
        container.innerHTML = '';
        if (results.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;">👤 Пользователи не найдены</div>';
            return;
        }
        
        results.forEach(function(user) {
            var div = document.createElement('div');
            div.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;';
            div.onclick = function() { createNewChat(user.uid, user); };
            
            var avatarStyle = user.avatar ? 'background-image: url(' + user.avatar + '); background-size: cover;' : '';
            var avatarContent = user.avatar ? '' : '👤';
            
            div.innerHTML = `
                <div class="avatar" style="width: 48px; height: 48px; ${avatarStyle}">${avatarContent}</div>
                <div style="flex:1;">
                    <div style="font-weight: 600;">${escapeHtml(user.username)}</div>
                    <div style="font-size: 12px;">${user.userTag ? '@' + user.userTag : '@' + user.username.toLowerCase().replace(/\s/g, '')}</div>
                </div>
                <div style="color: var(--forest);">➤</div>
            `;
            container.appendChild(div);
        });
    }, 300);
}

async function createNewChat(otherUserId, otherUser) {
    var currentUser = getCurrentUser();
    showNotification('Создание чата...', 'info');
    
    var chatId = generateChatId(currentUser.uid, otherUserId);
    var chatSnapshot = await window.database.ref('chats/' + chatId).once('value');
    
    if (!chatSnapshot.exists()) {
        await window.database.ref('chats/' + chatId).set({
            type: 'private',
            participants: [currentUser.uid, otherUserId],
            createdAt: window.firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Чат создан',
            lastMessageTime: window.firebase.database.ServerValue.TIMESTAMP
        });
        
        await Promise.all([
            window.database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true),
            window.database.ref('userChats/' + otherUserId + '/' + chatId).set(true)
        ]);
        
        showNotification('Чат создан!', 'success');
    } else {
        showNotification('Чат уже существует', 'info');
    }
    
    closeNewChatDialog();
    closeSearchResults();
    
    var chatData = await window.database.ref('chats/' + chatId).once('value');
    var chat = chatData.val();
    openChatWithData(chatId, chat);
    loadChats();
}

async function startPrivateChat(otherUserId, otherUser) {
    await createNewChat(otherUserId, otherUser);
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function openLightbox(url) {
    var lightbox = document.getElementById('image-lightbox');
    var lightboxImg = document.getElementById('lightbox-image');
    if (lightbox && lightboxImg) {
        lightboxImg.src = url;
        lightbox.classList.remove('hidden');
    }
}

function closeLightbox() {
    var lightbox = document.getElementById('image-lightbox');
    if (lightbox) lightbox.classList.add('hidden');
}

function playAudio(url) {
    var audio = new Audio(url);
    audio.play().catch(function(e) {});
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initChat() {
    console.log('Chat.js инициализирован');
    
    window.loadChats = loadChats;
    window.openChatById = openChatById;
    window.closeChat = closeChat;
    window.sendMessage = sendMessage;
    window.handleMessageKeyPress = handleMessageKeyPress;
    window.onTyping = onTyping;
    window.openLightbox = openLightbox;
    window.closeLightbox = closeLightbox;
    window.playAudio = playAudio;
    window.searchGlobalNew = searchGlobalNew;
    window.closeSearchResults = closeSearchResults;
    window.closeSearchModal = closeSearchModal;
    window.openCreateMenu = openCreateMenu;
    window.closeCreateMenu = closeCreateMenu;
    window.openNewChatFromMenu = openNewChatFromMenu;
    window.showNewChatDialog = showNewChatDialog;
    window.closeNewChatDialog = closeNewChatDialog;
    window.searchUsersForNewChat = searchUsersForNewChat;
    window.startPrivateChat = startPrivateChat;
    
    var observer = new MutationObserver(function() {
        attachChatClickHandlers();
    });
    
    var chatsList = document.getElementById('chats-list');
    if (chatsList) {
        observer.observe(chatsList, { childList: true, subtree: true });
    }
    
    setTimeout(function() {
        if (getCurrentUser() && getCurrentUser().uid) {
            loadChats();
        }
    }, 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
} else {
    initChat();
}

console.log('chat.js полностью загружен');

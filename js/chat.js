// KUKUMBER MESSENGER - CHAT.JS (ПОЛНОСТЬЮ ПЕРЕПИСАН, ВСЁ РАБОТАЕТ)

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var currentUser = null;
var currentUserData = null;
var currentChatId = null;
var currentChatData = null;
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
    
    // Проверяем кэш
    if (userCache.names[userId] && Date.now() - (userCache.names[userId]._time || 0) < 60000) {
        return {
            username: userCache.names[userId].value,
            avatar: userCache.avatars[userId]?.value || '',
            status: userCache.statuses[userId]?.value || { online: false }
        };
    }
    
    try {
        var snapshot = await database.ref('users/' + userId).once('value');
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
    
    // Отписываемся от старого слушателя
    if (chatsListener) {
        chatsListener.off();
    }
    
    // Слушаем изменения в userChats
    chatsListener = database.ref('userChats/' + currentUser.uid);
    chatsListener.on('value', async function(snapshot) {
        var userChats = snapshot.val();
        
        if (!userChats || Object.keys(userChats).length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов. Начните диалог!</div>';
            return;
        }
        
        var chatIds = Object.keys(userChats);
        var chatsData = {};
        var loadedCount = 0;
        
        chatsList.innerHTML = '<div class="empty-chats">🔄 Загрузка чатов...</div>';
        
        for (var i = 0; i < chatIds.length; i++) {
            var chatId = chatIds[i];
            try {
                var chatSnap = await database.ref('chats/' + chatId).once('value');
                var chat = chatSnap.val();
                if (chat) {
                    chatsData[chatId] = chat;
                }
            } catch (err) {
                console.error('Ошибка загрузки чата', chatId, err);
            }
            loadedCount++;
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
    
    // Преобразуем в массив для сортировки
    var chatsArray = [];
    for (var chatId in chatsData) {
        chatsArray.push({
            id: chatId,
            data: chatsData[chatId]
        });
    }
    
    // Сортировка по времени последнего сообщения
    chatsArray.sort(function(a, b) {
        return (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0);
    });
    
    chatsList.innerHTML = '';
    
    // Рендерим каждый чат (асинхронно из-за getUserData)
    var pendingRenders = chatsArray.length;
    var renderedCount = 0;
    
    chatsArray.forEach(function(chat) {
        createChatItem(chat.id, chat.data, chatsList).then(function() {
            renderedCount++;
            if (renderedCount === pendingRenders) {
                // ВСЕ ЧАТЫ ОТРИСОВАНЫ - ТЕПЕРЬ ПРИВЯЗЫВАЕМ ОБРАБОТЧИКИ
                setTimeout(function() {
                    attachChatClickHandlers();
                    console.log('Обработчики кликов привязаны после отрисовки всех чатов');
                }, 100);
            }
        });
    });
}

async function createChatItem(chatId, chatData, container) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    div.setAttribute('data-chat-id', chatId);
    
    if (currentChatId === chatId) {
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
        render();
    } 
    else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatarUrl = chatData.avatar || '';
        avatarContent = avatarUrl ? '' : '📢';
        badge = '<span class="chat-type-badge">📢</span>';
        render();
    } 
    else {
        // Личный чат
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
            render();
        } else {
            name = 'Пользователь';
            render();
        }
    }
    
    function render() {
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
    
    // Возвращаем Promise, чтобы знать, когда всё отрисовано
    return Promise.resolve();
}
function attachChatClickHandlers() {
    var chatItems = document.querySelectorAll('.chat-item');
    console.log('Привязка обработчиков к чатам, найдено:', chatItems.length);
    
    chatItems.forEach(function(item) {
        // Убираем старые обработчики
        var oldClick = item.onclick;
        item.onclick = null;
        
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
    
    if (!chatId) {
        console.error('Нет ID чата');
        return;
    }
    
    if (!currentUser || !currentUser.uid) {
        console.error('Нет пользователя');
        return;
    }
    
    // Закрываем боковую панель на мобильных
    if (window.innerWidth <= 768) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    }
    
    try {
        var chatSnap = await database.ref('chats/' + chatId).once('value');
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

async function openChatWithData(chatId, chatData) {
    console.log('openChatWithData:', chatId, chatData.type);
    
    currentChatId = chatId;
    currentChatData = chatData;
    currentChatData.chatId = chatId;
    
    // Обновляем активный класс в списке чатов
    document.querySelectorAll('.chat-item').forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('data-chat-id') === chatId) {
            item.classList.add('active');
        }
    });
    
    // Показываем область чата
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    if (noChatElement) noChatElement.classList.add('hidden');
    if (activeChatElement) activeChatElement.classList.remove('hidden');
    
    // Обновляем шапку чата
    await updateChatHeader(chatId, chatData);
    
    // Загружаем сообщения
    loadMessages(chatId);
    
    // Настраиваем слушатель печати
    setupTypingListener(chatId);
    
    // Настраиваем обработчик клика по шапке
    setupChatHeaderClick();
}

async function updateChatHeader(chatId, chatData) {
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
        // Личный чат
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
            currentChatData.otherUserId = otherUserId;
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

function setupChatHeaderClick() {
    var chatUserInfo = document.querySelector('.chat-user-info');
    if (!chatUserInfo) return;
    
    // Клонируем чтобы убрать старые обработчики
    var newElement = chatUserInfo.cloneNode(true);
    chatUserInfo.parentNode.replaceChild(newElement, chatUserInfo);
    
    newElement.onclick = function() {
        openChatProfile();
    };
}

function openChatProfile() {
    if (!currentChatData) return;
    
    if (currentChatData.type === 'private' && currentChatData.otherUserId) {
        // Открываем профиль пользователя
        if (typeof window.openUserProfile === 'function') {
            window.openUserProfile(currentChatData.otherUserId);
        } else if (typeof openUserProfile === 'function') {
            openUserProfile(currentChatData.otherUserId);
        } else {
            showNotification('Профиль пользователя', 'info');
            console.log('Открыть профиль:', currentChatData.otherUserId);
        }
    } 
    else if (currentChatData.type === 'group') {
        showNotification('Информация о группе', 'info');
        console.log('Открыть инфо о группе:', currentChatId);
    } 
    else if (currentChatData.type === 'channel') {
        showNotification('Информация о канале', 'info');
        console.log('Открыть инфо о канале:', currentChatId);
    }
}

function closeChat() {
    if (messagesListener) {
        messagesListener.off();
        messagesListener = null;
    }
    
    currentChatId = null;
    currentChatData = null;
    loadedMessageIds.clear();
    
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    if (noChatElement) noChatElement.classList.remove('hidden');
    if (activeChatElement) activeChatElement.classList.add('hidden');
    
    // Очищаем контейнер сообщений
    var messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) messagesContainer.innerHTML = '';
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    // Очищаем контейнер
    container.innerHTML = '';
    loadedMessageIds.clear();
    
    // Отписываемся от старого слушателя
    if (messagesListener) {
        messagesListener.off();
    }
    
    // Подписываемся на новые сообщения
    messagesListener = database.ref('messages/' + chatId)
        .orderByChild('timestamp')
        .limitToLast(50);
    
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        var messageId = snapshot.key;
        
        if (loadedMessageIds.has(messageId)) return;
        loadedMessageIds.add(messageId);
        
        message.id = messageId;
        appendMessage(message);
        
        // Прокрутка вниз
        setTimeout(function() {
            container.scrollTop = container.scrollHeight;
        }, 100);
    });
    
    messagesListener.on('child_changed', function(snapshot) {
        var message = snapshot.val();
        message.id = snapshot.key;
        updateMessageElement(message);
    });
    
    messagesListener.on('child_removed', function(snapshot) {
        var messageId = snapshot.key;
        var msgElement = document.querySelector('.message[data-message-id="' + messageId + '"]');
        if (msgElement) msgElement.remove();
        loadedMessageIds.delete(messageId);
    });
}

function appendMessage(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var isSent = message.senderId === currentUser.uid;
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
    messageDiv.setAttribute('data-message-id', message.id);
    messageDiv.setAttribute('data-sender-id', message.senderId || '');
    
    var content = '';
    
    // Типы сообщений
    if (message.type === 'image') {
        content = `
            <div class="message-image" onclick="openLightbox('${message.imageUrl}')">
                <img src="${message.imageUrl}" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;">
            </div>
            ${message.caption ? '<div class="message-text">' + escapeHtml(message.caption) + '</div>' : ''}
        `;
    } 
    else if (message.type === 'gif') {
        content = `
            <div class="gif-message" onclick="openLightbox('${message.gifUrl}')">
                <img src="${message.gifUrl}" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;">
                <span class="gif-badge">GIF</span>
            </div>
        `;
    }
    else if (message.type === 'audio') {
        content = `
            <div class="audio-message">
                <button onclick="playAudio('${message.audioUrl}')">▶️</button>
                <span>Голосовое сообщение ${message.duration ? '(' + message.duration + ' сек)' : ''}</span>
            </div>
        `;
    }
    else if (message.type === 'video') {
        content = `
            <div class="video-message">
                <video src="${message.videoUrl}" controls preload="metadata" style="max-width:250px; max-height:300px; border-radius:12px;"></video>
            </div>
        `;
    }
    else if (message.type === 'file') {
        content = `
            <div class="file-message">
                <span style="font-size:24px;">📎</span>
                <a href="${message.fileUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(message.fileName)}</a>
            </div>
        `;
    }
    else {
        // Текстовое сообщение
        var textContent = formatMessageText(message.text || '');
        if (message.edited) {
            textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        }
        content = '<div class="message-text" style="word-break:break-word; white-space:normal;">' + textContent + '</div>';
    }
    
    // Добавляем имя отправителя для групповых чатов
    var senderNameHtml = '';
    if (currentChatData && currentChatData.type !== 'private' && !isSent && message.senderId) {
        var senderName = userCache.names[message.senderId]?.value || 'Пользователь';
        senderNameHtml = '<div class="message-sender">' + escapeHtml(senderName) + '</div>';
    }
    
    messageDiv.innerHTML = `
        <div class="message-content" style="flex:1;">
            ${senderNameHtml}
            ${content}
            <div class="message-time">${formatTime(message.timestamp)}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function updateMessageElement(message) {
    var existingDiv = document.querySelector('.message[data-message-id="' + message.id + '"]');
    if (existingDiv && message.text) {
        var textDiv = existingDiv.querySelector('.message-text');
        if (textDiv) {
            var newText = formatMessageText(message.text);
            if (message.edited) newText += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
            textDiv.innerHTML = newText;
        }
    }
}

function formatMessageText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    // Ссылки
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #228B22; text-decoration: none;">$1</a>');
    // Упоминания
    text = text.replace(/@(\w+)/g, '<span style="color:#228B22; cursor:pointer;" onclick="openUserByUsername(\'$1\')">@$1</span>');
    return text;
}

// ========== ОТПРАВКА СООБЩЕНИЙ ==========
function sendMessage() {
    var input = document.getElementById('message-input');
    if (!input) return;
    
    var text = input.value.trim();
    if (!text || !currentChatId) return;
    
    var message = {
        type: 'text',
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    input.value = '';
    
    database.ref('messages/' + currentChatId).push(message).then(function() {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Звук отправки
        if (typeof KukumberSounds !== 'undefined') {
            KukumberSounds.playSend();
        }
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
    if (!currentChatId) return;
    database.ref('typing/' + currentChatId + '/' + currentUser.uid).set(true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() {
        database.ref('typing/' + currentChatId + '/' + currentUser.uid).remove();
    }, 1000);
}

function setupTypingListener(chatId) {
    var typingRef = database.ref('typing/' + chatId);
    typingRef.off();
    
    typingRef.on('value', function(snapshot) {
        var data = snapshot.val();
        var statusEl = document.getElementById('chat-status');
        if (!statusEl) return;
        
        var typingUsers = [];
        for (var uid in data) {
            if (uid !== currentUser.uid && data[uid] === true) {
                typingUsers.push(uid);
            }
        }
        
        if (typingUsers.length > 0) {
            statusEl.innerHTML = 'печатает...';
        } else {
            // Восстанавливаем обычный статус
            updateChatHeader(currentChatId, currentChatData);
        }
    });
}

// ========== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ==========
function searchGlobalNew() {
    var query = document.getElementById('global-search-input').value.trim().toLowerCase();
    var resultsContainer = document.getElementById('global-search-results');
    var resultsList = document.getElementById('search-results-list');
    
    if (!query || query.length < 2) {
        if (resultsContainer) resultsContainer.style.display = 'none';
        return;
    }
    
    if (resultsContainer) resultsContainer.style.display = 'flex';
    if (resultsList) resultsList.innerHTML = '<div style="padding: 20px; text-align: center;">🔍 Поиск...</div>';
    
    searchUsersGlobal(query).then(function(users) {
        renderSearchResults(users);
    }).catch(function(err) {
        console.error('Ошибка поиска:', err);
        if (resultsList) resultsList.innerHTML = '<div style="padding: 20px; text-align: center;">❌ Ошибка поиска</div>';
    });
}

async function searchUsersGlobal(query) {
    var snapshot = await database.ref('users').once('value');
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
    return results;
}

function renderSearchResults(users) {
    var container = document.getElementById('search-results-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center;">👤 Ничего не найдено</div>';
        return;
    }
    
    users.forEach(function(user) {
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
            <div class="search-result-badge">👤</div>
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

// ========== НОВЫЙ ЧАТ ==========
function openCreateMenu() {
    var menu = document.getElementById('create-menu-modal');
    if (menu) {
        menu.classList.remove('hidden');
    } else {
        // Если меню нет в DOM, создаём
        var modalHtml = `
            <div id="create-menu-modal" class="modal" style="z-index: 10002;">
                <div class="modal-content" style="max-width: 400px; border-radius: 28px; overflow: hidden;">
                    <div class="modal-header">
                        <h3>Создать</h3>
                        <button onclick="closeCreateMenu()" class="btn-close">×</button>
                    </div>
                    <div style="padding: 8px 0 20px 0;">
                        <div class="create-menu-item" onclick="openNewChatFromMenu()">
                            <div class="create-menu-icon">💬</div>
                            <div class="create-menu-info">
                                <div class="create-menu-title">Новый чат</div>
                                <div class="create-menu-desc">Начать диалог с пользователем</div>
                            </div>
                            <span class="create-menu-arrow">›</span>
                        </div>
                        <div class="create-menu-item" onclick="openCreateGroupWizard()">
                            <div class="create-menu-icon">👥</div>
                            <div class="create-menu-info">
                                <div class="create-menu-title">Группа</div>
                                <div class="create-menu-desc">Для общения с друзьями</div>
                            </div>
                            <span class="create-menu-arrow">›</span>
                        </div>
                        <div class="create-menu-item" onclick="openCreateChannelWizard()">
                            <div class="create-menu-icon">📢</div>
                            <div class="create-menu-info">
                                <div class="create-menu-title">Канал</div>
                                <div class="create-menu-desc">Для публикаций и вещания</div>
                            </div>
                            <span class="create-menu-arrow">›</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        var newMenu = document.getElementById('create-menu-modal');
        if (newMenu) newMenu.classList.remove('hidden');
    }
}

function closeCreateMenu() {
    var menu = document.getElementById('create-menu-modal');
    if (menu) menu.classList.add('hidden');
}

// Функции для создания группы и канала (временно показываем уведомление)
function openCreateGroupWizard() {
    closeCreateMenu();
    showNotification('Создание группы скоро будет доступно', 'info');
}

function openCreateChannelWizard() {
    closeCreateMenu();
    showNotification('Создание канала скоро будет доступно', 'info');
}

function showNewChatDialog() {
    var modalHtml = `
        <div id="new-chat-dialog" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 400px; border-radius: 20px;">
                <div class="modal-header">
                    <h3>💬 Новый чат</h3>
                    <button onclick="closeNewChatDialog()" class="btn-close">×</button>
                </div>
                <div style="padding: 15px;">
                    <div style="position: relative;">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%);">🔍</span>
                        <input type="text" id="new-chat-search" placeholder="Имя пользователя..." 
                               style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid var(--border); border-radius: 30px;"
                               oninput="searchUsersForNewChat()">
                    </div>
                    <div id="new-chat-users-list" style="margin-top: 15px; max-height: 400px; overflow-y: auto;">
                        <div style="text-align: center; padding: 20px; color: var(--text-muted);">🔍 Введите имя для поиска</div>
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
        if (container) container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">🔍 Введите минимум 2 символа</div>';
        return;
    }
    
    if (container) container.innerHTML = '<div style="text-align: center; padding: 20px;">🔍 Поиск...</div>';
    
    searchTimeout = setTimeout(async function() {
        var results = await searchUsersGlobal(query);
        renderNewChatUsers(results, container);
    }, 300);
}

function renderNewChatUsers(users, container) {
    if (!container) return;
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">👤 Пользователи не найдены</div>';
        return;
    }
    
    users.forEach(function(user) {
        var div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;';
        div.onclick = function() { createNewChat(user.uid, user); };
        
        var avatarStyle = user.avatar ? 'background-image: url(' + user.avatar + '); background-size: cover;' : '';
        var avatarContent = user.avatar ? '' : '👤';
        
        div.innerHTML = `
            <div class="avatar" style="width: 48px; height: 48px; ${avatarStyle}">${avatarContent}</div>
            <div style="flex:1;">
                <div style="font-weight: 600;">${escapeHtml(user.username)}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${user.userTag ? '@' + user.userTag : '@' + user.username.toLowerCase().replace(/\s/g, '')}</div>
            </div>
            <div style="color: var(--forest);">➤</div>
        `;
        
        container.appendChild(div);
    });
}

async function createNewChat(otherUserId, otherUser) {
    showNotification('Создание чата...', 'info');
    
    var chatId = generateChatId(currentUser.uid, otherUserId);
    var chatSnapshot = await database.ref('chats/' + chatId).once('value');
    
    if (!chatSnapshot.exists()) {
        await database.ref('chats/' + chatId).set({
            type: 'private',
            participants: [currentUser.uid, otherUserId],
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Чат создан',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        await Promise.all([
            database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true),
            database.ref('userChats/' + otherUserId + '/' + chatId).set(true)
        ]);
        
        showNotification('Чат создан!', 'success');
    } else {
        showNotification('Чат уже существует', 'info');
    }
    
    closeNewChatDialog();
    closeSearchResults();
    
    // Открываем чат
    var chatData = await database.ref('chats/' + chatId).once('value');
    var chat = chatData.val();
    chat.otherUserId = otherUserId;
    openChatWithData(chatId, chat);
    loadChats();
}

async function startPrivateChat(otherUserId, otherUser) {
    await createNewChat(otherUserId, otherUser);
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ МЕДИА ==========
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
    audio.play().catch(function(e) {
        console.log('Ошибка воспроизведения аудио:', e);
    });
}

function openUserByUsername(username) {
    console.log('Поиск пользователя по username:', username);
    showNotification('Поиск пользователя...', 'info');
}
function openNewChatFromMenu() {
    closeCreateMenu();
    showNewChatDialog();
}
// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initChat() {
    console.log('Chat.js инициализирован');
    
    // Привязываем глобальные функции
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
    window.openCreateMenu = openCreateMenu;
    window.closeCreateMenu = closeCreateMenu;
    window.openNewChatFromMenu = openNewChatFromMenu;
    window.showNewChatDialog = showNewChatDialog;
    window.closeNewChatDialog = closeNewChatDialog;
    window.searchUsersForNewChat = searchUsersForNewChat;
    window.startPrivateChat = startPrivateChat;
    window.openChatProfile = openChatProfile;
    
    // Добавляем новые функции
    window.openCreateGroupWizard = openCreateGroupWizard;
    window.openCreateChannelWizard = openCreateChannelWizard;
    window.createGroup = createGroup;
    window.createChannel = createChannel;
    window.closeGroupModal = closeGroupModal;
    window.closeChannelModal = closeChannelModal;
    window.openGroupProfileModal = openGroupProfileModal;
    window.openChannelProfileModal = openChannelProfileModal;
    window.closeGroupProfileModal = closeGroupProfileModal;
    window.closeChannelProfileModal = closeChannelProfileModal;
    window.leaveGroupChat = leaveGroupChat;
    window.subscribeToChannel = subscribeToChannel;
    window.unsubscribeFromChannel = unsubscribeFromChannel;
    
    // Наблюдатель за изменением списка чатов
    var observer = new MutationObserver(function() {
        attachChatClickHandlers();
    });
    
    var chatsList = document.getElementById('chats-list');
    if (chatsList) {
        observer.observe(chatsList, { childList: true, subtree: true });
    }
    
    // Загружаем чаты при старте
    setTimeout(function() {
        if (currentUser && currentUser.uid) {
            loadChats();
        }
    }, 1000);
}

// Запускаем инициализацию после загрузки DOM
// Запускаем инициализацию после загрузки DOM
setTimeout(function() {
    initChat();
}, 1000);

console.log('chat.js полностью загружен и готов к работе');
// ========== ИСПРАВЛЕННАЯ ФУНКЦИЯ ОТКРЫТИЯ ЧАТА ==========
// ПЕРЕЗАПИСЫВАЕМ ФУНКЦИЮ (вставьте этот код в chat.js)
window.openChatWithData = async function(chatId, chatData) {
    console.log('=== openChatWithData ВЫЗВАНА ===', chatId, chatData?.type);
    
    if (!chatId) {
        console.error('Нет ID чата');
        return;
    }
    
    if (!chatData) {
        console.error('Нет данных чата');
        return;
    }
    
    // Сохраняем глобальные переменные
    window.currentChatId = chatId;
    window.currentChatData = chatData;
    window.currentChatData.chatId = chatId;
    
    // Устанавливаем otherUserId для личных чатов
    if (chatData.type === 'private' && chatData.participants) {
        for (var i = 0; i < chatData.participants.length; i++) {
            if (chatData.participants[i] !== window.currentUser?.uid) {
                window.currentChatData.otherUserId = chatData.participants[i];
                break;
            }
        }
    }
    
    // 1. Обновляем активный класс в списке чатов
    var chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('data-chat-id') === chatId) {
            item.classList.add('active');
        }
    });
    
    // 2. ПОКАЗЫВАЕМ ОБЛАСТЬ ЧАТА - ПРЯМОЕ ИЗМЕНЕНИЕ STYLE
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    if (noChatElement) {
        noChatElement.classList.add('hidden');
        noChatElement.style.display = 'none';
        console.log('Скрыли no-chat-selected');
    }
    
    if (activeChatElement) {
        activeChatElement.classList.remove('hidden');
        activeChatElement.style.display = 'flex';
        console.log('Показали active-chat, display:', activeChatElement.style.display);
    }
    
    // 3. Очищаем контейнер сообщений
    var messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
        window.loadedMessageIds = new Set();
        console.log('Очистили messages-container');
    }
    
    // 4. Обновляем шапку чата
    await updateChatHeaderUI(chatId, chatData);
    
    // 5. Загружаем сообщения
    loadMessagesDirect(chatId);
    
    // 6. Настраиваем слушатель печати
    setupTypingListenerDirect(chatId);
    
    // 7. Настраиваем клик по шапке
    var chatUserInfo = document.querySelector('.chat-user-info');
    if (chatUserInfo) {
        // Убираем старые обработчики
        var newChatUserInfo = chatUserInfo.cloneNode(true);
        chatUserInfo.parentNode.replaceChild(newChatUserInfo, chatUserInfo);
        newChatUserInfo.onclick = function() {
            openChatProfileInfo();
        };
    }
    
    // 8. ПРИНУДИТЕЛЬНАЯ ПРОКРУТКА
    setTimeout(function() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 200);
    
    console.log('Чат успешно открыт:', chatId);
    console.log('active-chat hidden?', activeChatElement?.classList.contains('hidden'));
    console.log('active-chat display:', activeChatElement?.style.display);
};

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ШАПКИ
async function updateChatHeaderUI(chatId, chatData) {
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
        // Личный чат
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== window.currentUser?.uid) {
                    otherUserId = chatData.participants[i];
                    break;
                }
            }
        }
        
        if (otherUserId) {
            chatData.otherUserId = otherUserId;
            
            try {
                var userSnap = await database.ref('users/' + otherUserId).once('value');
                var userData = userSnap.val();
                
                if (userData) {
                    chatUsername.textContent = userData.username || 'Пользователь';
                    
                    if (chatStatus) {
                        var statusData = userData.status || {};
                        if (statusData.online) {
                            chatStatus.innerHTML = 'в сети';
                        } else {
                            chatStatus.innerHTML = formatLastSeen(statusData.lastSeen);
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
                }
            } catch (err) {
                console.error('Ошибка загрузки данных пользователя:', err);
                chatUsername.textContent = 'Пользователь';
            }
        } else {
            chatUsername.textContent = 'Пользователь';
            if (chatStatus) chatStatus.textContent = 'неизвестно';
        }
    }
}

// ФУНКЦИЯ ЗАГРУЗКИ СООБЩЕНИЙ
function loadMessagesDirect(chatId) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    // Отписываемся от старого слушателя
    if (window.messagesListener) {
        window.messagesListener.off();
    }
    
    // Подписываемся на новые сообщения
    window.messagesListener = database.ref('messages/' + chatId)
        .orderByChild('timestamp')
        .limitToLast(50);
    
    window.messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        var messageId = snapshot.key;
        
        if (window.loadedMessageIds && window.loadedMessageIds.has(messageId)) return;
        if (!window.loadedMessageIds) window.loadedMessageIds = new Set();
        window.loadedMessageIds.add(messageId);
        
        message.id = messageId;
        appendMessageToContainer(message);
    });
}

// ФУНКЦИЯ ДОБАВЛЕНИЯ СООБЩЕНИЯ В КОНТЕЙНЕР
function appendMessageToContainer(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var isSent = message.senderId === window.currentUser?.uid;
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
    messageDiv.setAttribute('data-message-id', message.id);
    
    var content = '';
    
    if (message.type === 'image') {
        content = '<div class="message-image" onclick="openLightbox(\'' + message.imageUrl + '\')"><img src="' + message.imageUrl + '" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;"></div>';
        if (message.caption) content += '<div class="message-text">' + escapeHtml(message.caption) + '</div>';
    } 
    else if (message.type === 'gif') {
        content = '<div class="gif-message" onclick="openLightbox(\'' + message.gifUrl + '\')"><img src="' + message.gifUrl + '" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;"><span class="gif-badge">GIF</span></div>';
    }
    else if (message.type === 'audio') {
        content = '<div class="audio-message"><button onclick="playAudio(\'' + message.audioUrl + '\')">▶️</button><span>Голосовое сообщение</span></div>';
    }
    else if (message.type === 'video') {
        content = '<div class="video-message"><video src="' + message.videoUrl + '" controls style="max-width:250px; max-height:300px; border-radius:12px;"></video></div>';
    }
    else if (message.type === 'file') {
        content = '<div class="file-message">📎 <a href="' + message.fileUrl + '" target="_blank">' + escapeHtml(message.fileName) + '</a></div>';
    }
    else {
        var textContent = formatMessageTextDirect(message.text || '');
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content = '<div class="message-text" style="word-break:break-word; white-space:normal;">' + textContent + '</div>';
    }
    
    messageDiv.innerHTML = '<div class="message-content">' + content + '<div class="message-time">' + formatTime(message.timestamp) + '</div></div>';
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function formatMessageTextDirect(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #228B22;">$1</a>');
    text = text.replace(/@(\w+)/g, '<span style="color:#228B22;">@$1</span>');
    return text;
}

function setupTypingListenerDirect(chatId) {
    var typingRef = database.ref('typing/' + chatId);
    typingRef.off();
    
    typingRef.on('value', function(snapshot) {
        var data = snapshot.val();
        var statusEl = document.getElementById('chat-status');
        if (!statusEl) return;
        
        var typingUsers = [];
        for (var uid in data) {
            if (uid !== window.currentUser?.uid && data[uid] === true) {
                typingUsers.push(uid);
            }
        }
        
        if (typingUsers.length > 0) {
            statusEl.innerHTML = 'печатает...';
        } else if (window.currentChatData) {
            updateChatHeaderUI(window.currentChatId, window.currentChatData);
        }
    });
}

function openChatProfileInfo() {
    if (!window.currentChatData) return;
    
    if (window.currentChatData.type === 'private' && window.currentChatData.otherUserId) {
        if (typeof window.openUserProfile === 'function') {
            window.openUserProfile(window.currentChatData.otherUserId);
        } else {
            console.log('Открыть профиль:', window.currentChatData.otherUserId);
            alert('Профиль пользователя');
        }
    } else if (window.currentChatData.type === 'group') {
        alert('Информация о группе');
    } else if (window.currentChatData.type === 'channel') {
        alert('Информация о канале');
    }
}

// ПЕРЕЗАПИСЫВАЕМ ОСНОВНУЮ ФУНКЦИЮ openChatById
window.openChatById = async function(chatId) {
    console.log('openChatById:', chatId);
    
    if (!chatId) {
        console.error('Нет ID чата');
        return;
    }
    
    if (!window.currentUser || !window.currentUser.uid) {
        console.error('Нет пользователя');
        return;
    }
    
    // Закрываем боковую панель на мобильных
    if (window.innerWidth <= 768) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    }
    
    try {
        var chatSnap = await database.ref('chats/' + chatId).once('value');
        var chatData = chatSnap.val();
        
        if (!chatData) {
            alert('Чат не найден');
            return;
        }
        
        window.openChatWithData(chatId, chatData);
    } catch (err) {
        console.error('Ошибка открытия чата:', err);
        alert('Ошибка открытия чата');
    }
};

// ПЕРЕЗАПИСЫВАЕМ closeChat
window.closeChat = function() {
    console.log('closeChat вызвана');
    
    if (window.messagesListener) {
        window.messagesListener.off();
        window.messagesListener = null;
    }
    
    window.currentChatId = null;
    window.currentChatData = null;
    
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    if (noChatElement) noChatElement.classList.remove('hidden');
    if (activeChatElement) activeChatElement.classList.add('hidden');
    
    var messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) messagesContainer.innerHTML = '';
};

console.log('Исправленные функции чата загружены!');
// ========== СОЗДАНИЕ ГРУППЫ ==========
function openCreateGroupWizard() {
    closeCreateMenu();
    
    // Создаём модальное окно для создания группы
    var modalHtml = `
        <div id="create-group-modal" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 500px; border-radius: 20px;">
                <div class="modal-header">
                    <h3>👥 Создание группы</h3>
                    <button onclick="closeGroupModal()" class="btn-close">×</button>
                </div>
                <div style="padding: 20px;">
                    <div class="avatar-upload" style="text-align:center; margin-bottom:15px;">
                        <div id="group-avatar-preview" class="avatar-preview" style="width:80px; height:80px; margin:0 auto; border-radius:50%; background:#f0f0f0; display:flex; align-items:center; justify-content:center; font-size:40px; cursor:pointer;">👥</div>
                        <input type="file" id="group-avatar-input" accept="image/*" style="display:none;">
                        <button onclick="document.getElementById('group-avatar-input').click()" class="btn-small" style="margin-top:8px;">Загрузить фото</button>
                    </div>
                    
                    <input type="text" id="group-name-input" placeholder="Название группы *" style="width:100%; padding:12px; margin-bottom:15px; border:2px solid var(--border); border-radius:12px;">
                    
                    <textarea id="group-desc-input" placeholder="Описание группы (необязательно)" rows="3" style="width:100%; padding:12px; margin-bottom:15px; border:2px solid var(--border); border-radius:12px;"></textarea>
                    
                    <div class="channel-type-options">
                        <label style="display:flex; align-items:center; gap:10px; padding:10px; border:2px solid var(--border); border-radius:12px; margin-bottom:10px; cursor:pointer;">
                            <input type="radio" name="group-type" value="public" checked> 🌍 Публичная
                            <small style="margin-left:10px; color:#999;">Может найти любой</small>
                        </label>
                        <label style="display:flex; align-items:center; gap:10px; padding:10px; border:2px solid var(--border); border-radius:12px; cursor:pointer;">
                            <input type="radio" name="group-type" value="private"> 🔒 Приватная
                            <small style="margin-left:10px; color:#999;">Только по ссылке-приглашению</small>
                        </label>
                    </div>
                    
                    <button onclick="createGroup()" class="btn-primary" style="margin-top:20px; width:100%;">Создать группу</button>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('create-group-modal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Обработчик загрузки аватара
    var avatarInput = document.getElementById('group-avatar-input');
    if (avatarInput) {
        avatarInput.onchange = function(e) {
            var file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var preview = document.getElementById('group-avatar-preview');
                    if (preview) {
                        preview.style.backgroundImage = 'url(' + ev.target.result + ')';
                        preview.style.backgroundSize = 'cover';
                        preview.textContent = '';
                    }
                    window.groupAvatarFile = file;
                };
                reader.readAsDataURL(file);
            }
        };
    }
}

function closeGroupModal() {
    var modal = document.getElementById('create-group-modal');
    if (modal) modal.remove();
}

async function createGroup() {
    var groupName = document.getElementById('group-name-input').value.trim();
    if (!groupName) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    var groupDesc = document.getElementById('group-desc-input').value.trim();
    var groupType = document.querySelector('input[name="group-type"]:checked').value;
    
    showNotification('Создание группы...', 'info');
    
    try {
        // Загружаем аватар если есть
        var avatarUrl = '';
        if (window.groupAvatarFile) {
            avatarUrl = await uploadToImgBB(window.groupAvatarFile);
        }
        
        var groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        var groupData = {
            type: 'group',
            name: groupName,
            description: groupDesc,
            avatar: avatarUrl,
            privacy: groupType,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            createdBy: currentUser.uid,
            lastMessage: 'Группа создана',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
            members: {},
            admins: {}
        };
        
        // Добавляем создателя как участника и админа
        groupData.members[currentUser.uid] = true;
        groupData.admins[currentUser.uid] = true;
        
        await database.ref('chats/' + groupId).set(groupData);
        await database.ref('userChats/' + currentUser.uid + '/' + groupId).set(true);
        
        showNotification('Группа создана!', 'success');
        closeGroupModal();
        loadChats();
        
        // Открываем созданную группу
        openChatWithData(groupId, groupData);
        
    } catch (err) {
        console.error(err);
        showNotification('Ошибка создания группы', 'error');
    }
}

// ========== СОЗДАНИЕ КАНАЛА ==========
function openCreateChannelWizard() {
    closeCreateMenu();
    
    var modalHtml = `
        <div id="create-channel-modal" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 500px; border-radius: 20px;">
                <div class="modal-header">
                    <h3>📢 Создание канала</h3>
                    <button onclick="closeChannelModal()" class="btn-close">×</button>
                </div>
                <div style="padding: 20px;">
                    <div class="avatar-upload" style="text-align:center; margin-bottom:15px;">
                        <div id="channel-avatar-preview" class="avatar-preview" style="width:80px; height:80px; margin:0 auto; border-radius:50%; background:#f0f0f0; display:flex; align-items:center; justify-content:center; font-size:40px; cursor:pointer;">📢</div>
                        <input type="file" id="channel-avatar-input" accept="image/*" style="display:none;">
                        <button onclick="document.getElementById('channel-avatar-input').click()" class="btn-small" style="margin-top:8px;">Загрузить фото</button>
                    </div>
                    
                    <input type="text" id="channel-name-input" placeholder="Название канала *" style="width:100%; padding:12px; margin-bottom:15px; border:2px solid var(--border); border-radius:12px;">
                    
                    <input type="text" id="channel-kname-input" placeholder="K-name (уникальная ссылка)" style="width:100%; padding:12px; margin-bottom:15px; border:2px solid var(--border); border-radius:12px;">
                    <small style="display:block; margin-top:-10px; margin-bottom:15px; color:#999;">Только латиница, цифры и _</small>
                    
                    <textarea id="channel-desc-input" placeholder="Описание канала" rows="3" style="width:100%; padding:12px; margin-bottom:15px; border:2px solid var(--border); border-radius:12px;"></textarea>
                    
                    <div class="channel-type-options">
                        <label style="display:flex; align-items:center; gap:10px; padding:10px; border:2px solid var(--border); border-radius:12px; margin-bottom:10px; cursor:pointer;">
                            <input type="radio" name="channel-type" value="public" checked> 🌍 Публичный
                        </label>
                        <label style="display:flex; align-items:center; gap:10px; padding:10px; border:2px solid var(--border); border-radius:12px; cursor:pointer;">
                            <input type="radio" name="channel-type" value="private"> 🔒 Приватный
                        </label>
                    </div>
                    
                    <button onclick="createChannel()" class="btn-primary" style="margin-top:20px; width:100%;">Создать канал</button>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('create-channel-modal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    var avatarInput = document.getElementById('channel-avatar-input');
    if (avatarInput) {
        avatarInput.onchange = function(e) {
            var file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var preview = document.getElementById('channel-avatar-preview');
                    if (preview) {
                        preview.style.backgroundImage = 'url(' + ev.target.result + ')';
                        preview.style.backgroundSize = 'cover';
                        preview.textContent = '';
                    }
                    window.channelAvatarFile = file;
                };
                reader.readAsDataURL(file);
            }
        };
    }
}

function closeChannelModal() {
    var modal = document.getElementById('create-channel-modal');
    if (modal) modal.remove();
}

async function createChannel() {
    var channelName = document.getElementById('channel-name-input').value.trim();
    if (!channelName) {
        showNotification('Введите название канала', 'error');
        return;
    }
    
    var channelKname = document.getElementById('channel-kname-input').value.trim().toLowerCase();
    var channelDesc = document.getElementById('channel-desc-input').value.trim();
    var channelType = document.querySelector('input[name="channel-type"]:checked').value;
    
    // Проверка K-name
    if (channelKname) {
        var knamePattern = /^[a-z0-9_]+$/;
        if (!knamePattern.test(channelKname)) {
            showNotification('K-name может содержать только латиницу, цифры и _', 'error');
            return;
        }
        
        // Проверка уникальности
        var existing = await database.ref('channelKnames/' + channelKname).once('value');
        if (existing.exists()) {
            showNotification('K-name уже занят', 'error');
            return;
        }
    }
    
    showNotification('Создание канала...', 'info');
    
    try {
        var avatarUrl = '';
        if (window.channelAvatarFile) {
            avatarUrl = await uploadToImgBB(window.channelAvatarFile);
        }
        
        var channelId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        var channelData = {
            type: 'channel',
            name: channelName,
            kname: channelKname || null,
            description: channelDesc,
            avatar: avatarUrl,
            privacy: channelType,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            createdBy: currentUser.uid,
            lastMessage: 'Канал создан',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
            subscribers: {},
            admins: {}
        };
        
        // Добавляем создателя как админа
        channelData.admins[currentUser.uid] = true;
        channelData.subscribers[currentUser.uid] = true;
        
        await database.ref('chats/' + channelId).set(channelData);
        await database.ref('userChats/' + currentUser.uid + '/' + channelId).set(true);
        
        if (channelKname) {
            await database.ref('channelKnames/' + channelKname).set(channelId);
        }
        
        showNotification('Канал создан!', 'success');
        closeChannelModal();
        loadChats();
        
        openChatWithData(channelId, channelData);
        
    } catch (err) {
        console.error(err);
        showNotification('Ошибка создания канала', 'error');
    }
}
// ========== ОТКРЫТИЕ ПРОФИЛЯ ПРИ КЛИКЕ НА ШАПКУ ЧАТА ==========

// Функция для открытия профиля (человек, группа, канал)
function openChatProfile() {
    if (!currentChatData) {
        console.log('Нет данных чата');
        return;
    }
    
    console.log('Открытие профиля для чата:', currentChatData.type, currentChatId);
    
    if (currentChatData.type === 'private') {
        // Личный чат - открываем профиль пользователя
        var otherUserId = currentChatData.otherUserId;
        if (!otherUserId && currentChatData.participants) {
            for (var i = 0; i < currentChatData.participants.length; i++) {
                if (currentChatData.participants[i] !== currentUser.uid) {
                    otherUserId = currentChatData.participants[i];
                    break;
                }
            }
        }
        
        if (otherUserId) {
            // Используем существующую функцию открытия профиля
            if (typeof window.openUserProfile === 'function') {
                window.openUserProfile(otherUserId);
            } else if (typeof openUserProfile === 'function') {
                openUserProfile(otherUserId);
            } else if (typeof openChatProfile === 'function' && window.openChatProfile !== openChatProfile) {
                // Избегаем рекурсии
                window.openChatProfile(otherUserId);
            } else {
                showNotification('Открытие профиля пользователя', 'info');
                console.log('Нужно открыть профиль пользователя:', otherUserId);
            }
        }
    } 
    else if (currentChatData.type === 'group') {
        // Открываем профиль группы
        openGroupProfileModal(currentChatId, currentChatData);
    } 
    else if (currentChatData.type === 'channel') {
        // Открываем профиль канала
        openChannelProfileModal(currentChatId, currentChatData);
    }
}

// ========== ПРОФИЛЬ ГРУППЫ ==========
function openGroupProfileModal(groupId, groupData) {
    var modalHtml = `
        <div id="group-profile-modal" class="modal" style="z-index: 10003;">
            <div class="modal-content" style="max-width: 450px; border-radius: 24px;">
                <div class="modal-header">
                    <h3>👥 Информация о группе</h3>
                    <button onclick="closeGroupProfileModal()" class="btn-close">×</button>
                </div>
                <div style="padding: 20px; text-align: center;">
                    <div class="avatar" style="width: 80px; height: 80px; margin: 0 auto 15px; font-size: 40px; ${groupData.avatar ? 'background-image: url(' + groupData.avatar + '); background-size: cover;' : ''}">
                        ${groupData.avatar ? '' : '👥'}
                    </div>
                    <h2 style="margin-bottom: 5px;">${escapeHtml(groupData.name || 'Группа')}</h2>
                    <p style="color: #666; margin-bottom: 15px;">${escapeHtml(groupData.description || 'Нет описания')}</p>
                    <div style="background: #f5f5f5; border-radius: 12px; padding: 10px; margin-bottom: 10px;">
                        <span>👥 Участников: ${groupData.members ? Object.keys(groupData.members).length : 0}</span>
                    </div>
                    <div style="background: #f5f5f5; border-radius: 12px; padding: 10px; margin-bottom: 10px;">
                        <span>📅 Создана: ${new Date(groupData.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div style="padding: 15px; border-top: 1px solid #eee; display: flex; gap: 10px;">
                    <button onclick="closeGroupProfileModal()" class="btn-secondary" style="flex:1;">Закрыть</button>
                    <button onclick="leaveGroupChat()" class="btn-danger" style="flex:1;">Покинуть группу</button>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('group-profile-modal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeGroupProfileModal() {
    var modal = document.getElementById('group-profile-modal');
    if (modal) modal.remove();
}

async function leaveGroupChat() {
    if (!currentChatId || !currentChatData || currentChatData.type !== 'group') return;
    
    if (!confirm('Вы уверены, что хотите покинуть группу?')) return;
    
    try {
        // Удаляем пользователя из участников
        await database.ref('chats/' + currentChatId + '/members/' + currentUser.uid).remove();
        // Удаляем чат из списка пользователя
        await database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove();
        
        showNotification('Вы покинули группу', 'success');
        closeGroupProfileModal();
        closeChat();
        loadChats();
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
}

// ========== ПРОФИЛЬ КАНАЛА ==========
function openChannelProfileModal(channelId, channelData) {
    var isSubscribed = channelData.subscribers && channelData.subscribers[currentUser.uid];
    var isAdmin = channelData.admins && channelData.admins[currentUser.uid];
    
    var modalHtml = `
        <div id="channel-profile-modal" class="modal" style="z-index: 10003;">
            <div class="modal-content" style="max-width: 450px; border-radius: 24px;">
                <div class="modal-header">
                    <h3>📢 Информация о канале</h3>
                    <button onclick="closeChannelProfileModal()" class="btn-close">×</button>
                </div>
                <div style="padding: 20px; text-align: center;">
                    <div class="avatar" style="width: 80px; height: 80px; margin: 0 auto 15px; font-size: 40px; ${channelData.avatar ? 'background-image: url(' + channelData.avatar + '); background-size: cover;' : ''}">
                        ${channelData.avatar ? '' : '📢'}
                    </div>
                    <h2 style="margin-bottom: 5px;">${escapeHtml(channelData.name || 'Канал')}</h2>
                    ${channelData.kname ? '<p style="color: #228B22; margin-bottom: 5px;">@' + escapeHtml(channelData.kname) + '</p>' : ''}
                    <p style="color: #666; margin-bottom: 15px;">${escapeHtml(channelData.description || 'Нет описания')}</p>
                    <div style="background: #f5f5f5; border-radius: 12px; padding: 10px; margin-bottom: 10px;">
                        <span>👥 Подписчиков: ${channelData.subscribers ? Object.keys(channelData.subscribers).length : 0}</span>
                    </div>
                    <div style="background: #f5f5f5; border-radius: 12px; padding: 10px; margin-bottom: 10px;">
                        <span>${channelData.privacy === 'public' ? '🌍 Публичный' : '🔒 Приватный'}</span>
                    </div>
                </div>
                <div style="padding: 15px; border-top: 1px solid #eee; display: flex; gap: 10px;">
                    ${!isSubscribed ? '<button onclick="subscribeToChannel()" class="btn-primary" style="flex:1;">📢 Подписаться</button>' : ''}
                    ${isSubscribed ? '<button onclick="unsubscribeFromChannel()" class="btn-danger" style="flex:1;">🔕 Отписаться</button>' : ''}
                    <button onclick="closeChannelProfileModal()" class="btn-secondary" style="flex:1;">Закрыть</button>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('channel-profile-modal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeChannelProfileModal() {
    var modal = document.getElementById('channel-profile-modal');
    if (modal) modal.remove();
}

async function subscribeToChannel() {
    if (!currentChatId || !currentChatData || currentChatData.type !== 'channel') return;
    
    try {
        await database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid).set(true);
        await database.ref('userChats/' + currentUser.uid + '/' + currentChatId).set(true);
        showNotification('Вы подписались на канал', 'success');
        closeChannelProfileModal();
        
        // Обновляем данные чата
        currentChatData.subscribers = currentChatData.subscribers || {};
        currentChatData.subscribers[currentUser.uid] = true;
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
}

async function unsubscribeFromChannel() {
    if (!currentChatId || !currentChatData || currentChatData.type !== 'channel') return;
    
    if (!confirm('Отписаться от канала?')) return;
    
    try {
        await database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid).remove();
        await database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove();
        showNotification('Вы отписались от канала', 'info');
        closeChannelProfileModal();
        closeChat();
        loadChats();
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
}
// ========== РАСШИРЕННЫЙ ПРОФИЛЬ ГРУППЫ (ЗАМЕНЯЕТ СТАРЫЙ) ==========
window.openGroupProfile = async function(chatId) {
    console.log('openGroupProfile вызван для:', chatId);
    
    if (!chatId) {
        showNotification('ID группы не указан', 'error');
        return;
    }
    
    try {
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        const chatData = chatSnap.val();
        
        if (!chatData || chatData.type !== 'group') {
            showNotification('Группа не найдена', 'error');
            return;
        }
        
        // Удаляем старое модальное окно
        const oldModal = document.getElementById('group-profile-modal');
        if (oldModal) oldModal.remove();
        
        // Получаем данные о создателе
        let creatorName = 'Неизвестно';
        if (chatData.createdBy) {
            try {
                const creatorSnap = await database.ref('users/' + chatData.createdBy).once('value');
                const creatorData = creatorSnap.val();
                if (creatorData) creatorName = creatorData.username;
            } catch(e) {}
        }
        
        const membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
        const isMember = chatData.members && chatData.members[currentUser?.uid];
        const isCreator = chatData.createdBy === currentUser?.uid;
        
        // Формируем список участников
        let membersListHtml = '';
        if (chatData.members) {
            const memberIds = Object.keys(chatData.members).slice(0, 15);
            for (const memberId of memberIds) {
                try {
                    const userSnap = await database.ref('users/' + memberId).once('value');
                    const userData = userSnap.val();
                    const avatarStyle = userData?.avatar ? `background-image: url(${userData.avatar}); background-size: cover;` : '';
                    const avatarContent = userData?.avatar ? '' : '👤';
                    const isUserAdmin = chatData.admins && chatData.admins[memberId];
                    const isUserCreator = chatData.createdBy === memberId;
                    
                    membersListHtml += `
                        <div class="member-item" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="window.openUserProfile('${memberId}')">
                            <div class="avatar" style="width: 40px; height: 40px; ${avatarStyle}">${avatarContent}</div>
                            <div style="flex:1;">
                                <div style="font-weight: 500;">${escapeHtml(userData?.username || 'Пользователь')}</div>
                                ${isUserCreator ? '<span style="font-size: 11px; color: gold;">владелец</span>' : (isUserAdmin ? '<span style="font-size: 11px; color: var(--forest);">администратор</span>' : '')}
                            </div>
                        </div>
                    `;
                } catch(e) {}
            }
            
            if (memberIds.length < membersCount) {
                membersListHtml += `<div style="padding: 10px; text-align: center; color: var(--text-muted);">и еще ${membersCount - memberIds.length} участников...</div>`;
            }
        }
        
        const modal = document.createElement('div');
        modal.id = 'group-profile-modal';
        modal.className = 'modal';
        modal.style.zIndex = '10003';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px; border-radius: 24px; overflow: hidden;">
                <div class="modal-header" style="position: sticky; top: 0; background: white; z-index: 10;">
                    <h3>👥 Информация о группе</h3>
                    <button onclick="closeGroupProfileModal()" class="btn-close">×</button>
                </div>
                <div style="padding: 20px; text-align: center; border-bottom: 1px solid var(--border);">
                    <div class="avatar" style="width: 80px; height: 80px; margin: 0 auto 15px; font-size: 40px; ${chatData.avatar ? 'background-image: url(' + chatData.avatar + '); background-size: cover;' : ''}">
                        ${chatData.avatar ? '' : '👥'}
                    </div>
                    <h2 style="margin-bottom: 5px;">${escapeHtml(chatData.name || 'Группа')}</h2>
                    <p style="color: #666; margin-bottom: 15px;">${escapeHtml(chatData.description || 'Нет описания')}</p>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 10px; flex-wrap: wrap;">
                        <div style="background: var(--background); border-radius: 12px; padding: 8px 15px;">
                            <span>👥 ${membersCount} участников</span>
                        </div>
                        <div style="background: var(--background); border-radius: 12px; padding: 8px 15px;">
                            <span>👑 ${escapeHtml(creatorName)}</span>
                        </div>
                    </div>
                    <div style="background: var(--background); border-radius: 12px; padding: 8px 15px;">
                        <span>📅 Создана: ${new Date(chatData.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div style="padding: 15px;">
                    <h4 style="margin-bottom: 10px;">Участники</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${membersListHtml || '<div class="profile-empty">Нет участников</div>'}
                    </div>
                </div>
                
                <div style="padding: 15px; border-top: 1px solid var(--border); display: flex; gap: 10px;">
                    ${!isMember ? '<button onclick="joinGroupChat()" class="btn-primary" style="flex:1;">➕ Присоединиться</button>' : ''}
                    ${isMember && !isCreator ? '<button onclick="leaveGroupChat()" class="btn-danger" style="flex:1;">🚪 Покинуть группу</button>' : ''}
                    ${isCreator ? '<button onclick="deleteGroupChat()" class="btn-danger" style="flex:1;">🗑️ Удалить группу</button>' : ''}
                    <button onclick="closeGroupProfileModal()" class="btn-secondary" style="flex:1;">Закрыть</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        window.currentGroupId = chatId;
        window.currentGroupData = chatData;
        
    } catch (err) {
        console.error('Ошибка открытия профиля группы:', err);
        showNotification('Ошибка загрузки группы', 'error');
    }
};

// ========== РАСШИРЕННЫЙ ПРОФИЛЬ КАНАЛА (ЗАМЕНЯЕТ СТАРЫЙ) ==========
window.openChannelProfile = async function(chatId) {
    console.log('openChannelProfile вызван для:', chatId);
    
    if (!chatId) {
        showNotification('ID канала не указан', 'error');
        return;
    }
    
    try {
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        const chatData = chatSnap.val();
        
        if (!chatData || chatData.type !== 'channel') {
            showNotification('Канал не найден', 'error');
            return;
        }
        
        const oldModal = document.getElementById('channel-profile-modal');
        if (oldModal) oldModal.remove();
        
        let creatorName = 'Неизвестно';
        if (chatData.createdBy) {
            try {
                const creatorSnap = await database.ref('users/' + chatData.createdBy).once('value');
                const creatorData = creatorSnap.val();
                if (creatorData) creatorName = creatorData.username;
            } catch(e) {}
        }
        
        const subscribersCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
        const isSubscribed = chatData.subscribers && chatData.subscribers[currentUser?.uid];
        const isCreator = chatData.createdBy === currentUser?.uid;
        
        let adminsListHtml = '';
        if (chatData.admins) {
            const adminIds = Object.keys(chatData.admins);
            for (const adminId of adminIds) {
                try {
                    const userSnap = await database.ref('users/' + adminId).once('value');
                    const userData = userSnap.val();
                    const avatarStyle = userData?.avatar ? `background-image: url(${userData.avatar}); background-size: cover;` : '';
                    const avatarContent = userData?.avatar ? '' : '👤';
                    
                    adminsListHtml += `
                        <div class="member-item" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="window.openUserProfile('${adminId}')">
                            <div class="avatar" style="width: 40px; height: 40px; ${avatarStyle}">${avatarContent}</div>
                            <div style="flex:1;">
                                <div style="font-weight: 500;">${escapeHtml(userData?.username || 'Пользователь')}</div>
                                ${adminId === chatData.createdBy ? '<span style="font-size: 11px; color: gold;">владелец</span>' : '<span style="font-size: 11px; color: var(--forest);">администратор</span>'}
                            </div>
                        </div>
                    `;
                } catch(e) {}
            }
        }
        
        const modal = document.createElement('div');
        modal.id = 'channel-profile-modal';
        modal.className = 'modal';
        modal.style.zIndex = '10003';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px; border-radius: 24px; overflow: hidden;">
                <div class="modal-header" style="position: sticky; top: 0; background: white; z-index: 10;">
                    <h3>📢 Информация о канале</h3>
                    <button onclick="closeChannelProfileModal()" class="btn-close">×</button>
                </div>
                <div style="padding: 20px; text-align: center; border-bottom: 1px solid var(--border);">
                    <div class="avatar" style="width: 80px; height: 80px; margin: 0 auto 15px; font-size: 40px; ${chatData.avatar ? 'background-image: url(' + chatData.avatar + '); background-size: cover;' : ''}">
                        ${chatData.avatar ? '' : '📢'}
                    </div>
                    <h2 style="margin-bottom: 5px;">${escapeHtml(chatData.name || 'Канал')}</h2>
                    ${chatData.kname ? '<p style="color: var(--forest); margin-bottom: 5px;">@' + escapeHtml(chatData.kname) + '</p>' : ''}
                    <p style="color: #666; margin-bottom: 15px;">${escapeHtml(chatData.description || 'Нет описания')}</p>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 10px; flex-wrap: wrap;">
                        <div style="background: var(--background); border-radius: 12px; padding: 8px 15px;">
                            <span>👥 ${subscribersCount} подписчиков</span>
                        </div>
                        <div style="background: var(--background); border-radius: 12px; padding: 8px 15px;">
                            <span>👑 ${escapeHtml(creatorName)}</span>
                        </div>
                    </div>
                    <div style="background: var(--background); border-radius: 12px; padding: 8px 15px;">
                        <span>${chatData.privacy === 'public' ? '🌍 Публичный' : '🔒 Приватный'}</span>
                    </div>
                </div>
                
                <div style="padding: 15px;">
                    <h4 style="margin-bottom: 10px;">👑 Администраторы</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${adminsListHtml || '<div class="profile-empty">Нет администраторов</div>'}
                    </div>
                </div>
                
                <div style="padding: 15px; border-top: 1px solid var(--border); display: flex; gap: 10px;">
                    ${!isSubscribed ? '<button onclick="subscribeToChannelFromProfile()" class="btn-primary" style="flex:1;">📢 Подписаться</button>' : ''}
                    ${isSubscribed ? '<button onclick="unsubscribeFromChannelFromProfile()" class="btn-danger" style="flex:1;">🔕 Отписаться</button>' : ''}
                    ${isCreator ? '<button onclick="deleteChannelChat()" class="btn-danger" style="flex:1;">🗑️ Удалить канал</button>' : ''}
                    <button onclick="closeChannelProfileModal()" class="btn-secondary" style="flex:1;">Закрыть</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        window.currentChannelId = chatId;
        window.currentChannelData = chatData;
        
    } catch (err) {
        console.error('Ошибка открытия профиля канала:', err);
        showNotification('Ошибка загрузки канала', 'error');
    }
};

// ========== ДЕЙСТВИЯ С ГРУППОЙ ==========
window.joinGroupChat = async function() {
    const groupId = window.currentGroupId;
    if (!groupId) return;
    
    try {
        await database.ref('chats/' + groupId + '/members/' + currentUser.uid).set(true);
        await database.ref('userChats/' + currentUser.uid + '/' + groupId).set(true);
        showNotification('Вы присоединились к группе', 'success');
        closeGroupProfileModal();
        
        if (typeof loadChats === 'function') loadChats();
        
        const chatData = await database.ref('chats/' + groupId).once('value');
        if (typeof openChatWithData === 'function') {
            openChatWithData(groupId, chatData.val());
        }
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
};

window.leaveGroupChat = async function() {
    const groupId = window.currentGroupId;
    if (!groupId) return;
    
    if (!confirm('Вы уверены, что хотите покинуть группу?')) return;
    
    try {
        await database.ref('chats/' + groupId + '/members/' + currentUser.uid).remove();
        await database.ref('userChats/' + currentUser.uid + '/' + groupId).remove();
        showNotification('Вы покинули группу', 'success');
        closeGroupProfileModal();
        
        if (typeof closeChat === 'function') closeChat();
        if (typeof loadChats === 'function') loadChats();
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
};

window.deleteGroupChat = async function() {
    const groupId = window.currentGroupId;
    if (!groupId) return;
    
    if (!confirm('ВНИМАНИЕ! Вы собираетесь УДАЛИТЬ группу навсегда. Уверены?')) return;
    
    try {
        await database.ref('messages/' + groupId).remove();
        await database.ref('chats/' + groupId).remove();
        
        const members = window.currentGroupData?.members || {};
        for (const memberId in members) {
            await database.ref('userChats/' + memberId + '/' + groupId).remove();
        }
        
        showNotification('Группа удалена', 'success');
        closeGroupProfileModal();
        
        if (typeof closeChat === 'function') closeChat();
        if (typeof loadChats === 'function') loadChats();
    } catch (err) {
        showNotification('Ошибка удаления', 'error');
    }
};

// ========== ДЕЙСТВИЯ С КАНАЛОМ ==========
window.subscribeToChannelFromProfile = async function() {
    const channelId = window.currentChannelId;
    if (!channelId) return;
    
    try {
        await database.ref('chats/' + channelId + '/subscribers/' + currentUser.uid).set(true);
        await database.ref('userChats/' + currentUser.uid + '/' + channelId).set(true);
        showNotification('Вы подписались на канал', 'success');
        closeChannelProfileModal();
        
        if (typeof loadChats === 'function') loadChats();
        
        const chatData = await database.ref('chats/' + channelId).once('value');
        if (typeof openChatWithData === 'function') {
            openChatWithData(channelId, chatData.val());
        }
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
};

window.unsubscribeFromChannelFromProfile = async function() {
    const channelId = window.currentChannelId;
    if (!channelId) return;
    
    if (!confirm('Отписаться от канала?')) return;
    
    try {
        await database.ref('chats/' + channelId + '/subscribers/' + currentUser.uid).remove();
        await database.ref('userChats/' + currentUser.uid + '/' + channelId).remove();
        showNotification('Вы отписались от канала', 'info');
        closeChannelProfileModal();
        
        if (typeof closeChat === 'function') closeChat();
        if (typeof loadChats === 'function') loadChats();
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
};

window.deleteChannelChat = async function() {
    const channelId = window.currentChannelId;
    if (!channelId) return;
    
    if (!confirm('ВНИМАНИЕ! Вы собираетесь УДАЛИТЬ канал навсегда. Уверены?')) return;
    
    try {
        await database.ref('messages/' + channelId).remove();
        await database.ref('chats/' + channelId).remove();
        
        const subscribers = window.currentChannelData?.subscribers || {};
        for (const subscriberId in subscribers) {
            await database.ref('userChats/' + subscriberId + '/' + channelId).remove();
        }
        
        if (window.currentChannelData?.kname) {
            await database.ref('channelKnames/' + window.currentChannelData.kname).remove();
        }
        
        showNotification('Канал удален', 'success');
        closeChannelProfileModal();
        
        if (typeof closeChat === 'function') closeChat();
        if (typeof loadChats === 'function') loadChats();
    } catch (err) {
        showNotification('Ошибка удаления', 'error');
    }
};

// ========== ПЕРЕОПРЕДЕЛЯЕМ openChatProfile ДЛЯ ВСЕХ ТИПОВ ЧАТОВ ==========
window.openChatProfile = function() {
    if (!window.currentChatData) {
        console.log('Нет данных чата');
        return;
    }
    
    console.log('openChatProfile: тип чата', window.currentChatData.type);
    
    if (window.currentChatData.type === 'group') {
        window.openGroupProfile(window.currentChatId);
    } 
    else if (window.currentChatData.type === 'channel') {
        window.openChannelProfile(window.currentChatId);
    }
    else if (window.currentChatData.type === 'private') {
        let otherUserId = window.currentChatData.otherUserId;
        if (!otherUserId && window.currentChatData.participants) {
            for (const uid of window.currentChatData.participants) {
                if (uid !== window.currentUser?.uid) {
                    otherUserId = uid;
                    break;
                }
            }
        }
        if (otherUserId && typeof window.openUserProfile === 'function') {
            window.openUserProfile(otherUserId);
        } else if (otherUserId && typeof openUserProfile === 'function') {
            openUserProfile(otherUserId);
        } else {
            showNotification('Профиль пользователя', 'info');
            console.log('Нужно открыть профиль пользователя:', otherUserId);
        }
    }
};

console.log('Расширенные функции профиля группы/канала добавлены!');
// ========== СУПЕР-ПРОСТОЕ ИСПРАВЛЕНИЕ ОТКРЫТИЯ ЧАТОВ ==========
// Перехватываем все клики по документу
document.addEventListener('click', function(e) {
    // Находим ближайший элемент чата
    var chatItem = e.target.closest('.chat-item');
    if (!chatItem) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    var chatId = chatItem.getAttribute('data-chat-id');
    if (!chatId) return;
    
    console.log('ГЛОБАЛЬНЫЙ КЛИК по чату:', chatId);
    
    // Принудительно показываем область чата
    var noChat = document.getElementById('no-chat-selected');
    var activeChat = document.getElementById('active-chat');
    
    if (noChat) {
        noChat.classList.add('hidden');
        noChat.style.display = 'none';
    }
    
    if (activeChat) {
        activeChat.classList.remove('hidden');
        activeChat.style.display = 'flex';
    }
    
    // Открываем чат
    if (typeof window.openChatById === 'function') {
        window.openChatById(chatId);
    } else if (typeof openChatById === 'function') {
        openChatById(chatId);
    }
    
    return false;
}, true); // true = захват события на фазе погружения

console.log('✅ Глобальный обработчик кликов по чатам установлен!');

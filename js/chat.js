// KUKUMBER MESSENGER - CHAT.JS (ИСПРАВЛЕННАЯ ВЕРСИЯ)

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var selectedGroupMembers = [];
var typingTimeout = null;
var loadedMessageIds = new Set();
var chatsCache = [];
var contactsCache = null;
var contactsCacheTime = 0;
var userStatusCache = {};
var userAvatarCache = {};
var usernameCache = {};

// ========== КОНСТАНТЫ ==========
var CONTACTS_CACHE_TTL = 30000;
var STATUS_CACHE_TTL = 15000;
var CHATS_LIMIT = 50;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getUserStatus(userId) {
    return new Promise(function(resolve) {
        if (userStatusCache[userId] && (Date.now() - userStatusCache[userId].time) < STATUS_CACHE_TTL) {
            resolve(userStatusCache[userId].data);
            return;
        }
        database.ref('users/' + userId + '/status').once('value').then(function(snap) {
            var data = snap.val() || { online: false };
            userStatusCache[userId] = { data: data, time: Date.now() };
            resolve(data);
        }).catch(function() { resolve({ online: false }); });
    });
}

function getUserAvatar(userId) {
    return new Promise(function(resolve) {
        if (userAvatarCache[userId]) {
            resolve(userAvatarCache[userId]);
            return;
        }
        database.ref('users/' + userId + '/avatar').once('value').then(function(snap) {
            var avatar = snap.val() || '';
            userAvatarCache[userId] = avatar;
            resolve(avatar);
        }).catch(function() { resolve(''); });
    });
}

function getUsername(userId) {
    return new Promise(function(resolve) {
        if (usernameCache[userId]) {
            resolve(usernameCache[userId]);
            return;
        }
        database.ref('users/' + userId + '/username').once('value').then(function(snap) {
            var name = snap.val() || 'Пользователь';
            usernameCache[userId] = name;
            resolve(name);
        }).catch(function() { resolve('Пользователь'); });
    });
}

function initChatSounds() {
    if (typeof KukumberSounds !== 'undefined') {
        KukumberSounds.init();
    }
}

// ========== ЗАГРУЗКА ЧАТОВ ==========
function loadChats() {
    if (!currentUser) return;
    
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) return;
    
    if (window.chatsListener) {
        window.chatsListener.off();
    }
    
    chatsList.innerHTML = '<div class="empty-chats"><div class="loading-spinner">🔄 Загрузка чатов...</div></div>';
    
    window.chatsListener = database.ref('userChats/' + currentUser.uid);
    window.chatsListener.on('value', function(snapshot) {
        var chatsData = snapshot.val();
        
        if (!chatsData) { 
            chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>'; 
            return; 
        }
        
        var chatIds = Object.keys(chatsData);
        chatIds = [...new Set(chatIds)];
        
        if (chatIds.length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>';
            return;
        }
        
        var loadedChats = [];
        var count = 0;
        
        chatIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value').then(function(chatSnap) {
                var chatData = chatSnap.val();
                if (chatData && !loadedChats.some(function(c) { return c.chatId === chatId; })) {
                    loadedChats.push({ chatId: chatId, data: chatData });
                }
                count++;
                if (count === chatIds.length) {
                    renderChats(loadedChats);
                }
            }).catch(function() { count++; });
        });
    });
}

function renderChats(chats) {
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) return;
    
    var uniqueChats = [];
    var seenIds = {};
    for (var i = 0; i < chats.length; i++) {
        if (!seenIds[chats[i].chatId]) {
            seenIds[chats[i].chatId] = true;
            uniqueChats.push(chats[i]);
        }
    }
    chats = uniqueChats;
    
    chats.sort(function(a,b) { 
        return (b.data.lastMessageTime||0) - (a.data.lastMessageTime||0); 
    });
    
    chatsList.innerHTML = '';
    
    if (chats.length === 0) { 
        chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>'; 
        return; 
    }
    
    var batchSize = 10;
    var index = 0;
    
    function renderBatch() {
        var end = Math.min(index + batchSize, chats.length);
        for (var i = index; i < end; i++) {
            createChatItem(chats[i].chatId, chats[i].data);
        }
        index = end;
        if (index < chats.length) {
            setTimeout(renderBatch, 50);
        }
    }
    
    renderBatch();
}

function createChatItem(chatId, chatData) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    if (currentChatId === chatId) div.classList.add('active');
    var name = '', avatar = '', badge = '', isOnline = false;
    var avatarContent = '';
    var avatarStyle = '';
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatar = chatData.avatar || '';
        badge = '<span class="chat-type-badge">👥</span>';
        finishCreate();
    } else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatar = chatData.avatar || '';
        badge = '<span class="chat-type-badge">📢</span>';
        finishCreate();
    } else {
        // Приватный чат
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
            Promise.all([getUsername(otherUserId), getUserAvatar(otherUserId), getUserStatus(otherUserId)]).then(function(results) {
                name = results[0];
                avatar = results[1];
                isOnline = results[2].online === true;
                chatData.otherUserId = otherUserId;
                if (!chatData.otherUser) chatData.otherUser = {};
                chatData.otherUser.username = name;
                chatData.otherUser.avatar = avatar;
                finishCreate();
            });
        } else { 
            name = 'Пользователь'; 
            finishCreate(); 
        }
        return;
    }
    
    function finishCreate() {
        if (avatar && avatar.indexOf('http') === 0) { 
            avatarStyle = 'background-image:url('+avatar+');background-size:cover;'; 
            avatarContent = ''; 
        } else { 
            avatarStyle = '';
            avatarContent = chatData.type === 'group' ? '👥' : (chatData.type === 'channel' ? '📢' : '👤'); 
        }
        var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
        var preview = chatData.lastMessage || 'Нет сообщений';
        if (preview.length > 50) preview = preview.substring(0, 47) + '...';
        
        div.innerHTML = '<div class="chat-item-avatar"><div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div>'+(isOnline?'<div class="online-indicator"></div>':'')+badge+'</div><div class="chat-item-info"><div class="chat-item-header"><span class="chat-item-name">'+escapeHtml(name)+'</span><span class="chat-item-time">'+time+'</span></div><div class="chat-item-preview">'+escapeHtml(preview)+'</div></div>';
        div.onclick = function() { openChat(chatId, chatData); };
        var chatsList = document.getElementById('chats-list');
        if (chatsList) chatsList.appendChild(div);
    }
}

// ========== ОТКРЫТИЕ ЧАТА (ИСПРАВЛЕНО) ==========
function openChat(chatId, chatData) {
    console.log('openChat вызван с chatId:', chatId, 'chatData:', chatData);
    
    // Закрываем боковое меню на мобильных
    closeSidebar();
    
    if (!chatData || !chatData.type) {
        database.ref('chats/' + chatId).once('value').then(function(snapshot) {
            var freshData = snapshot.val();
            if (freshData) {
                openChatWithData(chatId, freshData);
            } else {
                showNotification('Чат не найден', 'error');
            }
        });
        return;
    }
    
    openChatWithData(chatId, chatData);
}

function openChatWithData(chatId, chatData) {
    console.log('openChatWithData:', chatId, chatData);
    
    currentChatId = chatId;
    currentChatUser = chatData;
    currentChatUser.chatId = chatId;
    
    // Показываем активный чат, скрываем заглушку
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    if (noChatElement) noChatElement.classList.add('hidden');
    if (activeChatElement) activeChatElement.classList.remove('hidden');
    
    var name = '', avatar = '', status = '';
    
    // Проверяем существование элементов перед использованием
    var messageInputArea = document.getElementById('message-input-area');
    var channelFooter = document.getElementById('channel-footer');
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatar = chatData.avatar || '';
        var membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
        status = membersCount + ' участников';
        if (messageInputArea) messageInputArea.classList.remove('hidden');
        if (channelFooter) channelFooter.classList.add('hidden');
        hideCallButtons();
        
    } else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatar = chatData.avatar || '';
        var subsCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
        status = subsCount + ' подписчиков';
        var isAdmin = chatData.admins && chatData.admins[currentUser.uid];
        if (messageInputArea) {
            if (isAdmin) {
                messageInputArea.classList.remove('hidden');
            } else {
                messageInputArea.classList.add('hidden');
            }
        }
        if (channelFooter) {
            if (isAdmin) {
                channelFooter.classList.add('hidden');
            } else {
                channelFooter.classList.remove('hidden');
            }
        }
        hideCallButtons();
        
    } else {
        // ПРИВАТНЫЙ ЧАТ
        if (messageInputArea) messageInputArea.classList.remove('hidden');
        if (channelFooter) channelFooter.classList.add('hidden');
        showCallButtons();
        
        // Определяем ID собеседника
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
            chatData.otherUserId = otherUserId;
            
            // Загружаем данные пользователя
            Promise.all([getUsername(otherUserId), getUserAvatar(otherUserId), getUserStatus(otherUserId)]).then(function(results) {
                var userName = results[0];
                var userAvatar = results[1];
                var userStatus = results[2];
                
                if (!chatData.otherUser) chatData.otherUser = {};
                chatData.otherUser.username = userName;
                chatData.otherUser.avatar = userAvatar;
                chatData.otherUser.userId = otherUserId;
                
                var chatUsernameEl = document.getElementById('chat-username');
                if (chatUsernameEl) chatUsernameEl.textContent = userName;
                
                var chatAvatar = document.getElementById('chat-avatar');
                if (chatAvatar) {
                    if (userAvatar && userAvatar.indexOf('http') === 0) {
                        chatAvatar.style.backgroundImage = 'url(' + userAvatar + ')';
                        chatAvatar.style.backgroundSize = 'cover';
                        chatAvatar.textContent = '';
                        chatAvatar.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
                    } else {
                        chatAvatar.style.backgroundImage = '';
                        chatAvatar.classList.add('default-avatar-user');
                        chatAvatar.textContent = '';
                    }
                }
                
                var statusEl = document.getElementById('chat-status');
                if (statusEl) {
                    if (userStatus.online) {
                        statusEl.innerHTML = 'в сети';
                    } else {
                        statusEl.innerHTML = formatLastSeen(userStatus.lastSeen);
                    }
                }
                
                // Делаем шапку чата кликабельной для открытия профиля
                var chatHeader = document.querySelector('.chat-user-info');
                if (chatHeader) {
                    chatHeader.style.cursor = 'pointer';
                    // Убираем старый обработчик, чтобы не было конфликтов
                    chatHeader.removeEventListener('click', chatHeader._profileClickHandler);
                    chatHeader._profileClickHandler = function(e) {
                        e.stopPropagation();
                        if (typeof openUserProfile === 'function') {
                            openUserProfile(otherUserId);
                        } else if (typeof window.openUserProfile === 'function') {
                            window.openUserProfile(otherUserId);
                        } else {
                            showNotification('Функция профиля не загружена', 'error');
                        }
                    };
                    chatHeader.addEventListener('click', chatHeader._profileClickHandler);
                }
            });
        } else {
            var chatUsernameEl = document.getElementById('chat-username');
            if (chatUsernameEl) chatUsernameEl.textContent = 'Пользователь';
            var statusEl = document.getElementById('chat-status');
            if (statusEl) statusEl.textContent = 'загрузка...';
        }
    }
    
    // Обновляем аватарку чата (для групп и каналов)
    var chatAvatar = document.getElementById('chat-avatar');
    if (chatAvatar) {
        if (avatar && avatar.indexOf('http') === 0) {
            chatAvatar.style.backgroundImage = 'url(' + avatar + ')';
            chatAvatar.style.backgroundSize = 'cover';
            chatAvatar.textContent = '';
            chatAvatar.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
        } else if (chatData.type !== 'private') {
            chatAvatar.style.backgroundImage = '';
            if (chatData.type === 'group') {
                chatAvatar.classList.add('default-avatar-group');
            } else if (chatData.type === 'channel') {
                chatAvatar.classList.add('default-avatar-channel');
            }
            chatAvatar.textContent = '';
        }
    }
    
    // Обновляем имя и статус для групп/каналов
    if (chatData.type !== 'private') {
        var chatUsernameEl = document.getElementById('chat-username');
        if (chatUsernameEl) chatUsernameEl.textContent = name;
        var statusEl = document.getElementById('chat-status');
        if (statusEl) statusEl.textContent = status;
    }
    
    // Подсвечиваем активный чат в списке
    var chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(function(item) {
        item.classList.remove('active');
    });
    
    // Ищем и подсвечиваем нужный чат
    for (var i = 0; i < chatItems.length; i++) {
        var item = chatItems[i];
        var onClickAttr = item.getAttribute('onclick');
        if (onClickAttr && onClickAttr.includes("openChat('" + chatId + "'")) {
            item.classList.add('active');
            break;
        }
    }
    
    // Загружаем сообщения
    loadMessages(chatId);
    setupTypingListener(chatId);
}

function hideCallButtons() {
    var btns = document.querySelectorAll('.call-btn');
    btns.forEach(function(btn) { 
        if (btn) btn.style.display = 'none'; 
    });
}

function showCallButtons() {
    var btns = document.querySelectorAll('.call-btn');
    btns.forEach(function(btn) { 
        if (btn) btn.style.display = 'inline-flex'; 
    });
}

function closeChat() {
    var activeChat = document.getElementById('active-chat');
    var noChat = document.getElementById('no-chat-selected');
    
    if (activeChat) activeChat.classList.add('hidden');
    if (noChat) noChat.classList.remove('hidden');
    
    currentChatId = null;
    currentChatUser = null;
    if (messagesListener) messagesListener.off();
    loadedMessageIds.clear();
}

// ========== СООБЩЕНИЯ ==========
// ========== СООБЩЕНИЯ ==========
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    container.innerHTML = '';
    loadedMessageIds.clear();
    
    if (messagesListener) messagesListener.off();
    
    // Флаг для авто-прокрутки
    var shouldAutoScroll = true;
    
    // Отслеживаем, прокручивает ли пользователь вручную
    container.addEventListener('scroll', function() {
        var isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        shouldAutoScroll = isAtBottom;
    });
    
    messagesListener = database.ref('messages/'+chatId).orderByChild('timestamp').limitToLast(50);
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        var messageId = snapshot.key;
        
        if (loadedMessageIds.has(messageId)) return;
        loadedMessageIds.add(messageId);
        
        message.id = messageId;
        createMessageElement(message);
        
        // Автопрокрутка вниз только если пользователь внизу
        if (shouldAutoScroll) {
            setTimeout(function() {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
        
        if (message.senderId !== currentUser.uid) {
            if (typeof playReceiveSound === 'function') {
                playReceiveSound();
            } else if (typeof KukumberSounds !== 'undefined') {
                KukumberSounds.playReceive();
            }
        }
    });
    
    messagesListener.on('child_changed', function(snapshot) {
        var message = snapshot.val();
        message.id = snapshot.key;
        updateMessageElement(message);
    });
    
    messagesListener.on('child_removed', function(snapshot) {
        var removedId = snapshot.key;
        var msgElement = document.querySelector('.message[data-message-id="'+removedId+'"]');
        if (msgElement) msgElement.remove();
        loadedMessageIds.delete(removedId);
    });
    
    // Загружаем старые сообщения при прокрутке вверх
    var lastLoadedTimestamp = null;
    var isLoadingMore = false;
    
    container.addEventListener('scroll', function() {
        if (container.scrollTop < 100 && !isLoadingMore) {
            loadMoreMessages(chatId, lastLoadedTimestamp);
        }
    });
    
    function loadMoreMessages(chatId, beforeTimestamp) {
        isLoadingMore = true;
        var query = database.ref('messages/'+chatId).orderByChild('timestamp');
        if (beforeTimestamp) {
            query = query.endAt(beforeTimestamp - 1);
        }
        query.limitToLast(20).once('value').then(function(snapshot) {
            var messages = snapshot.val();
            if (messages) {
                var messageKeys = Object.keys(messages);
                if (messageKeys.length > 0) {
                    var oldScrollHeight = container.scrollHeight;
                    
                    messageKeys.forEach(function(key) {
                        var message = messages[key];
                        if (!loadedMessageIds.has(key)) {
                            loadedMessageIds.add(key);
                            message.id = key;
                            prependMessageElement(message);
                        }
                    });
                    
                    // Сохраняем позицию прокрутки
                    var newScrollHeight = container.scrollHeight;
                    container.scrollTop = newScrollHeight - oldScrollHeight;
                    
                    // Обновляем lastLoadedTimestamp
                    var oldestMsg = messages[messageKeys[0]];
                    if (oldestMsg && oldestMsg.timestamp) {
                        lastLoadedTimestamp = oldestMsg.timestamp;
                    }
                }
            }
            isLoadingMore = false;
        }).catch(function() {
            isLoadingMore = false;
        });
    }
}

function prependMessageElement(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var div = document.createElement('div');
    var isSent = message.senderId === currentUser.uid;
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.setAttribute('data-message-id', message.id);
    div.setAttribute('data-sender-id', message.senderId);
    
    var content = '';
    
    if (message.type === 'image') {
        content = '<div class="message-image" onclick="openLightbox(\''+message.imageUrl+'\')"><img src="'+message.imageUrl+'" class="lazy-message" loading="lazy"></div>';
        if (message.caption && message.caption.trim()) {
            content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
        }
    } else if (message.type === 'gif') {
        content = '<div class="gif-message" onclick="openLightbox(\''+message.gifUrl+'\')"><img src="'+message.gifUrl+'" alt="GIF" class="gif-image lazy-message" loading="lazy"><span class="gif-badge">GIF</span></div>';
        if (message.caption && message.caption.trim()) {
            content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
        }
    } else if (message.type === 'audio') {
        content = '<div class="audio-message"><button onclick="playAudio(\''+message.audioUrl+'\')">▶️</button><span>Голосовое сообщение</span></div>';
    } else if (message.type === 'video') {
        content = '<div class="video-message"><video src="'+message.videoUrl+'" controls preload="metadata" style="max-width:250px; max-height:300px; border-radius:12px;"></video><div class="message-text">'+escapeHtml(message.fileName || 'Видео')+'</div></div>';
    } else if (message.type === 'file') {
        var fileIcon = '📎';
        content = '<div class="file-message"><span style="font-size:24px;">'+fileIcon+'</span><a href="'+message.fileUrl+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(message.fileName)+'</a></div>';
    } else {
        var textContent = formatMessageText(message.text || '');
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content = '<div class="message-text">'+textContent+'</div>';
    }
    
    div.innerHTML = '<div class="message-content" style="flex:1;">'+content+'<div class="message-time">'+formatTime(message.timestamp)+'</div></div>';
    
    // Вставляем в начало
    if (container.firstChild) {
        container.insertBefore(div, container.firstChild);
    } else {
        container.appendChild(div);
    }
}
function createMessageElement(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var div = document.createElement('div');
    var isSent = message.senderId === currentUser.uid;
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.setAttribute('data-message-id', message.id);
    div.setAttribute('data-sender-id', message.senderId);
    
    var content = '';
    
    if (message.type === 'image') {
        content = '<div class="message-image" onclick="openLightbox(\''+message.imageUrl+'\')"><img src="'+message.imageUrl+'" class="lazy-message" loading="lazy"></div>';
        if (message.caption && message.caption.trim()) {
            content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
        }
    } else if (message.type === 'gif') {
        content = '<div class="gif-message" onclick="openLightbox(\''+message.gifUrl+'\')"><img src="'+message.gifUrl+'" alt="GIF" class="gif-image lazy-message" loading="lazy"><span class="gif-badge">GIF</span></div>';
        if (message.caption && message.caption.trim()) {
            content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
        }
    } else if (message.type === 'audio') {
        content = '<div class="audio-message"><button onclick="playAudio(\''+message.audioUrl+'\')">▶️</button><span>Голосовое сообщение</span></div>';
    } else if (message.type === 'video') {
        content = '<div class="video-message"><video src="'+message.videoUrl+'" controls preload="metadata" style="max-width:250px; max-height:300px; border-radius:12px;"></video><div class="message-text">'+escapeHtml(message.fileName || 'Видео')+'</div></div>';
    } else if (message.type === 'file') {
        var fileIcon = '📎';
        content = '<div class="file-message"><span style="font-size:24px;">'+fileIcon+'</span><a href="'+message.fileUrl+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(message.fileName)+'</a></div>';
    } else {
        var textContent = formatMessageText(message.text || '');
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content = '<div class="message-text">'+textContent+'</div>';
    }
    
    div.innerHTML = '<div class="message-content" style="flex:1;">'+content+'<div class="message-time">'+formatTime(message.timestamp)+'</div></div>';
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function formatMessageText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #228B22; text-decoration: none;">$1</a>');
    text = text.replace(/@(\w+)/g, '<span style="color:#228B22; cursor:pointer;" onclick="openUserProfileByUsername(\'$1\')">@$1</span>');
    return text;
}

function updateMessageElement(message) {
    var existingDiv = document.querySelector('.message[data-message-id="'+message.id+'"]');
    if (existingDiv) {
        var textDiv = existingDiv.querySelector('.message-text');
        if (textDiv && message.text) {
            var newText = formatMessageText(message.text);
            if (message.edited) newText += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
            textDiv.innerHTML = newText;
        }
    }
}

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
    
    database.ref('messages/'+currentChatId).push(message).then(function() {
        var lastMsg = text.length > 50 ? text.substring(0,50)+'...' : text;
        database.ref('chats/'+currentChatId).update({ 
            lastMessage: lastMsg, 
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP 
        });
        
        if (typeof playSendSound === 'function') {
            playSendSound();
        } else if (typeof KukumberSounds !== 'undefined') {
            KukumberSounds.playSend();
        }
    }).catch(function(err) { 
        showNotification('Ошибка', 'error'); 
        input.value = text; 
    });
    
    var emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker) emojiPicker.classList.add('hidden');
}

function handleMessageKeyPress(e) { 
    if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
    } 
}

function onTyping() {
    if (!currentChatId) return;
    database.ref('typing/'+currentChatId+'/'+currentUser.uid).set(true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() { 
        database.ref('typing/'+currentChatId+'/'+currentUser.uid).remove(); 
    }, 1000);
}

function setupTypingListener(chatId) {
    database.ref('typing/'+chatId).off();
    database.ref('typing/'+chatId).on('value', function(snap) {
        var data = snap.val();
        var typingUsers = [];
        for (var uid in data) {
            if (uid !== currentUser.uid && data[uid] === true) typingUsers.push(uid);
        }
        var statusEl = document.getElementById('chat-status');
        if (!statusEl) return;
        
        if (typingUsers.length) {
            statusEl.innerHTML = 'печатает...';
        } else {
            if (currentChatUser && currentChatUser.type === 'private' && currentChatUser.otherUserId) {
                getUserStatus(currentChatUser.otherUserId).then(function(statusData) {
                    if (statusEl) {
                        if (statusData.online) statusEl.innerHTML = 'в сети';
                        else statusEl.innerHTML = formatLastSeen(statusData.lastSeen);
                    }
                });
            } else if (currentChatUser && currentChatUser.type === 'group') {
                var membersCount = currentChatUser.members ? Object.keys(currentChatUser.members).length : 0;
                statusEl.innerHTML = membersCount + ' участников';
            } else if (currentChatUser && currentChatUser.type === 'channel') {
                var subsCount = currentChatUser.subscribers ? Object.keys(currentChatUser.subscribers).length : 0;
                statusEl.innerHTML = subsCount + ' подписчиков';
            } else {
                statusEl.innerHTML = 'в сети';
            }
        }
    });
}

function playAudio(url) { 
    var audio = new Audio(url); 
    audio.play().catch(function(e) { console.log('Audio play error:', e); });
}

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

// ========== ПРОФИЛЬ КАНАЛА/ГРУППЫ ==========
function openChannelOrGroupProfile() {
    if (!currentChatId || !currentChatUser) {
        showNotification('Чат не выбран', 'error');
        return;
    }
    
    // ЛИЧНЫЙ ЧАТ
    if (currentChatUser.type === 'private' && currentChatUser.otherUserId) {
        if (typeof openUserProfile === 'function') {
            openUserProfile(currentChatUser.otherUserId);
        } else if (typeof window.openUserProfile === 'function') {
            window.openUserProfile(currentChatUser.otherUserId);
        } else {
            showNotification('Функция профиля не загружена, обновите страницу', 'error');
        }
        return;
    }
    
    // КАНАЛ
    if (currentChatUser.type === 'channel') {
        if (typeof openChannelProfile === 'function') {
            openChannelProfile(currentChatId);
        } else {
            showNotification('Функция профиля канала не загружена', 'error');
        }
        return;
    }
    
    // ГРУППА
    if (currentChatUser.type === 'group') {
        if (typeof openGroupProfile === 'function') {
            openGroupProfile(currentChatId);
        } else {
            showNotification('Функция профиля группы не загружена', 'error');
        }
        return;
    }
    
    showNotification('Неизвестный тип чата', 'error');
}

// ========== ПОИСК ==========
function searchGlobalNew() {
    var query = document.getElementById('global-search-input').value.trim().toLowerCase();
    var resultsContainer = document.getElementById('global-search-results');
    var resultsList = document.getElementById('search-results-list');
    
    if (!query || query.length < 2) {
        if (resultsContainer) resultsContainer.style.display = 'none';
        return;
    }
    
    if (resultsContainer) resultsContainer.style.display = 'flex';
    if (resultsList) resultsList.innerHTML = '<div class="loading-spinner">🔍 Поиск...</div>';
    
    searchUsersGlobal(query).then(function(users) {
        renderSearchResults(users, query);
    }).catch(function(err) {
        console.error('Ошибка поиска:', err);
        if (resultsList) resultsList.innerHTML = '<div class="empty-search">Ошибка поиска</div>';
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
            results.push({ type: 'user', uid: uid, ...user });
        }
        if (results.length >= 15) break;
    }
    return results;
}

function renderSearchResults(users, query) {
    var container = document.getElementById('search-results-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!users.length) {
        container.innerHTML = '<div class="empty-search">Ничего не найдено</div>';
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
            <div class="search-result-badge" style="background: var(--forest); color: white;">👤</div>
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

function startPrivateChat(otherUserId, otherUser) {
    var chatId = generateChatId(currentUser.uid, otherUserId);
    database.ref('chats/' + chatId).once('value').then(function(snapshot) {
        if (!snapshot.exists()) {
            return database.ref('chats/' + chatId).set({
                type: 'private',
                participants: [currentUser.uid, otherUserId],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: '',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            }).then(function() {
                return Promise.all([
                    database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true),
                    database.ref('userChats/' + otherUserId + '/' + chatId).set(true)
                ]);
            });
        }
    }).then(function() {
        closeSearchResults();
        var chatData = { 
            type: 'private', 
            otherUserId: otherUserId, 
            otherUser: otherUser, 
            participants: [currentUser.uid, otherUserId] 
        };
        openChat(chatId, chatData);
        showNotification('Чат создан!', 'success');
    }).catch(function(err) { 
        console.error(err); 
        showNotification('Ошибка', 'error'); 
    });
}

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
        <div id="new-chat-modal" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 400px; border-radius: 20px;">
                <div class="modal-header" style="padding: 15px 20px;">
                    <h3 style="margin: 0;">💬 Новый чат</h3>
                    <button onclick="closeNewChatDialog()" class="btn-close">×</button>
                </div>
                <div style="padding: 15px;">
                    <div style="position: relative;">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--forest); font-size: 16px;">🔍</span>
                        <input type="text" id="new-chat-search-input" placeholder="Введите @username или имя пользователя..." 
                               style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid var(--border); border-radius: 30px; font-size: 14px; outline: none;"
                               oninput="searchUsersForNewChat()">
                    </div>
                    <div id="new-chat-users-list" style="margin-top: 15px; max-height: 400px; overflow-y: auto;">
                        <div class="loading-spinner" style="text-align: center; padding: 20px;">🔍 Введите имя пользователя для поиска</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('new-chat-modal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    var modal = document.getElementById('new-chat-modal');
    if (modal) modal.classList.remove('hidden');
    
    setTimeout(function() {
        var searchInput = document.getElementById('new-chat-search-input');
        if (searchInput) searchInput.focus();
    }, 100);
}

function closeNewChatDialog() {
    var modal = document.getElementById('new-chat-modal');
    if (modal) modal.remove();
}

var searchTimeoutNewChat = null;

function searchUsersForNewChat() {
    var query = document.getElementById('new-chat-search-input').value.trim().toLowerCase();
    var container = document.getElementById('new-chat-users-list');
    
    if (searchTimeoutNewChat) clearTimeout(searchTimeoutNewChat);
    
    if (!query || query.length < 2) {
        if (container) container.innerHTML = '<div class="loading-spinner" style="text-align: center; padding: 20px;">🔍 Введите минимум 2 символа для поиска</div>';
        return;
    }
    
    if (container) container.innerHTML = '<div class="loading-spinner" style="text-align: center; padding: 20px;">🔍 Поиск...</div>';
    
    searchTimeoutNewChat = setTimeout(async function() {
        var results = await searchUsersForChat(query);
        renderUsersForNewChat(results, container);
    }, 300);
}

async function searchUsersForChat(query) {
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
                avatar: user.avatar || '',
                bio: user.bio || ''
            });
        }
        if (results.length >= 20) break;
    }
    return results;
}

function renderUsersForNewChat(users, container) {
    if (!container) return;
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-search" style="text-align: center; padding: 20px; color: var(--text-muted);">👤 Пользователи не найдены</div>';
        return;
    }
    
    users.forEach(function(user) {
        var div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;';
        div.onmouseenter = function() { div.style.background = 'var(--background)'; };
        div.onmouseleave = function() { div.style.background = 'white'; };
        
        var avatarDiv = document.createElement('div');
        avatarDiv.style.cssText = 'width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--sage); font-size: 24px; flex-shrink: 0;';
        
        if (user.avatar && user.avatar.startsWith('http')) {
            avatarDiv.style.backgroundImage = 'url(' + user.avatar + ')';
            avatarDiv.style.backgroundSize = 'cover';
            avatarDiv.style.backgroundPosition = 'center';
            avatarDiv.textContent = '';
        } else {
            avatarDiv.textContent = '👤';
        }
        
        var infoDiv = document.createElement('div');
        infoDiv.style.flex = '1';
        infoDiv.innerHTML = `
            <div style="font-weight: 600; font-size: 16px;">${escapeHtml(user.username)}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${user.userTag ? '@' + user.userTag : '@' + user.username.toLowerCase().replace(/\s/g, '')}</div>
        `;
        
        var arrowDiv = document.createElement('div');
        arrowDiv.style.cssText = 'color: var(--forest); font-size: 20px;';
        arrowDiv.textContent = '➤';
        
        div.appendChild(avatarDiv);
        div.appendChild(infoDiv);
        div.appendChild(arrowDiv);
        
        div.onclick = function() { createNewChatAndOpen(user.uid, user); };
        container.appendChild(div);
    });
}

async function createNewChatAndOpen(otherUserId, otherUser) {
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
        
        var welcomeMessage = {
            type: 'text',
            text: '🍃 Добро пожаловать в чат! Здесь вы можете общаться, делиться фото и файлами.',
            senderId: 'system',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            isSystem: true
        };
        await database.ref('messages/' + chatId).push(welcomeMessage);
        
        showNotification('Чат создан!', 'success');
    } else {
        showNotification('Чат уже существует', 'info');
    }
    
    closeNewChatDialog();
    closeSearchResults();
    
    var chatData = await database.ref('chats/' + chatId).once('value');
    var chat = chatData.val();
    chat.otherUserId = otherUserId;
    chat.otherUser = otherUser;
    
    openChat(chatId, chat);
    loadChats();
}

// Экспорт функций в глобальную область
window.loadChats = loadChats;
window.openChat = openChat;
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
window.createNewChatAndOpen = createNewChatAndOpen;
window.startPrivateChat = startPrivateChat;
window.openChannelOrGroupProfile = openChannelOrGroupProfile;
window.hideCallButtons = hideCallButtons;
window.showCallButtons = showCallButtons;

// Инициализация
initChatSounds();

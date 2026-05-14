// KUKUMBER MESSENGER - CHAT.JS (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// Звуки при отправке и получении сообщений
// Кэширование, быстрая загрузка, без дублей

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

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ С КЭШЕМ ==========
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

// ========== ИНИЦИАЛИЗАЦИЯ ЗВУКОВ ==========
function initChatSounds() {
    if (typeof KukumberSounds !== 'undefined') {
        KukumberSounds.init();
    }
}

// ========== ЧАТЫ (ОПТИМИЗИРОВАННЫЕ) ==========
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
    
    // Убираем дубликаты
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
    
    // Рендерим партиями для плавности
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

// ЕДИНСТВЕННАЯ ФУНКЦИЯ createChatItem (исправлена)
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

function openChat(chatId, chatData) {
    currentChatId = chatId;
    currentChatUser = chatData;
    currentChatUser.chatId = chatId;
    closeSidebar();
    document.getElementById('no-chat-selected').classList.add('hidden');
    document.getElementById('active-chat').classList.remove('hidden');
    
    var name = '', avatar = '', status = '';
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatar = chatData.avatar || '';
        var membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
        status = membersCount + ' участников';
        hideCallButtons();
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    } else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatar = chatData.avatar || '';
        var subsCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
        status = subsCount + ' подписчиков';
        hideCallButtons();
        var isAdmin = chatData.admins && chatData.admins[currentUser.uid];
        if (isAdmin) {
            document.getElementById('message-input-area').classList.remove('hidden');
            document.getElementById('channel-footer').classList.add('hidden');
        } else {
            document.getElementById('message-input-area').classList.add('hidden');
            document.getElementById('channel-footer').classList.remove('hidden');
        }
    } else {
        name = chatData.otherUser ? chatData.otherUser.username : 'Пользователь';
        avatar = chatData.otherUser ? chatData.otherUser.avatar : '';
        getUserStatus(chatData.otherUserId).then(function(statusData) {
            var statusEl = document.getElementById('chat-status');
            if (statusEl) {
                if (statusData.online) statusEl.innerHTML = 'в сети';
                else statusEl.innerHTML = formatLastSeen(statusData.lastSeen);
            }
        });
        status = 'загрузка...';
        showCallButtons();
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    }
    
    document.getElementById('chat-username').textContent = name;
    document.getElementById('chat-status').textContent = status;
    
    var chatAvatar = document.getElementById('chat-avatar');
    if (avatar && avatar.indexOf('http') === 0) {
        chatAvatar.style.backgroundImage = 'url(' + avatar + ')';
        chatAvatar.style.backgroundSize = 'cover';
        chatAvatar.textContent = '';
        chatAvatar.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
    } else {
        chatAvatar.style.backgroundImage = '';
        if (chatData.type === 'group') chatAvatar.classList.add('default-avatar-group');
        else if (chatData.type === 'channel') chatAvatar.classList.add('default-avatar-channel');
        else chatAvatar.classList.add('default-avatar-user');
        chatAvatar.textContent = '';
    }
    
    if (chatData.type === 'private' && chatData.otherUserId) {
        var chatHeader = document.querySelector('.chat-user-info');
        if (chatHeader) {
            chatHeader.style.cursor = 'pointer';
            chatHeader.onclick = function() {
                if (typeof openUserProfile === 'function') {
                    openUserProfile(chatData.otherUserId);
                } else {
                    showNotification('Функция профиля не загружена', 'error');
                }
            };
        }
    } else {
        var chatHeader = document.querySelector('.chat-user-info');
        if (chatHeader) {
            chatHeader.style.cursor = 'pointer';
            chatHeader.onclick = function() {
                openChannelOrGroupProfile();
            };
        }
    }
    
    document.querySelectorAll('.chat-item').forEach(function(i) { 
        i.classList.remove('active'); 
    });
    
    // Находим активный чат по ID
    var chatItems = document.querySelectorAll('.chat-item');
    for (var i = 0; i < chatItems.length; i++) {
        var item = chatItems[i];
        var onClickAttr = item.getAttribute('onclick');
        if (onClickAttr && onClickAttr.includes("openChat('" + chatId + "'")) {
            item.classList.add('active');
            break;
        }
    }
    
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
    document.getElementById('active-chat').classList.add('hidden');
    document.getElementById('no-chat-selected').classList.remove('hidden');
    currentChatId = null;
    currentChatUser = null;
    if (messagesListener) messagesListener.off();
    loadedMessageIds.clear();
}

// ========== СООБЩЕНИЯ ==========
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    container.innerHTML = '';
    loadedMessageIds.clear();
    
    if (messagesListener) messagesListener.off();
    
    messagesListener = database.ref('messages/'+chatId).orderByChild('timestamp').limitToLast(50);
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        var messageId = snapshot.key;
        
        if (loadedMessageIds.has(messageId)) return;
        loadedMessageIds.add(messageId);
        
        message.id = messageId;
        createMessageElement(message);
        
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
}

function createMessageElement(message) {
    var container = document.getElementById('messages-container');
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

// ========== ОТПРАВКА СООБЩЕНИЙ ==========
function sendMessage() {
    var input = document.getElementById('message-input');
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
    
    document.getElementById('emoji-picker').classList.add('hidden');
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
        if (typingUsers.length) {
            statusEl.innerHTML = 'печатает...';
        } else {
            if (currentChatUser.type === 'private' && currentChatUser.otherUserId) {
                getUserStatus(currentChatUser.otherUserId).then(function(statusData) {
                    if (statusData.online) statusEl.innerHTML = 'в сети';
                    else statusEl.innerHTML = formatLastSeen(statusData.lastSeen);
                });
            } else if (currentChatUser.type === 'group') {
                statusEl.innerHTML = (currentChatUser.members ? Object.keys(currentChatUser.members).length : 0) + ' участников';
            } else if (currentChatUser.type === 'channel') {
                statusEl.innerHTML = (currentChatUser.subscribers ? Object.keys(currentChatUser.subscribers).length : 0) + ' подписчиков';
            } else {
                statusEl.innerHTML = 'в сети';
            }
        }
    });
}

function playAudio(url) { 
    var audio = new Audio(url); 
    audio.play(); 
}

function openLightbox(url) { 
    document.getElementById('lightbox-image').src = url; 
    document.getElementById('image-lightbox').classList.remove('hidden'); 
}

function closeLightbox() { 
    document.getElementById('image-lightbox').classList.add('hidden'); 
}

// ========== ПРОФИЛЬ КАНАЛА/ГРУППЫ ==========
function openChannelOrGroupProfile() {
    if (!currentChatId || !currentChatUser) {
        showNotification('Чат не выбран', 'error');
        return;
    }
    
    if (currentChatUser.type === 'channel') {
        openChannelProfile(currentChatId);
    } else if (currentChatUser.type === 'group') {
        showNotification('Профиль группы в разработке', 'info');
    } else if (currentChatUser.type === 'private' && currentChatUser.otherUserId) {
        if (typeof openUserProfile === 'function') {
            openUserProfile(currentChatUser.otherUserId);
        }
    }
}
    
    const chat = currentChatUser;
    const isChannel = chat.type === 'channel';
    const isGroup = chat.type === 'group';
    const membersCount = Object.keys(chat.subscribers || chat.members || {}).length;
    const isSubscribed = chat.subscribers ? chat.subscribers[currentUser.uid] : false;
    const isMember = chat.members ? chat.members[currentUser.uid] : false;
    
    const modalHtml = `
        <div id="simple-channel-profile" class="modal" style="z-index: 10001;">
            <div style="background: white; width: 90%; max-width: 400px; border-radius: 20px; overflow: hidden; margin: auto;">
                <div style="background: linear-gradient(135deg, #228B22, #556B2F); height: 100px; position: relative;">
                    <button onclick="closeSimpleChannelProfile()" style="position: absolute; top: 10px; right: 15px; background: rgba(0,0,0,0.5); color: white; border: none; width: 30px; height: 30px; border-radius: 50%; font-size: 18px; cursor: pointer;">✕</button>
                </div>
                <div style="text-align: center; margin-top: -40px;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--sage); margin: 0 auto; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 40px; ${chat.avatar ? `background-image: url(${chat.avatar}); background-size: cover;` : ''}">
                        ${chat.avatar ? '' : (isChannel ? '📢' : '👥')}
                    </div>
                </div>
                <div style="text-align: center; padding: 15px;">
                    <h2 style="font-size: 20px; margin: 0;">${escapeHtml(chat.name || (isChannel ? 'Канал' : 'Группа'))}</h2>
                    ${chat.kname ? `<div style="color: gray; font-size: 13px; margin-top: 5px;">@${escapeHtml(chat.kname)}</div>` : ''}
                    <div style="color: gray; font-size: 13px; margin-top: 5px;">👥 ${membersCount} ${isChannel ? 'подписчиков' : 'участников'}</div>
                    <p style="color: #666; font-size: 14px; margin-top: 10px;">${escapeHtml(chat.description || 'Нет описания')}</p>
                </div>
                <div style="padding: 15px; border-top: 1px solid #eee;">
                    <button id="simple-action-btn" style="width: 100%; padding: 12px; border: none; border-radius: 30px; background: ${isChannel ? (isSubscribed ? '#dc3545' : '#228B22') : (isMember ? '#dc3545' : '#228B22')}; color: white; font-size: 16px; cursor: pointer;">
                        ${isChannel ? (isSubscribed ? 'Отписаться' : 'Подписаться') : (isMember ? 'Покинуть' : 'Вступить')}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const old = document.getElementById('simple-channel-profile');
    if (old) old.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('simple-channel-profile');
    modal.classList.remove('hidden');
    
    const actionBtn = document.getElementById('simple-action-btn');
    if (actionBtn) {
        actionBtn.onclick = () => {
            if (isChannel) {
                const ref = database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid);
                if (isSubscribed) {
                    ref.remove().then(() => {
                        database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove();
                        showNotification('Отписались', 'info');
                        closeSimpleChannelProfile();
                        loadChats();
                        if (currentChatId === currentChatId) closeChat();
                    });
                } else {
                    ref.set(true).then(() => {
                        database.ref('userChats/' + currentUser.uid + '/' + currentChatId).set(true);
                        showNotification('Подписались!', 'success');
                        closeSimpleChannelProfile();
                    });
                }
            } else {
                const ref = database.ref('chats/' + currentChatId + '/members/' + currentUser.uid);
                if (isMember) {
                    ref.remove().then(() => {
                        database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove();
                        showNotification('Покинули группу', 'info');
                        closeSimpleChannelProfile();
                        closeChat();
                        loadChats();
                    });
                } else {
                    ref.set(true).then(() => {
                        database.ref('userChats/' + currentUser.uid + '/' + currentChatId).set(true);
                        showNotification('Вступили в группу!', 'success');
                        closeSimpleChannelProfile();
                    });
                }
            }
        };
    }
}

function closeSimpleChannelProfile() {
    const modal = document.getElementById('simple-channel-profile');
    if (modal) modal.remove();
}

// ========== ПОИСК ==========
function searchGlobalNew() {
    const query = document.getElementById('global-search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('global-search-results');
    const resultsList = document.getElementById('search-results-list');
    
    if (!query) {
        resultsContainer.style.display = 'none';
        return;
    }
    
    resultsContainer.style.display = 'flex';
    resultsList.innerHTML = '<div class="loading-spinner">🔍 Поиск...</div>';
    
    Promise.all([searchUsersGlobal(query), searchChatsGlobal(query)]).then(([users, chats]) => {
        renderSearchResults(users, chats);
    });
}

async function searchUsersGlobal(query) {
    const snapshot = await database.ref('users').once('value');
    const users = snapshot.val();
    const results = [];
    
    for (let uid in users) {
        if (uid === currentUser.uid) continue;
        const user = users[uid];
        const username = (user.username || '').toLowerCase();
        const userTag = (user.userTag || '').toLowerCase();
        
        if (username.includes(query) || userTag.includes(query.replace('@', ''))) {
            results.push({ type: 'user', uid, ...user });
        }
    }
    return results.slice(0, 20);
}

async function searchChatsGlobal(query) {
    const userChats = await database.ref('userChats/' + currentUser.uid).once('value');
    const chatIds = Object.keys(userChats.val() || {});
    const results = [];
    
    for (let chatId of chatIds) {
        const chat = await database.ref('chats/' + chatId).once('value');
        const chatData = chat.val();
        if (!chatData) continue;
        
        let name = '';
        if (chatData.type === 'group') name = (chatData.name || '').toLowerCase();
        else if (chatData.type === 'channel') name = (chatData.name || '').toLowerCase();
        else {
            const otherId = chatData.participants?.find(id => id !== currentUser.uid);
            if (otherId) {
                const otherUser = await database.ref('users/' + otherId).once('value');
                name = (otherUser.val()?.username || '').toLowerCase();
            }
        }
        
        if (name.includes(query)) {
            results.push({ type: 'chat', chatId, data: chatData });
        }
    }
    return results.slice(0, 20);
}

function renderSearchResults(users, chats) {
    const container = document.getElementById('search-results-list');
    container.innerHTML = '';
    
    if (!users.length && !chats.length) {
        container.innerHTML = '<div class="empty-search">Ничего не найдено</div>';
        return;
    }
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="search-result-avatar" style="background-image: url(${user.avatar || ''}); background-size: cover;">${!user.avatar ? '👤' : ''}</div>
            <div class="search-result-info">
                <div class="search-result-name">${escapeHtml(user.username)}</div>
                <div class="search-result-username">${user.userTag ? '@' + user.userTag : '@' + user.username.toLowerCase().replace(/\s/g, '')}</div>
            </div>
            <div class="search-result-badge">👤 Пользователь</div>
        `;
        div.onclick = () => startPrivateChat(user.uid, user);
        container.appendChild(div);
    });
    
    chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        let name = '', avatar = '', type = '';
        if (chat.data.type === 'group') {
            name = chat.data.name;
            avatar = chat.data.avatar;
            type = '👥 Группа';
        } else if (chat.data.type === 'channel') {
            name = chat.data.name;
            avatar = chat.data.avatar;
            type = '📢 Канал';
        } else {
            name = 'Личный чат';
            type = '💬 Чат';
        }
        div.innerHTML = `
            <div class="search-result-avatar" style="background-image: url(${avatar || ''}); background-size: cover;">${!avatar ? (chat.data.type === 'group' ? '👥' : '📢') : ''}</div>
            <div class="search-result-info">
                <div class="search-result-name">${escapeHtml(name)}</div>
            </div>
            <div class="search-result-badge">${type}</div>
        `;
        div.onclick = () => openChat(chat.chatId, chat.data);
        container.appendChild(div);
    });
}

function closeSearchResults() {
    document.getElementById('global-search-results').style.display = 'none';
    document.getElementById('global-search-input').value = '';
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
    document.getElementById('create-menu-modal').classList.remove('hidden');
}

function closeCreateMenu() {
    document.getElementById('create-menu-modal').classList.add('hidden');
}

function openNewChatFromMenu() {
    closeCreateMenu();
    showNewChatDialog();
}

function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    loadContacts();
}

function closeNewChatDialog() { 
    document.getElementById('new-chat-modal').classList.add('hidden'); 
}

function loadContacts() {
    var list = document.getElementById('users-list');
    list.innerHTML = '<div class="loading-spinner">🔄 Загрузка...</div>';
    
    database.ref('contacts/' + currentUser.uid).once('value').then(function(snapshot) {
        var contacts = snapshot.val();
        if (!contacts) { 
            list.innerHTML = '<div>Нет контактов. Добавьте через поиск</div>'; 
            return; 
        }
        var userIds = Object.keys(contacts);
        if (userIds.length === 0) { 
            list.innerHTML = '<div>Нет контактов</div>'; 
            return; 
        }
        
        list.innerHTML = '';
        userIds.forEach(function(uid) {
            database.ref('users/' + uid).once('value').then(function(userSnap) {
                var user = userSnap.val();
                if (!user) return;
                var div = document.createElement('div');
                div.className = 'user-item';
                var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                var avatarContent = user.avatar ? '' : '👤';
                div.innerHTML = '<div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><div class="user-item-info"><h4>'+escapeHtml(user.username)+'</h4></div>';
                div.onclick = (function(uid, user) { 
                    return function() { startPrivateChat(uid, user); }; 
                })(uid, user);
                list.appendChild(div);
            });
        });
    });
}

// Инициализация
initChatSounds();
// ========== КРАСИВЫЙ ПРОФИЛЬ КАНАЛА ==========
let currentChannelProfileId = null;
let currentChannelProfileData = null;

function openChannelProfile(chatId) {
    console.log('openChannelProfile вызван для:', chatId);
    currentChannelProfileId = chatId;
    
    database.ref('chats/' + chatId).once('value').then(snapshot => {
        const chat = snapshot.val();
        if (!chat || chat.type !== 'channel') {
            console.error('Это не канал или чат не найден');
            return;
        }
        currentChannelProfileData = chat;
        showBeautyChannelProfile(chat);
    });
}

function showBeautyChannelProfile(chat) {
    const membersCount = Object.keys(chat.subscribers || {}).length;
    const isSubscribed = chat.subscribers ? chat.subscribers[currentUser.uid] : false;
    const isAdmin = chat.admins ? chat.admins[currentUser.uid] : false;
    const isOwner = chat.createdBy === currentUser.uid;
    const isSuperAdmin = window.isSuperAdmin === true;
    const canEdit = isAdmin || isOwner || isSuperAdmin;
    const isVerified = chat.verified === true;
    
    const bannerStyle = chat.banner ? 
        (chat.banner.startsWith('#') ? `background: ${chat.banner};` : `background-image: url(${chat.banner}); background-size: cover; background-position: center;`) :
        'background: linear-gradient(135deg, #228B22, #556B2F);';
    
    const modalHtml = `
        <div id="beauty-channel-profile" class="modal" style="z-index: 10001;">
            <div style="background: white; width: 100%; max-width: 500px; border-radius: 24px; overflow: hidden; margin: auto; position: relative; max-height: 90vh; overflow-y: auto;">
                <!-- Баннер -->
                <div style="${bannerStyle} height: 140px; position: relative;">
                    ${canEdit ? `<button class="channel-banner-edit-btn" onclick="editChannelBanner()" style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px;">✏️</button>` : ''}
                    <button onclick="closeBeautyChannelProfile()" style="position: absolute; top: 10px; right: 15px; background: rgba(0,0,0,0.5); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 20px; cursor: pointer;">×</button>
                </div>
                
                <!-- Аватарка -->
                <div style="display: flex; justify-content: center; margin-top: -50px; position: relative; z-index: 2;">
                    <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--sage); border: 4px solid white; display: flex; align-items: center; justify-content: center; font-size: 50px; ${chat.avatar ? `background-image: url(${chat.avatar}); background-size: cover;` : ''}">
                        ${chat.avatar ? '' : '📢'}
                        ${canEdit ? `<button class="channel-avatar-edit-btn" onclick="editChannelAvatar()" style="position: absolute; bottom: 5px; right: 5px; background: var(--forest); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px;">✏️</button>` : ''}
                    </div>
                </div>
                
                <!-- Информация -->
                <div style="text-align: center; padding: 15px 20px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                        <h2 style="font-size: 22px; margin: 0;">${escapeHtml(chat.name || 'Канал')}</h2>
                        ${isVerified ? '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width: 20px; height: 20px;" onclick="showVerifiedInfo()">' : ''}
                        ${isSuperAdmin && !isVerified ? `<button onclick="toggleChannelVerification('${currentChannelProfileId}')" style="background:none; border:none; cursor:pointer; font-size:14px;">🔘 Выдать галочку</button>` : ''}
                    </div>
                    ${chat.kname ? `<div style="color: var(--text-muted); font-size: 14px; margin-top: 5px;">@${escapeHtml(chat.kname)}</div>` : ''}
                    <p style="color: var(--text-dark); font-size: 14px; margin-top: 10px;">${escapeHtml(chat.description || 'Нет описания')}</p>
                    
                    <div style="margin-top: 15px; padding: 10px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">
                        <div style="display: flex; gap: 15px; justify-content: center; align-items: center;">
                            <div style="text-align: center;">
                                <div style="font-size: 18px; font-weight: bold;" id="channel-members-count">${membersCount}</div>
                                <div style="font-size: 12px; color: var(--text-muted);">подписчиков</div>
                            </div>
                            <button id="channel-action-btn" style="padding: 8px 24px; border: none; border-radius: 30px; background: ${isSubscribed ? '#dc3545' : 'var(--forest)'}; color: white; font-size: 14px; cursor: pointer;">
                                ${isSubscribed ? 'Отписаться' : 'Подписаться'}
                            </button>
                            <button id="channel-notify-btn" onclick="toggleChannelNotification()" style="width: 40px; height: 40px; border-radius: 50%; border: none; background: var(--background); cursor: pointer; font-size: 20px;">
                                🔔
                            </button>
                        </div>
                    </div>
                    
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">
                        ${chat.isPublic ? '🌍 Публичный канал' : '🔒 Приватный канал'}
                        ${chat.category ? ` • ${getCategoryName(chat.category)}` : ''}
                    </div>
                </div>
                
                <!-- Вкладки -->
                <div style="display: flex; border-top: 1px solid var(--border); background: white;">
                    <button class="channel-tab-btn active" data-tab="posts" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">📷 Посты и репосты</button>
                    <button class="channel-tab-btn" data-tab="info" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">ℹ️ Информация</button>
                    ${canEdit ? `<button class="channel-tab-btn" data-tab="admin" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">⚙️ Управление</button>` : ''}
                </div>
                
                <!-- Контент -->
                <div id="channel-tab-content" style="padding: 15px; min-height: 300px; max-height: 400px; overflow-y: auto;">
                    <div class="profile-loading">Загрузка...</div>
                </div>
                
                <!-- Кнопка удаления для владельца -->
                ${isOwner || isSuperAdmin ? `
                <div style="padding: 15px; border-top: 1px solid var(--border);">
                    <button onclick="deleteChannel()" style="width: 100%; padding: 12px; background: #dc3545; color: white; border: none; border-radius: 12px; cursor: pointer;">🗑️ Удалить канал</button>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    const oldModal = document.getElementById('beauty-channel-profile');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('beauty-channel-profile');
    modal.classList.remove('hidden');
    
    // Обновляем количество подписчиков в реальном времени
    database.ref('chats/' + currentChannelProfileId + '/subscribers').on('value', (snap) => {
        const count = Object.keys(snap.val() || {}).length;
        const countEl = document.getElementById('channel-members-count');
        if (countEl) countEl.textContent = count;
    });
    
    // Обработчики вкладок
    document.querySelectorAll('.channel-tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.channel-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            if (tab === 'posts') loadChannelPostsTab();
            else if (tab === 'info') loadChannelInfoTab();
            else if (tab === 'admin') loadChannelAdminTab();
        };
    });
    
    // Кнопка подписки/отписки
    const actionBtn = document.getElementById('channel-action-btn');
    if (actionBtn) {
        actionBtn.onclick = () => handleChannelSubscribe();
    }
    
    // Загружаем посты по умолчанию
    loadChannelPostsTab();
}

function getCategoryName(category) {
    const categories = {
        food: '🍔 Еда', sport: '🏀 Спорт', health: '🥬 Польза',
        games: '🎮 Игры', movies: '🎥 Кино', social: '📱 Соцсети',
        news: '📢 Новости', ai: '🔎 Нейросети', anime: '✨ Аниме',
        books: '📖 Книги', music: '🎵 Музыка', cars: '🚗 Машины',
        animals: '🐭 Животные'
    };
    return categories[category] || category;
}

function handleChannelSubscribe() {
    const isSubscribed = currentChannelProfileData.subscribers ? currentChannelProfileData.subscribers[currentUser.uid] : false;
    
    if (isSubscribed) {
        database.ref('chats/' + currentChannelProfileId + '/subscribers/' + currentUser.uid).remove()
            .then(() => database.ref('userChats/' + currentUser.uid + '/' + currentChannelProfileId).remove())
            .then(() => {
                showNotification('Вы отписались от канала', 'info');
                const btn = document.getElementById('channel-action-btn');
                if (btn) {
                    btn.textContent = 'Подписаться';
                    btn.style.background = 'var(--forest)';
                }
                currentChannelProfileData.subscribers[currentUser.uid] = false;
            });
    } else {
        database.ref('chats/' + currentChannelProfileId + '/subscribers/' + currentUser.uid).set(true)
            .then(() => database.ref('userChats/' + currentUser.uid + '/' + currentChannelProfileId).set(true))
            .then(() => {
                showNotification('Вы подписались на канал!', 'success');
                const btn = document.getElementById('channel-action-btn');
                if (btn) {
                    btn.textContent = 'Отписаться';
                    btn.style.background = '#dc3545';
                }
                currentChannelProfileData.subscribers[currentUser.uid] = true;
            });
    }
}

function toggleChannelNotification() {
    const ref = database.ref('channelNotifications/' + currentUser.uid + '/' + currentChannelProfileId);
    ref.once('value').then(snap => {
        if (snap.val()) {
            ref.remove();
            showNotification('Уведомления выключены', 'info');
            document.getElementById('channel-notify-btn').style.opacity = '0.5';
        } else {
            ref.set(true);
            showNotification('Уведомления включены', 'success');
            document.getElementById('channel-notify-btn').style.opacity = '1';
        }
    });
}

function loadChannelPostsTab() {
    const container = document.getElementById('channel-tab-content');
    if (!container) return;
    
    container.innerHTML = '<div class="profile-loading">Загрузка постов...</div>';
    
    database.ref('slices').orderByChild('channelId').equalTo(currentChannelProfileId).once('value', snapshot => {
        const slices = snapshot.val();
        container.innerHTML = '';
        
        if (!slices || Object.keys(slices).length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Нет постов</div>';
            return;
        }
        
        const posts = Object.entries(slices).map(([id, data]) => ({id, data}));
        posts.sort((a,b) => (b.data.createdAt||0) - (a.data.createdAt||0));
        
        posts.forEach(post => {
            container.appendChild(createChannelPostCard(post.id, post.data));
        });
    });
}

function createChannelPostCard(sliceId, sliceData) {
    const div = document.createElement('div');
    div.className = 'slice-card';
    div.style.marginBottom = '15px';
    div.style.borderRadius = '16px';
    div.style.overflow = 'hidden';
    div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    
    let mediaHtml = '';
    if (sliceData.mediaUrl) {
        mediaHtml = `<div><img src="${sliceData.mediaUrl}" style="width: 100%; max-height: 200px; object-fit: cover; cursor: pointer;" onclick="openSliceLightbox('${sliceData.mediaUrl}')"></div>`;
    } else if (sliceData.mediaUrls && sliceData.mediaUrls.length) {
        mediaHtml = `<div><img src="${sliceData.mediaUrls[0]}" style="width: 100%; max-height: 200px; object-fit: cover; cursor: pointer;" onclick="openSliceLightbox('${sliceData.mediaUrls[0]}')"></div>`;
    }
    
    const isRepost = sliceData.type === 'repost';
    const repostHtml = isRepost ? `<div style="font-size: 12px; color: var(--text-muted); padding: 8px 12px 0;">🔄 Репост с @${escapeHtml(sliceData.originalAuthorName)}</div>` : '';
    
    div.innerHTML = `
        ${repostHtml}
        <div style="padding: 12px;">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">${formatSliceDateNew(sliceData.createdAt)}</div>
            <div style="font-size: 14px; line-height: 1.4;">${escapeHtml(sliceData.text || '')}</div>
            ${mediaHtml}
            <div style="display: flex; gap: 15px; margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                <span>❤️ ${sliceData.likesCount || 0}</span>
                <span>💬 ${sliceData.commentsCount || 0}</span>
                <span>🔄 ${sliceData.repostsCount || 0}</span>
            </div>
        </div>
    `;
    return div;
}

function loadChannelInfoTab() {
    const container = document.getElementById('channel-tab-content');
    if (!container) return;
    
    const chat = currentChannelProfileData;
    const isAdmin = chat.admins ? chat.admins[currentUser.uid] : false;
    const isOwner = chat.createdBy === currentUser.uid;
    
    // Загружаем владельца
    database.ref('users/' + chat.createdBy).once('value', ownerSnap => {
        const owner = ownerSnap.val();
        
        // Загружаем администраторов
        const adminIds = Object.keys(chat.admins || {}).filter(id => id !== chat.createdBy);
        
        let adminsHtml = '';
        if (adminIds.length > 0) {
            adminsHtml = '<div style="margin-bottom: 15px;"><strong>👑 Администраторы</strong><div id="channel-admins-list" style="margin-top: 8px;"></div></div>';
        }
        
        container.innerHTML = `
            <div style="padding: 5px;">
                <div style="margin-bottom: 15px;">
                    <strong>📅 Дата создания</strong><br>
                    <span style="color: var(--text-muted);">${chat.createdAt ? new Date(chat.createdAt).toLocaleDateString() : 'Неизвестно'}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>👑 Владелец</strong><br>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px; cursor: pointer;" onclick="openUserProfile('${chat.createdBy}')">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; ${owner?.avatar ? `background-image: url(${owner.avatar}); background-size: cover;` : ''}">${!owner?.avatar ? '👤' : ''}</div>
                        <span>${owner ? escapeHtml(owner.username) : 'Неизвестен'}</span>
                    </div>
                </div>
                ${adminsHtml}
                <div style="margin-bottom: 15px;">
                    <strong>👥 Подписчики</strong>
                    <div id="channel-subscribers-list" style="margin-top: 8px; max-height: 250px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
        
        // Загружаем администраторов
        if (adminIds.length > 0) {
            const adminsContainer = document.getElementById('channel-admins-list');
            if (adminsContainer) {
                adminIds.forEach(uid => {
                    database.ref('users/' + uid).once('value', userSnap => {
                        const user = userSnap.val();
                        if (!user) return;
                        const div = document.createElement('div');
                        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border);';
                        div.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="openUserProfile('${uid}')">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; ${user.avatar ? `background-image: url(${user.avatar}); background-size: cover;` : ''}">${!user.avatar ? '👤' : ''}</div>
                                <span>${escapeHtml(user.username)}</span>
                            </div>
                            ${(isOwner || window.isSuperAdmin) && uid !== chat.createdBy ? `<button onclick="removeChannelAdmin('${uid}')" style="background: none; border: none; color: #dc3545; font-size: 18px; cursor: pointer;">✕</button>` : ''}
                        `;
                        adminsContainer.appendChild(div);
                    });
                });
            }
        }
        
        // Загружаем подписчиков
        const subscribers = chat.subscribers || {};
        const subscriberIds = Object.keys(subscribers);
        const subscribersContainer = document.getElementById('channel-subscribers-list');
        if (subscribersContainer) {
            if (subscriberIds.length === 0) {
                subscribersContainer.innerHTML = '<div style="color: var(--text-muted);">Нет подписчиков</div>';
            } else {
                subscriberIds.forEach(uid => {
                    database.ref('users/' + uid).once('value', userSnap => {
                        const user = userSnap.val();
                        if (!user) return;
                        const div = document.createElement('div');
                        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border);';
                        div.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="openUserProfile('${uid}')">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; ${user.avatar ? `background-image: url(${user.avatar}); background-size: cover;` : ''}">${!user.avatar ? '👤' : ''}</div>
                                <div>
                                    <div style="font-weight: 500;">${escapeHtml(user.username)}</div>
                                    <div style="font-size: 11px; color: var(--text-muted);">${user.userTag ? '@' + user.userTag : ''}</div>
                                </div>
                            </div>
                            ${(isAdmin || window.isSuperAdmin) && uid !== chat.createdBy ? `<button onclick="makeChannelAdmin('${uid}')" style="background: none; border: none; color: var(--forest); font-size: 14px; cursor: pointer;">👑 Назначить админом</button>` : ''}
                        `;
                        subscribersContainer.appendChild(div);
                    });
                });
            }
        }
    });
}

function loadChannelAdminTab() {
    const container = document.getElementById('channel-tab-content');
    if (!container) return;
    
    const chat = currentChannelProfileData;
    const isOwner = chat.createdBy === currentUser.uid;
    const isSuperAdmin = window.isSuperAdmin === true;
    
    container.innerHTML = `
        <div style="padding: 10px;">
            <div class="setting-item" onclick="editChannelInfo()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>✏️ Редактировать название и описание</span>
                <span>›</span>
            </div>
            <div class="setting-item" onclick="editChannelCategory()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>🏷️ Изменить тематику</span>
                <span>›</span>
            </div>
            <div class="setting-item" onclick="toggleChannelPrivacy()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>🔒 Сделать ${chat.isPublic ? 'приватным' : 'публичным'}</span>
                <span>›</span>
            </div>
            <div class="setting-item">
                <span>💬 Комментарии</span>
                <label class="switch">
                    <input type="checkbox" id="channel-comments-toggle" ${chat.commentsEnabled !== false ? 'checked' : ''} onchange="toggleChannelComments(this.checked)">
                    <span class="slider round"></span>
                </label>
            </div>
            <div class="setting-item" onclick="generateChannelInviteLink()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>🔗 Ссылка-приглашение</span>
                <span>›</span>
            </div>
            ${isOwner || isSuperAdmin ? `
            <div class="setting-item" onclick="transferChannelOwnership()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>📤 Передать права владельца</span>
                <span>›</span>
            </div>
            ` : ''}
        </div>
    `;
}

function editChannelInfo() {
    const newName = prompt('Новое название канала:', currentChannelProfileData.name);
    const newDesc = prompt('Новое описание:', currentChannelProfileData.description || '');
    if (newName && newName.trim()) {
        database.ref('chats/' + currentChannelProfileId).update({
            name: newName.trim(),
            description: newDesc?.trim() || ''
        }).then(() => {
            showNotification('Информация канала обновлена!', 'success');
            openChannelProfile(currentChannelProfileId);
        });
    }
}

function editChannelCategory() {
    const categories = ['food', 'sport', 'health', 'games', 'movies', 'social', 'news', 'ai', 'anime', 'books', 'music', 'cars', 'animals'];
    const catNames = { food: '🍔 Еда', sport: '🏀 Спорт', health: '🥬 Польза', games: '🎮 Игры', movies: '🎥 Кино', social: '📱 Соцсети', news: '📢 Новости', ai: '🔎 Нейросети', anime: '✨ Аниме', books: '📖 Книги', music: '🎵 Музыка', cars: '🚗 Машины', animals: '🐭 Животные' };
    
    let options = '';
    categories.forEach(c => { options += `<option value="${c}" ${currentChannelProfileData.category === c ? 'selected' : ''}>${catNames[c]}</option>`; });
    
    const selectHtml = `<select id="cat-select" style="padding: 10px; border-radius: 12px; border: 2px solid var(--border); width: 100%; margin-bottom: 15px;">${options}</select>`;
    const modalHtml = `
        <div id="temp-cat-modal" class="modal" style="z-index: 10002;">
            <div style="background: white; width: 300px; border-radius: 20px; padding: 20px; margin: auto;">
                <h3 style="margin: 0 0 15px 0;">Выберите тематику</h3>
                ${selectHtml}
                <button onclick="setChannelCategory()" class="btn-primary" style="width: 100%;">Сохранить</button>
                <button onclick="closeTempModal()" class="btn-secondary" style="width: 100%; margin-top: 10px;">Отмена</button>
            </div>
        </div>
    `;
    const old = document.getElementById('temp-cat-modal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('temp-cat-modal').classList.remove('hidden');
    
    window.setChannelCategory = function() {
        const newCat = document.getElementById('cat-select').value;
        database.ref('chats/' + currentChannelProfileId).update({ category: newCat }).then(() => {
            showNotification('Тематика обновлена!', 'success');
            closeTempModal();
            openChannelProfile(currentChannelProfileId);
        });
    };
}

function toggleChannelPrivacy() {
    const newPrivacy = !currentChannelProfileData.isPublic;
    database.ref('chats/' + currentChannelProfileId).update({ isPublic: newPrivacy }).then(() => {
        showNotification(newPrivacy ? 'Канал теперь публичный' : 'Канал теперь приватный', 'success');
        openChannelProfile(currentChannelProfileId);
    });
}

function toggleChannelComments(enabled) {
    database.ref('chats/' + currentChannelProfileId).update({ commentsEnabled: enabled }).then(() => {
        showNotification(enabled ? 'Комментарии включены' : 'Комментарии выключены', 'success');
    });
}

function generateChannelInviteLink() {
    const link = `${window.location.origin}${window.location.pathname}?joinChannel=${currentChannelProfileData.kname || currentChannelProfileId}`;
    const modalHtml = `
        <div id="invite-link-modal" class="modal" style="z-index: 10002;">
            <div style="background: white; width: 350px; border-radius: 20px; padding: 20px; margin: auto;">
                <h3 style="margin: 0 0 15px 0;">Ссылка-приглашение</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input type="text" value="${link}" readonly style="flex: 1; padding: 10px; border: 1px solid var(--border); border-radius: 10px;">
                    <button onclick="copyInviteLink('${link}')" style="padding: 10px 20px; background: var(--forest); color: white; border: none; border-radius: 10px; cursor: pointer;">Копировать</button>
                </div>
                <button onclick="closeTempModal()" class="btn-secondary" style="width: 100%;">Закрыть</button>
            </div>
        </div>
    `;
    const old = document.getElementById('invite-link-modal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('invite-link-modal').classList.remove('hidden');
}

function copyInviteLink(link) {
    navigator.clipboard.writeText(link);
    showNotification('Ссылка скопирована!', 'success');
}

function transferChannelOwnership() {
    const subscribers = currentChannelProfileData.subscribers || {};
    const subscriberIds = Object.keys(subscribers).filter(id => id !== currentUser.uid);
    
    if (subscriberIds.length === 0) {
        showNotification('Нет подписчиков для передачи прав', 'error');
        return;
    }
    
    let options = '';
    subscriberIds.forEach(uid => {
        database.ref('users/' + uid).once('value', userSnap => {
            const user = userSnap.val();
            if (user) {
                options += `<option value="${uid}">${escapeHtml(user.username)}</option>`;
            }
        });
    });
    
    setTimeout(() => {
        const modalHtml = `
            <div id="transfer-modal" class="modal" style="z-index: 10002;">
                <div style="background: white; width: 350px; border-radius: 20px; padding: 20px; margin: auto;">
                    <h3 style="margin: 0 0 15px 0;">Передать права владельца</h3>
                    <select id="new-owner-select" style="width: 100%; padding: 10px; border-radius: 10px; border: 1px solid var(--border); margin-bottom: 15px;">
                        ${options}
                    </select>
                    <button onclick="confirmTransferOwnership()" class="btn-primary" style="width: 100%;">Передать</button>
                    <button onclick="closeTempModal()" class="btn-secondary" style="width: 100%; margin-top: 10px;">Отмена</button>
                </div>
            </div>
        `;
        const old = document.getElementById('transfer-modal');
        if (old) old.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('transfer-modal').classList.remove('hidden');
        
        window.confirmTransferOwnership = function() {
            const newOwnerId = document.getElementById('new-owner-select').value;
            database.ref('chats/' + currentChannelProfileId).update({
                createdBy: newOwnerId,
                ['admins/' + newOwnerId]: true,
                ['admins/' + currentUser.uid]: null
            }).then(() => {
                showNotification('Права владельца переданы!', 'success');
                closeTempModal();
                openChannelProfile(currentChannelProfileId);
            });
        };
    }, 500);
}

function removeChannelAdmin(uid) {
    if (!confirm('Снять права администратора?')) return;
    database.ref('chats/' + currentChannelProfileId + '/admins/' + uid).remove().then(() => {
        showNotification('Администратор снят', 'info');
        loadChannelInfoTab();
    });
}

function makeChannelAdmin(uid) {
    database.ref('chats/' + currentChannelProfileId + '/admins/' + uid).set(true).then(() => {
        showNotification('Администратор назначен', 'success');
        loadChannelInfoTab();
    });
}

function editChannelBanner() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка баннера...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + currentChannelProfileId).update({ banner: url });
            showNotification('Баннер обновлён!', 'success');
            openChannelProfile(currentChannelProfileId);
        } catch(err) {
            showNotification('Ошибка загрузки', 'error');
        }
    };
    input.click();
}

function editChannelAvatar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка аватара...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + currentChannelProfileId).update({ avatar: url });
            showNotification('Аватар обновлён!', 'success');
            openChannelProfile(currentChannelProfileId);
        } catch(err) {
            showNotification('Ошибка загрузки', 'error');
        }
    };
    input.click();
}

function deleteChannel() {
    if (!confirm('Удалить канал навсегда? Это действие необратимо!')) return;
    database.ref('chats/' + currentChannelProfileId).remove().then(() => {
        database.ref('messages/' + currentChannelProfileId).remove();
        showNotification('Канал удалён', 'info');
        closeBeautyChannelProfile();
        closeChat();
        loadChats();
    });
}

function toggleChannelVerification(chatId) {
    if (!window.isSuperAdmin) return;
    const newValue = !currentChannelProfileData.verified;
    database.ref('chats/' + chatId + '/verified').set(newValue).then(() => {
        showNotification(newValue ? 'Канал верифицирован' : 'Верификация снята', 'success');
        openChannelProfile(chatId);
    });
}

function closeBeautyChannelProfile() {
    const modal = document.getElementById('beauty-channel-profile');
    if (modal) modal.remove();
    if (currentChannelProfileId) {
        database.ref('chats/' + currentChannelProfileId + '/subscribers').off();
    }
    currentChannelProfileId = null;
    currentChannelProfileData = null;
}

function closeTempModal() {
    const modals = ['temp-cat-modal', 'invite-link-modal', 'transfer-modal'];
    modals.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.remove();
    });
}

function formatSliceDateNew(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' мин назад';
    if (diff < 86400) return 'сегодня';
    return date.toLocaleDateString('ru-RU');
}

// ========== ПЕРЕХВАТ ПРИГЛАШЕНИЙ ==========
function checkChannelInvite() {
    const urlParams = new URLSearchParams(window.location.search);
    const joinChannelId = urlParams.get('joinChannel');
    if (joinChannelId && currentUser) {
        database.ref('chats').orderByChild('kname').equalTo(joinChannelId).once('value', snapshot => {
            let channelId = null;
            snapshot.forEach(child => {
                if (child.val().type === 'channel') channelId = child.key;
            });
            if (!channelId) channelId = joinChannelId;
            
            database.ref('chats/' + channelId).once('value', async snap => {
                const channel = snap.val();
                if (channel && channel.type === 'channel') {
                    showNotification('Вас пригласили в канал!', 'info');
                    openChannelProfile(channelId);
                }
            });
        });
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

setTimeout(checkChannelInvite, 1500);

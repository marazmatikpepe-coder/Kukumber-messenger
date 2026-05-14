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

// KUKUMBER MESSENGER - CHAT.JS (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ)

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
    
    // ЛИЧНЫЙ ЧАТ
    if (currentChatUser.type === 'private' && currentChatUser.otherUserId) {
        if (typeof openUserProfile === 'function') {
            openUserProfile(currentChatUser.otherUserId);
        } else {
            showNotification('Функция профиля не загружена', 'error');
        }
        return;
    }
    
    // КАНАЛ
    if (currentChatUser.type === 'channel') {
        // Загружаем свежие данные канала
        database.ref('chats/' + currentChatId).once('value').then(snapshot => {
            const chat = snapshot.val();
            if (!chat) {
                showNotification('Канал не найден', 'error');
                return;
            }
            
            const membersCount = Object.keys(chat.subscribers || {}).length;
            const isSubscribed = chat.subscribers && chat.subscribers[currentUser.uid];
            const isAdmin = chat.admins && chat.admins[currentUser.uid];
            const isOwner = chat.createdBy === currentUser.uid;
            const isSuperAdmin = window.isSuperAdmin === true;
            const canEdit = isAdmin || isOwner || isSuperAdmin;
            const isVerified = chat.verified === true;
            
            const bannerStyle = chat.banner ? 
                (chat.banner.startsWith('#') ? `background: ${chat.banner};` : `background-image: url(${chat.banner}); background-size: cover; background-position: center;`) :
                'background: linear-gradient(135deg, #228B22, #556B2F);';
            
            const modalHtml = `
                <div id="beauty-channel-profile-modal" class="modal" style="z-index: 10001;">
                    <div style="background: white; width: 100%; max-width: 550px; border-radius: 24px; overflow: hidden; margin: auto; position: relative; max-height: 90vh; overflow-y: auto;">
                        <!-- Баннер -->
                        <div style="${bannerStyle} height: 140px; position: relative;">
                            ${canEdit ? `<button class="channel-banner-edit" onclick="editChannelBannerUI('${currentChatId}')" style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px;">✏️</button>` : ''}
                            <button onclick="closeBeautyChannelProfileModal()" style="position: absolute; top: 10px; right: 15px; background: rgba(0,0,0,0.5); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 20px; cursor: pointer;">×</button>
                        </div>
                        
                        <!-- Аватарка -->
                        <div style="display: flex; justify-content: center; margin-top: -50px; position: relative; z-index: 2;">
                            <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--sage); border: 4px solid white; display: flex; align-items: center; justify-content: center; font-size: 50px; ${chat.avatar ? `background-image: url(${chat.avatar}); background-size: cover;` : ''}">
                                ${chat.avatar ? '' : '📢'}
                                ${canEdit ? `<button class="channel-avatar-edit" onclick="editChannelAvatarUI('${currentChatId}')" style="position: absolute; bottom: 5px; right: 5px; background: var(--forest); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px;">✏️</button>` : ''}
                            </div>
                        </div>
                        
                        <!-- Информация -->
                        <div style="text-align: center; padding: 15px 20px;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                                <h2 style="font-size: 22px; margin: 0;">${escapeHtml(chat.name || 'Канал')}</h2>
                                ${isVerified ? '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width: 20px; height: 20px; cursor: pointer;" onclick="showVerifiedInfo()">' : ''}
                                ${isSuperAdmin && !isVerified ? `<button onclick="toggleChannelVerificationUI('${currentChatId}')" style="background:none; border:none; cursor:pointer; font-size:12px; color:var(--forest);">🔘 Выдать галочку</button>` : ''}
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
                                    <button id="channel-notify-btn" onclick="toggleChannelNotificationUI('${currentChatId}')" style="width: 40px; height: 40px; border-radius: 50%; border: none; background: var(--background); cursor: pointer; font-size: 20px;">
                                        🔔
                                    </button>
                                </div>
                            </div>
                            
                            <div style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">
                                ${chat.isPublic ? '🌍 Публичный канал' : '🔒 Приватный канал'}
                                ${chat.category ? ` • ${getCategoryNameUI(chat.category)}` : ''}
                            </div>
                        </div>
                        
                        <!-- Вкладки -->
                        <div style="display: flex; border-top: 1px solid var(--border); background: white;">
                            <button class="channel-tab-btn-ui active" data-tab="posts" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">📷 Посты и репосты</button>
                            <button class="channel-tab-btn-ui" data-tab="info" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">ℹ️ Информация</button>
                            ${canEdit ? `<button class="channel-tab-btn-ui" data-tab="admin" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">⚙️ Управление</button>` : ''}
                        </div>
                        
                        <!-- Контент -->
                        <div id="channel-tab-content-ui" style="padding: 15px; min-height: 300px; max-height: 400px; overflow-y: auto;">
                            <div class="profile-loading">Загрузка...</div>
                        </div>
                        
                        <!-- Кнопка удаления для владельца -->
                        ${isOwner || isSuperAdmin ? `
                        <div style="padding: 15px; border-top: 1px solid var(--border);">
                            <button onclick="deleteChannelUI('${currentChatId}')" style="width: 100%; padding: 12px; background: #dc3545; color: white; border: none; border-radius: 12px; cursor: pointer;">🗑️ Удалить канал</button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            const oldModal = document.getElementById('beauty-channel-profile-modal');
            if (oldModal) oldModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = document.getElementById('beauty-channel-profile-modal');
            modal.classList.remove('hidden');
            
            window.currentChannelProfileId = currentChatId;
            window.currentChannelProfileData = chat;
            
            database.ref('chats/' + currentChatId + '/subscribers').on('value', (snap) => {
                const count = Object.keys(snap.val() || {}).length;
                const countEl = document.getElementById('channel-members-count');
                if (countEl) countEl.textContent = count;
            });
            
            document.querySelectorAll('.channel-tab-btn-ui').forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.channel-tab-btn-ui').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const tab = btn.dataset.tab;
                    if (tab === 'posts') loadChannelPostsTabUI(currentChatId);
                    else if (tab === 'info') loadChannelInfoTabUI(currentChatId);
                    else if (tab === 'admin') loadChannelAdminTabUI(currentChatId);
                };
            });
            
            const actionBtn = document.getElementById('channel-action-btn');
            if (actionBtn) {
                actionBtn.onclick = () => handleChannelSubscribeUI(currentChatId);
            }
            
            loadChannelPostsTabUI(currentChatId);
            
        }).catch(err => {
            console.error('Ошибка:', err);
            showNotification('Ошибка загрузки профиля', 'error');
        });
        return;
    }
    
    // ГРУППА
    if (currentChatUser.type === 'group') {
        console.log('Открываем профиль ГРУППЫ');
        if (typeof openGroupProfile === 'function') {
            openGroupProfile(currentChatId);
        } else {
            showNotification('Функция профиля группы не загружена, обновите страницу', 'error');
        }
        return;
    }
    
    showNotification('Неизвестный тип чата', 'error');
}
// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПРОФИЛЯ КАНАЛА ==========

function getCategoryNameUI(category) {
    const categories = {
        food: '🍔 Еда', sport: '🏀 Спорт', health: '🥬 Польза',
        games: '🎮 Игры', movies: '🎥 Кино', social: '📱 Соцсети',
        news: '📢 Новости', ai: '🔎 Нейросети', anime: '✨ Аниме',
        books: '📖 Книги', music: '🎵 Музыка', cars: '🚗 Машины',
        animals: '🐭 Животные'
    };
    return categories[category] || category;
}

function closeBeautyChannelProfileModal() {
    const modal = document.getElementById('beauty-channel-profile-modal');
    if (modal) modal.remove();
    if (window.currentChannelProfileId) {
        database.ref('chats/' + window.currentChannelProfileId + '/subscribers').off();
    }
    window.currentChannelProfileId = null;
    window.currentChannelProfileData = null;
}

function handleChannelSubscribeUI(chatId) {
    database.ref('chats/' + chatId).once('value').then(snapshot => {
        const chat = snapshot.val();
        const isSubscribed = chat.subscribers && chat.subscribers[currentUser.uid];
        
        if (isSubscribed) {
            database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).remove()
                .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).remove())
                .then(() => {
                    showNotification('Вы отписались от канала', 'info');
                    const btn = document.getElementById('channel-action-btn');
                    if (btn) {
                        btn.textContent = 'Подписаться';
                        btn.style.background = 'var(--forest)';
                    }
                });
        } else {
            database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true)
                .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true))
                .then(() => {
                    showNotification('Вы подписались на канал!', 'success');
                    const btn = document.getElementById('channel-action-btn');
                    if (btn) {
                        btn.textContent = 'Отписаться';
                        btn.style.background = '#dc3545';
                    }
                });
        }
    });
}

function toggleChannelNotificationUI(chatId) {
    const ref = database.ref('channelNotifications/' + currentUser.uid + '/' + chatId);
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

function loadChannelPostsTabUI(chatId) {
    const container = document.getElementById('channel-tab-content-ui');
    if (!container) return;
    
    container.innerHTML = '<div class="profile-loading">Загрузка постов...</div>';
    
    database.ref('slices').orderByChild('channelId').equalTo(chatId).once('value', snapshot => {
        const slices = snapshot.val();
        container.innerHTML = '';
        
        if (!slices || Object.keys(slices).length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Нет постов</div>';
            return;
        }
        
        const posts = Object.entries(slices).map(([id, data]) => ({id, data}));
        posts.sort((a,b) => (b.data.createdAt||0) - (a.data.createdAt||0));
        
        posts.forEach(post => {
            const div = document.createElement('div');
            div.className = 'slice-card';
            div.style.marginBottom = '15px';
            div.style.borderRadius = '16px';
            div.style.overflow = 'hidden';
            div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            let mediaHtml = '';
            if (post.data.mediaUrl) {
                mediaHtml = `<div><img src="${post.data.mediaUrl}" style="width: 100%; max-height: 200px; object-fit: cover; cursor: pointer;" onclick="openSliceLightbox('${post.data.mediaUrl}')"></div>`;
            }
            
            const isRepost = post.data.type === 'repost';
            const repostHtml = isRepost ? `<div style="font-size: 12px; color: var(--text-muted); padding: 8px 12px 0;">🔄 Репост с @${escapeHtml(post.data.originalAuthorName)}</div>` : '';
            
            div.innerHTML = `
                ${repostHtml}
                <div style="padding: 12px;">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">${formatSliceDateUI(post.data.createdAt)}</div>
                    <div style="font-size: 14px; line-height: 1.4;">${escapeHtml(post.data.text || '')}</div>
                    ${mediaHtml}
                    <div style="display: flex; gap: 15px; margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                        <span>❤️ ${post.data.likesCount || 0}</span>
                        <span>💬 ${post.data.commentsCount || 0}</span>
                        <span>🔄 ${post.data.repostsCount || 0}</span>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

function loadChannelInfoTabUI(chatId) {
    const container = document.getElementById('channel-tab-content-ui');
    if (!container) return;
    
    database.ref('chats/' + chatId).once('value', async (snapshot) => {
        const chat = snapshot.val();
        if (!chat) return;
        
        const isOwner = chat.createdBy === currentUser.uid;
        const isSuperAdmin = window.isSuperAdmin === true;
        
        // Загружаем владельца
        const ownerSnap = await database.ref('users/' + chat.createdBy).once('value');
        const owner = ownerSnap.val();
        
        // Загружаем администраторов
        const adminIds = Object.keys(chat.admins || {}).filter(id => id !== chat.createdBy);
        
        let adminsHtml = '<div id="channel-admins-list-ui"></div>';
        
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
                <div style="margin-bottom: 15px;">
                    <strong>👑 Администраторы</strong>
                    ${adminsHtml}
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>👥 Подписчики</strong>
                    <div id="channel-subscribers-list-ui" style="margin-top: 8px; max-height: 250px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
        
        // Загружаем администраторов
        const adminsContainer = document.getElementById('channel-admins-list-ui');
        if (adminsContainer && adminIds.length > 0) {
            adminsContainer.innerHTML = '';
            for (const uid of adminIds) {
                const userSnap = await database.ref('users/' + uid).once('value');
                const user = userSnap.val();
                if (!user) continue;
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
                    ${(isOwner || isSuperAdmin) && uid !== chat.createdBy ? `<button onclick="removeChannelAdminUI('${chatId}', '${uid}')" style="background: none; border: none; color: #dc3545; font-size: 18px; cursor: pointer;">✕</button>` : ''}
                `;
                adminsContainer.appendChild(div);
            }
        } else if (adminsContainer) {
            adminsContainer.innerHTML = '<div style="color: var(--text-muted);">Нет администраторов</div>';
        }
        
        // Загружаем подписчиков
        const subscribers = chat.subscribers || {};
        const subscriberIds = Object.keys(subscribers);
        const subscribersContainer = document.getElementById('channel-subscribers-list-ui');
        if (subscribersContainer) {
            if (subscriberIds.length === 0) {
                subscribersContainer.innerHTML = '<div style="color: var(--text-muted);">Нет подписчиков</div>';
            } else {
                subscribersContainer.innerHTML = '';
                for (const uid of subscriberIds) {
                    const userSnap = await database.ref('users/' + uid).once('value');
                    const user = userSnap.val();
                    if (!user) continue;
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
                        ${(isOwner || isSuperAdmin) && uid !== chat.createdBy ? `<button onclick="makeChannelAdminUI('${chatId}', '${uid}')" style="background: none; border: none; color: var(--forest); font-size: 14px; cursor: pointer;">👑 Назначить админом</button>` : ''}
                    `;
                    subscribersContainer.appendChild(div);
                }
            }
        }
    });
}

function loadChannelAdminTabUI(chatId) {
    const container = document.getElementById('channel-tab-content-ui');
    if (!container) return;
    
    database.ref('chats/' + chatId).once('value', snapshot => {
        const chat = snapshot.val();
        
        container.innerHTML = `
            <div style="padding: 10px;">
                <div class="setting-item" onclick="editChannelInfoUI('${chatId}')" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                    <span>✏️ Редактировать название и описание</span>
                    <span>›</span>
                </div>
                <div class="setting-item" onclick="editChannelCategoryUI('${chatId}')" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                    <span>🏷️ Изменить тематику</span>
                    <span>›</span>
                </div>
                <div class="setting-item" onclick="toggleChannelPrivacyUI('${chatId}')" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                    <span>🔒 Сделать ${chat.isPublic ? 'приватным' : 'публичным'}</span>
                    <span>›</span>
                </div>
                <div class="setting-item">
                    <span>💬 Комментарии</span>
                    <label class="switch">
                        <input type="checkbox" id="channel-comments-toggle-ui" ${chat.commentsEnabled !== false ? 'checked' : ''} onchange="toggleChannelCommentsUI('${chatId}', this.checked)">
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="setting-item" onclick="generateChannelInviteLinkUI('${chatId}')" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                    <span>🔗 Ссылка-приглашение</span>
                    <span>›</span>
                </div>
                <div class="setting-item" onclick="transferChannelOwnershipUI('${chatId}')" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                    <span>📤 Передать права владельца</span>
                    <span>›</span>
                </div>
            </div>
        `;
    });
}

function editChannelInfoUI(chatId) {
    database.ref('chats/' + chatId).once('value', snapshot => {
        const chat = snapshot.val();
        const newName = prompt('Новое название канала:', chat.name);
        const newDesc = prompt('Новое описание:', chat.description || '');
        if (newName && newName.trim()) {
            database.ref('chats/' + chatId).update({
                name: newName.trim(),
                description: newDesc?.trim() || ''
            }).then(() => {
                showNotification('Информация канала обновлена!', 'success');
                closeBeautyChannelProfileModal();
                setTimeout(() => openChannelOrGroupProfile(), 300);
            });
        }
    });
}

function editChannelCategoryUI(chatId) {
    const categories = ['food', 'sport', 'health', 'games', 'movies', 'social', 'news', 'ai', 'anime', 'books', 'music', 'cars', 'animals'];
    const catNames = { food: '🍔 Еда', sport: '🏀 Спорт', health: '🥬 Польза', games: '🎮 Игры', movies: '🎥 Кино', social: '📱 Соцсети', news: '📢 Новости', ai: '🔎 Нейросети', anime: '✨ Аниме', books: '📖 Книги', music: '🎵 Музыка', cars: '🚗 Машины', animals: '🐭 Животные' };
    
    let options = '';
    categories.forEach(c => { options += `<option value="${c}">${catNames[c]}</option>`; });
    
    const newCat = prompt('Выберите тематику (введите значение):\n' + categories.map(c => catNames[c]).join('\n'));
    if (newCat) {
        const found = categories.find(c => catNames[c].toLowerCase().includes(newCat.toLowerCase()) || c === newCat);
        if (found) {
            database.ref('chats/' + chatId).update({ category: found }).then(() => {
                showNotification('Тематика обновлена!', 'success');
                closeBeautyChannelProfileModal();
                setTimeout(() => openChannelOrGroupProfile(), 300);
            });
        }
    }
}

function toggleChannelPrivacyUI(chatId) {
    database.ref('chats/' + chatId).once('value', snapshot => {
        const chat = snapshot.val();
        const newPrivacy = !chat.isPublic;
        database.ref('chats/' + chatId).update({ isPublic: newPrivacy }).then(() => {
            showNotification(newPrivacy ? 'Канал теперь публичный' : 'Канал теперь приватный', 'success');
            closeBeautyChannelProfileModal();
            setTimeout(() => openChannelOrGroupProfile(), 300);
        });
    });
}

function toggleChannelCommentsUI(chatId, enabled) {
    database.ref('chats/' + chatId).update({ commentsEnabled: enabled }).then(() => {
        showNotification(enabled ? 'Комментарии включены' : 'Комментарии выключены', 'success');
    });
}

function generateChannelInviteLinkUI(chatId) {
    database.ref('chats/' + chatId).once('value', snapshot => {
        const chat = snapshot.val();
        const link = `${window.location.origin}${window.location.pathname}?joinChannel=${chat.kname || chatId}`;
        
        const modalHtml = `
            <div id="invite-link-modal-ui" class="modal" style="z-index: 10002;">
                <div style="background: white; width: 350px; border-radius: 20px; padding: 20px; margin: auto;">
                    <h3 style="margin: 0 0 15px 0;">Ссылка-приглашение</h3>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <input type="text" value="${link}" readonly style="flex: 1; padding: 10px; border: 1px solid var(--border); border-radius: 10px;">
                        <button onclick="copyInviteLinkUI('${link}')" style="padding: 10px 20px; background: var(--forest); color: white; border: none; border-radius: 10px; cursor: pointer;">Копировать</button>
                    </div>
                    <button onclick="closeInviteModalUI()" class="btn-secondary" style="width: 100%;">Закрыть</button>
                </div>
            </div>
        `;
        const old = document.getElementById('invite-link-modal-ui');
        if (old) old.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('invite-link-modal-ui').classList.remove('hidden');
    });
}

function copyInviteLinkUI(link) {
    navigator.clipboard.writeText(link);
    showNotification('Ссылка скопирована!', 'success');
}

function closeInviteModalUI() {
    const modal = document.getElementById('invite-link-modal-ui');
    if (modal) modal.remove();
}

function transferChannelOwnershipUI(chatId) {
    database.ref('chats/' + chatId).once('value', async snapshot => {
        const chat = snapshot.val();
        const subscribers = chat.subscribers || {};
        const subscriberIds = Object.keys(subscribers).filter(id => id !== currentUser.uid);
        
        if (subscriberIds.length === 0) {
            showNotification('Нет подписчиков для передачи прав', 'error');
            return;
        }
        
        // Создаем простой список для выбора
        let userList = '';
        for (const uid of subscriberIds) {
            const userSnap = await database.ref('users/' + uid).once('value');
            const user = userSnap.val();
            if (user) {
                userList += `${uid}|${escapeHtml(user.username)}\n`;
            }
        }
        
        const newOwnerId = prompt('Введите ID пользователя для передачи прав:\n\n' + userList);
        if (newOwnerId && subscriberIds.includes(newOwnerId)) {
            database.ref('chats/' + chatId).update({
                createdBy: newOwnerId,
                ['admins/' + newOwnerId]: true,
                ['admins/' + currentUser.uid]: null
            }).then(() => {
                showNotification('Права владельца переданы!', 'success');
                closeBeautyChannelProfileModal();
                setTimeout(() => openChannelOrGroupProfile(), 300);
            });
        } else {
            showNotification('Пользователь не найден в подписчиках', 'error');
        }
    });
}

function removeChannelAdminUI(chatId, uid) {
    if (!confirm('Снять права администратора?')) return;
    database.ref('chats/' + chatId + '/admins/' + uid).remove().then(() => {
        showNotification('Администратор снят', 'info');
        loadChannelInfoTabUI(chatId);
    });
}

function makeChannelAdminUI(chatId, uid) {
    database.ref('chats/' + chatId + '/admins/' + uid).set(true).then(() => {
        showNotification('Администратор назначен', 'success');
        loadChannelInfoTabUI(chatId);
    });
}

function editChannelBannerUI(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка баннера...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + chatId).update({ banner: url });
            showNotification('Баннер обновлён!', 'success');
            closeBeautyChannelProfileModal();
            setTimeout(() => openChannelOrGroupProfile(), 300);
        } catch(err) {
            showNotification('Ошибка загрузки', 'error');
        }
    };
    input.click();
}

function editChannelAvatarUI(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка аватара...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + chatId).update({ avatar: url });
            showNotification('Аватар обновлён!', 'success');
            closeBeautyChannelProfileModal();
            setTimeout(() => openChannelOrGroupProfile(), 300);
        } catch(err) {
            showNotification('Ошибка загрузки', 'error');
        }
    };
    input.click();
}

function deleteChannelUI(chatId) {
    if (!confirm('Удалить канал навсегда? Это действие необратимо!')) return;
    database.ref('chats/' + chatId).remove().then(() => {
        database.ref('messages/' + chatId).remove();
        showNotification('Канал удалён', 'info');
        closeBeautyChannelProfileModal();
        closeChat();
        loadChats();
    });
}

function toggleChannelVerificationUI(chatId) {
    if (!window.isSuperAdmin) return;
    database.ref('chats/' + chatId + '/verified').once('value', snap => {
        const newValue = !snap.val();
        database.ref('chats/' + chatId + '/verified').set(newValue).then(() => {
            showNotification(newValue ? 'Канал верифицирован' : 'Верификация снята', 'success');
            closeBeautyChannelProfileModal();
            setTimeout(() => openChannelOrGroupProfile(), 300);
        });
    });
}

function formatSliceDateUI(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' мин назад';
    if (diff < 86400) return 'сегодня';
    return date.toLocaleDateString('ru-RU');
}

function showVerifiedInfo() {
    alert('Этот канал имеет подтверждённый статус верификации ✅');
}

function openSliceLightbox(url) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-image');
    if (lightbox && lightboxImg) {
        lightboxImg.src = url;
        lightbox.classList.remove('hidden');
    }
}
// ========== ПОИСК (РАСШИРЕННЫЙ) ==========

function searchGlobalNew() {
    const query = document.getElementById('global-search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('global-search-results');
    const resultsList = document.getElementById('search-results-list');
    
    if (!query || query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }
    
    resultsContainer.style.display = 'flex';
    resultsList.innerHTML = '<div class="loading-spinner">🔍 Поиск...</div>';
    
    Promise.all([
        searchUsersGlobal(query),
        searchMyChatsGlobal(query),
        searchPublicChannelsGlobal(query),
        searchPublicGroupsGlobal(query)
    ]).then(([users, myChats, publicChannels, publicGroups]) => {
        renderSearchResultsEnhanced(users, myChats, publicChannels, publicGroups, query);
    }).catch(err => {
        console.error('Ошибка поиска:', err);
        resultsList.innerHTML = '<div class="empty-search">Ошибка поиска</div>';
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
        if (results.length >= 15) break;
    }
    return results;
}

async function searchMyChatsGlobal(query) {
    const userChats = await database.ref('userChats/' + currentUser.uid).once('value');
    const chatIds = Object.keys(userChats.val() || {});
    const results = [];
    
    for (let chatId of chatIds) {
        const chat = await database.ref('chats/' + chatId).once('value');
        const chatData = chat.val();
        if (!chatData) continue;
        
        let name = '';
        let avatar = '';
        let type = '';
        
        if (chatData.type === 'group') {
            name = (chatData.name || '').toLowerCase();
            avatar = chatData.avatar || '';
            type = 'group';
        } else if (chatData.type === 'channel') {
            name = (chatData.name || '').toLowerCase();
            avatar = chatData.avatar || '';
            type = 'channel';
        } else {
            const otherId = chatData.participants?.find(id => id !== currentUser.uid);
            if (otherId) {
                const otherUser = await database.ref('users/' + otherId).once('value');
                name = (otherUser.val()?.username || '').toLowerCase();
                avatar = otherUser.val()?.avatar || '';
                type = 'private';
            }
        }
        
        if (name.includes(query)) {
            results.push({ type: 'myChat', chatId, data: chatData, displayType: type, name: name, avatar: avatar });
        }
        if (results.length >= 15) break;
    }
    return results;
}

async function searchPublicChannelsGlobal(query) {
    const snapshot = await database.ref('chats').once('value');
    const chats = snapshot.val();
    const results = [];
    
    for (let chatId in chats) {
        const chat = chats[chatId];
        // Только публичные каналы, на которые пользователь не подписан
        if (chat.type !== 'channel') continue;
        if (!chat.isPublic) continue;
        if (chat.subscribers && chat.subscribers[currentUser.uid]) continue;
        
        const name = (chat.name || '').toLowerCase();
        const kname = (chat.kname || '').toLowerCase();
        
        if (name.includes(query) || kname.includes(query)) {
            results.push({ type: 'publicChannel', chatId, data: chat });
        }
        if (results.length >= 15) break;
    }
    return results;
}

async function searchPublicGroupsGlobal(query) {
    const snapshot = await database.ref('chats').once('value');
    const chats = snapshot.val();
    const results = [];
    
    for (let chatId in chats) {
        const chat = chats[chatId];
        // Только публичные группы, в которых пользователь не состоит
        if (chat.type !== 'group') continue;
        if (!chat.isPublic) continue;
        if (chat.members && chat.members[currentUser.uid]) continue;
        
        const name = (chat.name || '').toLowerCase();
        const kname = (chat.kname || '').toLowerCase();
        
        if (name.includes(query) || kname.includes(query)) {
            results.push({ type: 'publicGroup', chatId, data: chat });
        }
        if (results.length >= 15) break;
    }
    return results;
}

function renderSearchResultsEnhanced(users, myChats, publicChannels, publicGroups, query) {
    const container = document.getElementById('search-results-list');
    container.innerHTML = '';
    
    if (!users.length && !myChats.length && !publicChannels.length && !publicGroups.length) {
        container.innerHTML = '<div class="empty-search">Ничего не найдено</div>';
        return;
    }
    
    // Секция: Люди
    if (users.length > 0) {
        const section = document.createElement('div');
        section.innerHTML = '<div style="padding: 8px 12px; background: var(--background); font-weight: bold; border-radius: 12px; margin-bottom: 8px;">👤 ЛЮДИ</div>';
        container.appendChild(section);
        
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `
                <div class="search-result-avatar" style="background-image: url(${user.avatar || ''}); background-size: cover;">${!user.avatar ? '👤' : ''}</div>
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(user.username)}</div>
                    <div class="search-result-username">${user.userTag ? '@' + user.userTag : '@' + user.username.toLowerCase().replace(/\s/g, '')}</div>
                </div>
                <div class="search-result-badge" style="background: var(--forest); color: white;">👤</div>
            `;
            div.onclick = () => startPrivateChat(user.uid, user);
            container.appendChild(div);
        });
    }
    
    // Секция: Мои чаты
    if (myChats.length > 0) {
        const section = document.createElement('div');
        section.innerHTML = '<div style="padding: 8px 12px; background: var(--background); font-weight: bold; border-radius: 12px; margin: 8px 0;">💬 МОИ ЧАТЫ</div>';
        container.appendChild(section);
        
        myChats.forEach(chat => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            let icon = chat.displayType === 'group' ? '👥' : (chat.displayType === 'channel' ? '📢' : '💬');
            let badgeText = chat.displayType === 'group' ? 'Группа' : (chat.displayType === 'channel' ? 'Канал' : 'Чат');
            
            div.innerHTML = `
                <div class="search-result-avatar" style="background-image: url(${chat.avatar || ''}); background-size: cover;">${!chat.avatar ? icon : ''}</div>
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(chat.name)}</div>
                </div>
                <div class="search-result-badge">${badgeText}</div>
            `;
            div.onclick = () => openChat(chat.chatId, chat.data);
            container.appendChild(div);
        });
    }
    
    // Секция: Публичные каналы
    if (publicChannels.length > 0) {
        const section = document.createElement('div');
        section.innerHTML = '<div style="padding: 8px 12px; background: var(--background); font-weight: bold; border-radius: 12px; margin: 8px 0;">📢 ПУБЛИЧНЫЕ КАНАЛЫ</div>';
        container.appendChild(section);
        
        publicChannels.forEach(channel => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            const subsCount = Object.keys(channel.data.subscribers || {}).length;
            
            div.innerHTML = `
                <div class="search-result-avatar" style="background-image: url(${channel.data.avatar || ''}); background-size: cover;">${!channel.data.avatar ? '📢' : ''}</div>
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(channel.data.name)}</div>
                    <div class="search-result-username">${channel.data.kname ? '@' + channel.data.kname : ''}</div>
                    <div class="search-result-desc" style="font-size: 11px; color: var(--text-muted);">👥 ${subsCount} подписчиков</div>
                </div>
                <div class="search-result-badge" style="background: #228B22; color: white;">Подписаться</div>
            `;
            div.onclick = () => subscribeToPublicChannelUI(channel.chatId, channel.data);
            container.appendChild(div);
        });
    }
    
    // Секция: Публичные группы
    if (publicGroups.length > 0) {
        const section = document.createElement('div');
        section.innerHTML = '<div style="padding: 8px 12px; background: var(--background); font-weight: bold; border-radius: 12px; margin: 8px 0;">👥 ПУБЛИЧНЫЕ ГРУППЫ</div>';
        container.appendChild(section);
        
        publicGroups.forEach(group => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            const membersCount = Object.keys(group.data.members || {}).length;
            
            div.innerHTML = `
                <div class="search-result-avatar" style="background-image: url(${group.data.avatar || ''}); background-size: cover;">${!group.data.avatar ? '👥' : ''}</div>
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(group.data.name)}</div>
                    <div class="search-result-username">${group.data.kname ? '@' + group.data.kname : ''}</div>
                    <div class="search-result-desc" style="font-size: 11px; color: var(--text-muted);">👥 ${membersCount} участников</div>
                </div>
                <div class="search-result-badge" style="background: #228B22; color: white;">Вступить</div>
            `;
            div.onclick = () => joinPublicGroupUI(group.chatId, group.data);
            container.appendChild(div);
        });
    }
}

function subscribeToPublicChannelUI(chatId, channel) {
    database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true)
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true))
        .then(() => {
            showNotification('Вы подписались на канал "' + channel.name + '"', 'success');
            closeSearchResults();
            loadChats();
            openChat(chatId, channel);
        })
        .catch(err => showNotification('Ошибка', 'error'));
}

function joinPublicGroupUI(chatId, group) {
    database.ref('chats/' + chatId + '/members/' + currentUser.uid).set(true)
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true))
        .then(() => {
            showNotification('Вы вступили в группу "' + group.name + '"', 'success');
            // Отправляем системное сообщение
            const systemMessage = {
                type: 'system',
                text: `${currentUserData?.username || 'Пользователь'} вступил(а) в группу`,
                senderId: 'system',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            database.ref('messages/' + chatId).push(systemMessage);
            closeSearchResults();
            loadChats();
            openChat(chatId, group);
        })
        .catch(err => showNotification('Ошибка', 'error'));
}

function closeSearchResults() {
    const resultsContainer = document.getElementById('global-search-results');
    if (resultsContainer) resultsContainer.style.display = 'none';
    const searchInput = document.getElementById('global-search-input');
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
    // Создаём модальное окно с поиском
    const modalHtml = `
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
    
    const oldModal = document.getElementById('new-chat-modal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('new-chat-modal').classList.remove('hidden');
    
    // Фокус на поле поиска
    setTimeout(() => {
        const searchInput = document.getElementById('new-chat-search-input');
        if (searchInput) searchInput.focus();
    }, 100);
}

function closeNewChatDialog() {
    const modal = document.getElementById('new-chat-modal');
    if (modal) modal.remove();
}

let searchTimeoutNewChat = null;

function searchUsersForNewChat() {
    const query = document.getElementById('new-chat-search-input').value.trim().toLowerCase();
    const container = document.getElementById('new-chat-users-list');
    
    if (searchTimeoutNewChat) clearTimeout(searchTimeoutNewChat);
    
    if (!query || query.length < 2) {
        container.innerHTML = '<div class="loading-spinner" style="text-align: center; padding: 20px;">🔍 Введите минимум 2 символа для поиска</div>';
        return;
    }
    
    container.innerHTML = '<div class="loading-spinner" style="text-align: center; padding: 20px;">🔍 Поиск...</div>';
    
    searchTimeoutNewChat = setTimeout(async () => {
        const results = await searchUsersForChat(query);
        renderUsersForNewChat(results, container);
    }, 300);
}

async function searchUsersForChat(query) {
    const snapshot = await database.ref('users').once('value');
    const users = snapshot.val();
    const results = [];
    
    for (let uid in users) {
        if (uid === currentUser.uid) continue;
        const user = users[uid];
        const username = (user.username || '').toLowerCase();
        const userTag = (user.userTag || '').toLowerCase().replace('@', '');
        
        // Поиск по username, userTag и по вводу с @
        const searchQuery = query.replace('@', '');
        
        if (username.includes(searchQuery) || userTag.includes(searchQuery)) {
            results.push({ 
                uid, 
                username: user.username,
                userTag: user.userTag,
                avatar: user.avatar || ''  // Убедимся что avatar есть
            });
        }
        if (results.length >= 20) break;
    }
    return results;
}

function renderUsersForNewChat(users, container) {
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-search" style="text-align: center; padding: 20px; color: var(--text-muted);">👤 Пользователи не найдены</div>';
        return;
    }
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;';
        div.onmouseenter = () => div.style.background = 'var(--background)';
        div.onmouseleave = () => div.style.background = 'white';
        
        // Правильное отображение аватарки
        let avatarHtml = '';
        if (user.avatar && user.avatar.startsWith('http')) {
            avatarHtml = `<div class="avatar" style="width: 50px; height: 50px; background-image: url(${user.avatar}); background-size: cover; background-position: center; border-radius: 50%;"></div>`;
        } else {
            avatarHtml = `<div class="avatar" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: var(--sage); border-radius: 50%; font-size: 24px;">👤</div>`;
        }
        
        div.innerHTML = `
            ${avatarHtml}
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 16px;">${escapeHtml(user.username)}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${user.userTag ? '@' + user.userTag : '@' + user.username.toLowerCase().replace(/\s/g, '')}</div>
            </div>
            <div style="color: var(--forest); font-size: 20px;">➤</div>
        `;
        
        div.onclick = () => createNewChatAndOpen(user.uid, user);
        container.appendChild(div);
    });
}
async function createNewChatAndOpen(otherUserId, otherUser) {
    showNotification('Создание чата...', 'info');
    
    const chatId = generateChatId(currentUser.uid, otherUserId);
    
    // Проверяем, существует ли уже чат
    const chatSnapshot = await database.ref('chats/' + chatId).once('value');
    
    if (!chatSnapshot.exists()) {
        // Создаём новый чат
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
        
        // Отправляем приветственное сообщение
        const welcomeMessage = {
            type: 'text',
            text: `🍃 Добро пожаловать в чат с ${otherUser.username}! Здесь вы можете общаться, делиться фото и файлами.`,
            senderId: 'system',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            isSystem: true
        };
        await database.ref('messages/' + chatId).push(welcomeMessage);
        
        showNotification('Чат создан!', 'success');
    } else {
        showNotification('Чат уже существует', 'info');
    }
    
    // Закрываем модальное окно и открываем чат
    closeNewChatDialog();
    closeSearchResults();
    
    // Загружаем актуальные данные чата
    const chatData = await database.ref('chats/' + chatId).once('value');
    const chat = chatData.val();
    chat.otherUserId = otherUserId;
    chat.otherUser = otherUser;
    
    openChat(chatId, chat);
    loadChats();
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
    }).catch(err => {
        console.error('Ошибка загрузки канала:', err);
        showNotification('Ошибка загрузки профиля канала', 'error');
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
                    </div>
                </div>
                
                <!-- Вкладки -->
                <div style="display: flex; border-top: 1px solid var(--border); background: white;">
                    <button class="channel-tab-btn active" data-tab="posts" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">📷 Посты</button>
                    <button class="channel-tab-btn" data-tab="info" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">ℹ️ Информация</button>
                    ${canEdit ? `<button class="channel-tab-btn" data-tab="admin" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">⚙️ Управление</button>` : ''}
                </div>
                
                <!-- Контент -->
                <div id="channel-tab-content" style="padding: 15px; min-height: 300px; max-height: 400px; overflow-y: auto;">
                    <div class="profile-loading">Загрузка...</div>
                </div>
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
    }
    
    div.innerHTML = `
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
    
    database.ref('users/' + chat.createdBy).once('value', ownerSnap => {
        const owner = ownerSnap.val();
        
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
                <div style="margin-bottom: 15px;">
                    <strong>👥 Подписчики</strong>
                    <div id="channel-subscribers-list" style="margin-top: 8px; max-height: 250px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
        
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
                        div.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer;';
                        div.onclick = () => openUserProfile(uid);
                        div.innerHTML = `
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; ${user.avatar ? `background-image: url(${user.avatar}); background-size: cover;` : ''}">${!user.avatar ? '👤' : ''}</div>
                            <div>
                                <div style="font-weight: 500;">${escapeHtml(user.username)}</div>
                                <div style="font-size: 11px; color: var(--text-muted);">${user.userTag ? '@' + user.userTag : ''}</div>
                            </div>
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
    
    container.innerHTML = `
        <div style="padding: 10px;">
            <div class="setting-item" onclick="editChannelInfo()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>✏️ Редактировать название и описание</span>
                <span>›</span>
            </div>
            <div class="setting-item" onclick="editChannelBanner()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>🎨 Изменить баннер</span>
                <span>›</span>
            </div>
            <div class="setting-item" onclick="editChannelAvatar()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>🖼️ Изменить аватарку</span>
                <span>›</span>
            </div>
            <div class="setting-item">
                <span>💬 Комментарии</span>
                <label class="switch">
                    <input type="checkbox" id="channel-comments-toggle" ${currentChannelProfileData.commentsEnabled !== false ? 'checked' : ''} onchange="toggleChannelComments(this.checked)">
                    <span class="slider round"></span>
                </label>
            </div>
            <div class="setting-item" onclick="generateChannelInviteLink()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span>🔗 Ссылка-приглашение</span>
                <span>›</span>
            </div>
            <div class="setting-item" onclick="deleteChannel()" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer;">
                <span style="color: #dc3545;">🗑️ Удалить канал</span>
                <span>›</span>
            </div>
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
                <button onclick="closeInviteModal()" class="btn-secondary" style="width: 100%;">Закрыть</button>
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

function closeInviteModal() {
    const modal = document.getElementById('invite-link-modal');
    if (modal) modal.remove();
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

function closeBeautyChannelProfile() {
    const modal = document.getElementById('beauty-channel-profile');
    if (modal) modal.remove();
    if (currentChannelProfileId) {
        database.ref('chats/' + currentChannelProfileId + '/subscribers').off();
    }
    currentChannelProfileId = null;
    currentChannelProfileData = null;
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

function openSliceLightbox(url) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-image');
    if (lightbox && lightboxImg) {
        lightboxImg.src = url;
        lightbox.classList.remove('hidden');
    }
}

function showVerifiedInfo() {
    alert('Этот канал имеет подтверждённый статус верификации ✅');
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
            
            database.ref('chats/' + channelId).once('value', snap => {
                const channel = snap.val();
                if (channel && channel.type === 'channel') {
                    showNotification('Вас пригласили в канал!', 'info');
                    setTimeout(() => openChannelProfile(channelId), 500);
                }
            });
        });
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

setTimeout(checkChannelInvite, 1500);
// ПРОСТОЙ ПРОФИЛЬ КАНАЛА (РАБОЧАЯ ВЕРСИЯ)
function openChannelProfile(chatId) {
    console.log('openChannelProfile РАБОТАЕТ! chatId:', chatId);
    
    database.ref('chats/' + chatId).once('value').then(snapshot => {
        const chat = snapshot.val();
        if (!chat) {
            console.error('Канал не найден');
            showNotification('Канал не найден', 'error');
            return;
        }
        
        const membersCount = Object.keys(chat.subscribers || {}).length;
        const isSubscribed = chat.subscribers && chat.subscribers[currentUser.uid];
        
        const modalHtml = `
            <div id="simple-channel-profile-modal" class="modal" style="z-index: 10001;">
                <div style="background: white; width: 90%; max-width: 400px; border-radius: 20px; overflow: hidden; margin: auto; position: relative;">
                    <div style="background: linear-gradient(135deg, #228B22, #556B2F); height: 100px;"></div>
                    <button onclick="closeSimpleChannelProfileModal()" style="position: absolute; top: 10px; right: 15px; background: rgba(0,0,0,0.5); color: white; border: none; width: 30px; height: 30px; border-radius: 50%; font-size: 18px; cursor: pointer;">✕</button>
                    
                    <div style="text-align: center; margin-top: -40px;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--sage); margin: 0 auto; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 40px; ${chat.avatar ? `background-image: url(${chat.avatar}); background-size: cover;` : ''}">
                            ${chat.avatar ? '' : '📢'}
                        </div>
                    </div>
                    
                    <div style="text-align: center; padding: 15px;">
                        <h2 style="font-size: 20px; margin: 0;">${escapeHtml(chat.name || 'Канал')}</h2>
                        ${chat.kname ? `<div style="color: gray; font-size: 13px;">@${escapeHtml(chat.kname)}</div>` : ''}
                        <div style="color: gray; font-size: 13px; margin: 5px 0;">👥 ${membersCount} подписчиков</div>
                        <p style="color: #666; font-size: 14px; margin-top: 10px;">${escapeHtml(chat.description || 'Нет описания')}</p>
                    </div>
                    
                    <div style="padding: 15px; border-top: 1px solid #eee;">
                        <button id="simple-channel-action-btn" style="width: 100%; padding: 12px; border: none; border-radius: 30px; background: ${isSubscribed ? '#dc3545' : '#228B22'}; color: white; font-size: 16px; cursor: pointer;">
                            ${isSubscribed ? 'Отписаться' : 'Подписаться'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const oldModal = document.getElementById('simple-channel-profile-modal');
        if (oldModal) oldModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('simple-channel-profile-modal').classList.remove('hidden');
        
        const actionBtn = document.getElementById('simple-channel-action-btn');
        if (actionBtn) {
            actionBtn.onclick = () => {
                if (isSubscribed) {
                    database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).remove()
                        .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).remove())
                        .then(() => {
                            showNotification('Вы отписались', 'info');
                            closeSimpleChannelProfileModal();
                            loadChats();
                        });
                } else {
                    database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true)
                        .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true))
                        .then(() => {
                            showNotification('Вы подписались!', 'success');
                            closeSimpleChannelProfileModal();
                        });
                }
            };
        }
    }).catch(err => {
        console.error('Ошибка:', err);
        showNotification('Ошибка загрузки профиля', 'error');
    });
}

function closeSimpleChannelProfileModal() {
    const modal = document.getElementById('simple-channel-profile-modal');
    if (modal) modal.remove();
}
// ========== КРАСИВЫЙ ПРОФИЛЬ ГРУППЫ ==========

let currentGroupProfileId = null;
let currentGroupProfileData = null;

function openGroupProfile(chatId) {
    console.log('openGroupProfile вызван для:', chatId);
    currentGroupProfileId = chatId;
    
    database.ref('chats/' + chatId).once('value').then(snapshot => {
        const group = snapshot.val();
        if (!group || group.type !== 'group') {
            showNotification('Группа не найдена', 'error');
            return;
        }
        currentGroupProfileData = group;
        showBeautyGroupProfile(group);
    }).catch(err => {
        console.error('Ошибка:', err);
        showNotification('Ошибка загрузки группы', 'error');
    });
}

function showBeautyGroupProfile(group) {
    const membersCount = Object.keys(group.members || {}).length;
    const isMember = group.members && group.members[currentUser.uid];
    const isAdmin = group.admins && group.admins[currentUser.uid];
    const isOwner = group.createdBy === currentUser.uid;
    const isSuperAdmin = window.isSuperAdmin === true;
    const canEdit = isAdmin || isOwner || isSuperAdmin;
    
    const bannerStyle = group.banner ? 
        (group.banner.startsWith('#') ? `background: ${group.banner};` : `background-image: url(${group.banner}); background-size: cover; background-position: center;`) :
        'background: linear-gradient(135deg, #228B22, #556B2F);';
    
    const modalHtml = `
        <div id="beauty-group-profile-modal" class="modal" style="z-index: 10001;">
            <div style="background: white; width: 100%; max-width: 550px; border-radius: 24px; overflow: hidden; margin: auto; position: relative; max-height: 90vh; overflow-y: auto;">
                <!-- Баннер -->
                <div style="${bannerStyle} height: 140px; position: relative;">
                    ${canEdit ? `<button class="group-banner-edit" onclick="editGroupBannerUI('${currentGroupProfileId}')" style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px;">✏️</button>` : ''}
                    <button onclick="closeBeautyGroupProfileModal()" style="position: absolute; top: 10px; right: 15px; background: rgba(0,0,0,0.5); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 20px; cursor: pointer;">×</button>
                </div>
                
                <!-- Аватарка (перекрывает баннер) -->
                <div style="display: flex; justify-content: center; margin-top: -50px; position: relative; z-index: 2;">
                    <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--sage); border: 4px solid white; display: flex; align-items: center; justify-content: center; font-size: 50px; ${group.avatar ? `background-image: url(${group.avatar}); background-size: cover;` : ''}">
                        ${group.avatar ? '' : '👥'}
                        ${canEdit ? `<button class="group-avatar-edit" onclick="editGroupAvatarUI('${currentGroupProfileId}')" style="position: absolute; bottom: 5px; right: 5px; background: var(--forest); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px;">✏️</button>` : ''}
                    </div>
                </div>
                
                <!-- Информация -->
                <div style="text-align: center; padding: 15px 20px;">
                    <h2 style="font-size: 22px; margin: 0;">${escapeHtml(group.name || 'Группа')}</h2>
                    ${group.kname ? `<div style="color: var(--text-muted); font-size: 14px; margin-top: 5px;">@${escapeHtml(group.kname)}</div>` : ''}
                    <div style="color: var(--text-muted); font-size: 14px; margin: 5px 0;">👥 ${membersCount} участников</div>
                    <p style="color: var(--text-dark); font-size: 14px; margin-top: 10px;">${escapeHtml(group.description || 'Нет описания')}</p>
                    
                    <div style="margin-top: 15px; padding: 10px 0; border-top: 1px solid var(--border);">
                        <button id="group-action-btn" style="padding: 8px 24px; border: none; border-radius: 30px; background: ${isMember ? '#dc3545' : 'var(--forest)'}; color: white; font-size: 14px; cursor: pointer;">
                            ${isMember ? 'Покинуть группу' : 'Вступить в группу'}
                        </button>
                    </div>
                    
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">
                        ${group.isPublic ? '🌍 Публичная группа' : '🔒 Приватная группа'}
                    </div>
                </div>
                
                <!-- Вкладки -->
                <div style="display: flex; border-top: 1px solid var(--border); background: white;">
                    <button class="group-tab-btn-ui active" data-tab="members" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">👥 Участники</button>
                    <button class="group-tab-btn-ui" data-tab="info" style="flex: 1; padding: 14px; background: none; border: none; cursor: pointer; font-size: 14px;">ℹ️ Инфо группы</button>
                </div>
                
                <!-- Контент -->
                <div id="group-tab-content-ui" style="padding: 15px; min-height: 300px; max-height: 400px; overflow-y: auto;">
                    <div class="profile-loading">Загрузка...</div>
                </div>
            </div>
        </div>
    `;
    
    const oldModal = document.getElementById('beauty-group-profile-modal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('beauty-group-profile-modal');
    modal.classList.remove('hidden');
    
    // Обновляем количество участников в реальном времени
    database.ref('chats/' + currentGroupProfileId + '/members').on('value', (snap) => {
        const count = Object.keys(snap.val() || {}).length;
        const countEl = document.getElementById('group-members-count');
        if (countEl) countEl.textContent = count;
    });
    
    // Обработчики вкладок
    document.querySelectorAll('.group-tab-btn-ui').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.group-tab-btn-ui').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            if (tab === 'members') loadGroupMembersTabUI();
            else if (tab === 'info') loadGroupInfoTabUI();
        };
    });
    
    // Кнопка вступления/выхода
    const actionBtn = document.getElementById('group-action-btn');
    if (actionBtn) {
        actionBtn.onclick = () => handleGroupActionUI();
    }
    
    // Загружаем участников по умолчанию
    loadGroupMembersTabUI();
}

function closeBeautyGroupProfileModal() {
    const modal = document.getElementById('beauty-group-profile-modal');
    if (modal) modal.remove();
    if (currentGroupProfileId) {
        database.ref('chats/' + currentGroupProfileId + '/members').off();
    }
    currentGroupProfileId = null;
    currentGroupProfileData = null;
}

function handleGroupActionUI() {
    const isMember = currentGroupProfileData.members && currentGroupProfileData.members[currentUser.uid];
    
    if (isMember) {
        if (!confirm('Покинуть группу?')) return;
        database.ref('chats/' + currentGroupProfileId + '/members/' + currentUser.uid).remove()
            .then(() => database.ref('userChats/' + currentUser.uid + '/' + currentGroupProfileId).remove())
            .then(() => {
                showNotification('Вы покинули группу', 'info');
                closeBeautyGroupProfileModal();
                closeChat();
                loadChats();
            });
    } else {
        database.ref('chats/' + currentGroupProfileId + '/members/' + currentUser.uid).set(true)
            .then(() => database.ref('userChats/' + currentUser.uid + '/' + currentGroupProfileId).set(true))
            .then(() => {
                showNotification('Вы вступили в группу!', 'success');
                // Отправляем системное сообщение
                const systemMessage = {
                    type: 'system',
                    text: `${currentUserData?.username || 'Пользователь'} вступил(а) в группу`,
                    senderId: 'system',
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
                database.ref('messages/' + currentGroupProfileId).push(systemMessage);
                closeBeautyGroupProfileModal();
                openChat(currentGroupProfileId, currentGroupProfileData);
            });
    }
}

function loadGroupMembersTabUI() {
    const container = document.getElementById('group-tab-content-ui');
    if (!container) return;
    
    container.innerHTML = '<div class="profile-loading">Загрузка участников...</div>';
    
    const members = currentGroupProfileData.members || {};
    const memberIds = Object.keys(members);
    const admins = currentGroupProfileData.admins || {};
    const ownerId = currentGroupProfileData.createdBy;
    
    if (memberIds.length === 0) {
        container.innerHTML = '<div class="profile-empty">Нет участников</div>';
        return;
    }
    
    container.innerHTML = `
        <div style="margin-bottom: 12px;">
            <button onclick="shareGroupInviteUI()" style="width: 100%; padding: 10px; background: var(--forest); color: white; border: none; border-radius: 12px; cursor: pointer; font-size: 14px;">🔗 Поделиться группой</button>
        </div>
        <div id="group-members-list-ui"></div>
    `;
    
    const membersContainer = document.getElementById('group-members-list-ui');
    
    memberIds.forEach(uid => {
        database.ref('users/' + uid).once('value', userSnap => {
            const user = userSnap.val();
            if (!user) return;
            
            let role = 'участник';
            let roleColor = '#666';
            if (uid === ownerId) {
                role = 'владелец';
                roleColor = '#ff9800';
            } else if (admins[uid]) {
                role = 'админ';
                roleColor = '#228B22';
            }
            
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border); cursor: pointer;';
            div.onclick = () => openUserProfile(uid);
            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; ${user.avatar ? `background-image: url(${user.avatar}); background-size: cover;` : ''}">${!user.avatar ? '👤' : ''}</div>
                    <div>
                        <div style="font-weight: 500;">${escapeHtml(user.username)}</div>
                        <div style="font-size: 11px; color: ${roleColor};">${role}</div>
                    </div>
                </div>
            `;
            membersContainer.appendChild(div);
        });
    });
}

function loadGroupInfoTabUI() {
    const container = document.getElementById('group-tab-content-ui');
    if (!container) return;
    
    const group = currentGroupProfileData;
    const isAdmin = group.admins && group.admins[currentUser.uid];
    const isOwner = group.createdBy === currentUser.uid;
    const isSuperAdmin = window.isSuperAdmin === true;
    const canEdit = isAdmin || isOwner || isSuperAdmin;
    
    // Загружаем права администраторов
    const adminPermissions = group.adminPermissions || {
        canDeleteMessages: true,
        canEditSettings: false,
        canManageMembers: false,
        canPinMessages: false
    };
    
    database.ref('users/' + group.createdBy).once('value', ownerSnap => {
        const owner = ownerSnap.val();
        
        let permissionsHtml = '';
        if (canEdit) {
            permissionsHtml = `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border);">
                    <strong>⚙️ Права администраторов</strong>
                    <div style="margin-top: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                            <div>🗑️ Удалять сообщения</div>
                            <label class="switch">
                                <input type="checkbox" id="group-perm-delete-ui" ${adminPermissions.canDeleteMessages ? 'checked' : ''} onchange="saveGroupPermissionsUI()">
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                            <div>✏️ Изменять настройки группы</div>
                            <label class="switch">
                                <input type="checkbox" id="group-perm-edit-ui" ${adminPermissions.canEditSettings ? 'checked' : ''} onchange="saveGroupPermissionsUI()">
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                            <div>👥 Добавлять/удалять участников</div>
                            <label class="switch">
                                <input type="checkbox" id="group-perm-members-ui" ${adminPermissions.canManageMembers ? 'checked' : ''} onchange="saveGroupPermissionsUI()">
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                            <div>📌 Закреплять сообщения</div>
                            <label class="switch">
                                <input type="checkbox" id="group-perm-pin-ui" ${adminPermissions.canPinMessages ? 'checked' : ''} onchange="saveGroupPermissionsUI()">
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = `
            <div style="padding: 5px;">
                <div style="margin-bottom: 15px;">
                    <strong>📅 Дата создания</strong><br>
                    <span style="color: var(--text-muted);">${group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Неизвестно'}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>🌍 Тип группы</strong><br>
                    <span style="color: var(--text-muted);">${group.isPublic ? 'Публичная' : 'Приватная'}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>👑 Создатель</strong><br>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px; cursor: pointer;" onclick="openUserProfile('${group.createdBy}')">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; ${owner?.avatar ? `background-image: url(${owner.avatar}); background-size: cover;` : ''}">${!owner?.avatar ? '👤' : ''}</div>
                        <span>${owner ? escapeHtml(owner.username) : 'Неизвестен'}</span>
                    </div>
                </div>
                ${canEdit ? `
                <div style="margin-top: 15px;">
                    <button onclick="editGroupSettingsUI()" style="width: 100%; padding: 12px; background: var(--background); border: none; border-radius: 12px; cursor: pointer; text-align: left;">
                        ⚙️ Изменить настройки группы
                    </button>
                </div>
                ` : ''}
                ${permissionsHtml}
            </div>
        `;
    });
}

function saveGroupPermissionsUI() {
    const permissions = {
        canDeleteMessages: document.getElementById('group-perm-delete-ui')?.checked || false,
        canEditSettings: document.getElementById('group-perm-edit-ui')?.checked || false,
        canManageMembers: document.getElementById('group-perm-members-ui')?.checked || false,
        canPinMessages: document.getElementById('group-perm-pin-ui')?.checked || false
    };
    database.ref('chats/' + currentGroupProfileId + '/adminPermissions').set(permissions);
    showNotification('Права сохранены', 'success');
}

function editGroupSettingsUI() {
    const newName = prompt('Новое название группы:', currentGroupProfileData.name);
    const newDesc = prompt('Новое описание:', currentGroupProfileData.description || '');
    const newType = confirm('Сделать группу публичной? (OK - публичная, Отмена - приватная)');
    
    if (newName && newName.trim()) {
        database.ref('chats/' + currentGroupProfileId).update({
            name: newName.trim(),
            description: newDesc?.trim() || '',
            isPublic: newType
        }).then(() => {
            showNotification('Настройки обновлены!', 'success');
            closeBeautyGroupProfileModal();
            setTimeout(() => openGroupProfile(currentGroupProfileId), 300);
        });
    }
}

function editGroupBannerUI(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка баннера...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + chatId).update({ banner: url });
            showNotification('Баннер обновлён!', 'success');
            closeBeautyGroupProfileModal();
            setTimeout(() => openGroupProfile(chatId), 300);
        } catch(err) {
            showNotification('Ошибка загрузки', 'error');
        }
    };
    input.click();
}

function editGroupAvatarUI(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка аватара...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + chatId).update({ avatar: url });
            showNotification('Аватар обновлён!', 'success');
            closeBeautyGroupProfileModal();
            setTimeout(() => openGroupProfile(chatId), 300);
        } catch(err) {
            showNotification('Ошибка загрузки', 'error');
        }
    };
    input.click();
}

function shareGroupInviteUI() {
    const group = currentGroupProfileData;
    const inviteLink = `${window.location.origin}${window.location.pathname}?joinGroup=${group.kname || currentGroupProfileId}`;
    
    const modalHtml = `
        <div id="group-invite-modal-ui" class="modal" style="z-index: 10002;">
            <div style="background: white; width: 350px; border-radius: 20px; padding: 20px; margin: auto;">
                <h3 style="margin: 0 0 15px 0;">Поделиться группой</h3>
                <div style="margin-bottom: 15px;">
                    <button onclick="forwardGroupInviteUI('${inviteLink}')" style="width: 100%; padding: 12px; background: var(--background); border: none; border-radius: 12px; margin-bottom: 10px; cursor: pointer;">📨 Переслать в чат</button>
                    <button onclick="copyGroupInviteLinkUI('${inviteLink}')" style="width: 100%; padding: 12px; background: var(--forest); color: white; border: none; border-radius: 12px; cursor: pointer;">🔗 Копировать ссылку</button>
                </div>
                <button onclick="closeGroupInviteModalUI()" style="width: 100%; padding: 10px; background: none; border: none; cursor: pointer;">Отмена</button>
            </div>
        </div>
    `;
    
    const oldModal = document.getElementById('group-invite-modal-ui');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('group-invite-modal-ui').classList.remove('hidden');
}

function forwardGroupInviteUI(link) {
    closeGroupInviteModalUI();
    // Открываем диалог пересылки с приглашением
    if (typeof openForwardDialog === 'function') {
        openForwardDialog(null, `Приглашение в группу "${currentGroupProfileData.name}": ${link}`, 'text', '');
    } else {
        copyGroupInviteLinkUI(link);
    }
}

function copyGroupInviteLinkUI(link) {
    navigator.clipboard.writeText(link);
    showNotification('Ссылка скопирована!', 'success');
    closeGroupInviteModalUI();
}

function closeGroupInviteModalUI() {
    const modal = document.getElementById('group-invite-modal-ui');
    if (modal) modal.remove();
}

// Обработка приглашения по ссылке
function checkGroupInviteUI() {
    const urlParams = new URLSearchParams(window.location.search);
    const joinGroupId = urlParams.get('joinGroup');
    if (joinGroupId && currentUser) {
        database.ref('chats').orderByChild('kname').equalTo(joinGroupId).once('value', snapshot => {
            let groupId = null;
            snapshot.forEach(child => {
                if (child.val().type === 'group') groupId = child.key;
            });
            if (!groupId) groupId = joinGroupId;
            
            database.ref('chats/' + groupId).once('value', snap => {
                const group = snap.val();
                if (group && group.type === 'group') {
                    const isMember = group.members && group.members[currentUser.uid];
                    if (!isMember) {
                        // Показываем кнопку вступления
                        showJoinGroupButtonUI(groupId, group);
                    }
                }
            });
        });
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function showJoinGroupButtonUI(groupId, group) {
    // Создаем плавающую кнопку
    const existingBtn = document.getElementById('join-group-float-btn');
    if (existingBtn) existingBtn.remove();
    
    const btn = document.createElement('button');
    btn.id = 'join-group-float-btn';
    btn.textContent = `🔗 Вступить в группу "${group.name || 'Группа'}"`;
    btn.style.cssText = 'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--forest); color: white; border: none; padding: 12px 24px; border-radius: 30px; z-index: 1000; cursor: pointer; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
    btn.onclick = () => {
        database.ref('chats/' + groupId + '/members/' + currentUser.uid).set(true)
            .then(() => database.ref('userChats/' + currentUser.uid + '/' + groupId).set(true))
            .then(() => {
                showNotification('Вы вступили в группу!', 'success');
                btn.remove();
                // Отправляем системное сообщение
                const systemMessage = {
                    type: 'system',
                    text: `${currentUserData?.username || 'Пользователь'} вступил(а) в группу по приглашению`,
                    senderId: 'system',
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
                database.ref('messages/' + groupId).push(systemMessage);
                openChat(groupId, group);
            });
    };
    document.body.appendChild(btn);
    
    // Удаляем кнопку через 30 секунд
    setTimeout(() => {
        if (btn && btn.parentNode) btn.remove();
    }, 30000);
}

// Обновляем функцию openChannelOrGroupProfile для поддержки групп
// Найдите существующую функцию и замените её часть для групп
// Запускаем проверку приглашений
setTimeout(checkGroupInviteUI, 1500);

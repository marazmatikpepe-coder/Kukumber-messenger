// KUKUMBER MESSENGER - CHAT.JS (ПОЛНАЯ ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
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

// Константы
var CONTACTS_CACHE_TTL = 30000;
var STATUS_CACHE_TTL = 15000;
var CHATS_LIMIT = 50;

// ========== ИНИЦИАЛИЗАЦИЯ ЗВУКОВ ==========
function initChatSounds() {
    if (typeof KukumberSounds !== 'undefined') {
        KukumberSounds.init();
    }
}

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

// ========== ГЛОБАЛЬНЫЙ ПОИСК И КОНТАКТЫ ==========
function showGlobalSearch() {
    document.getElementById('global-search-modal').classList.remove('hidden');
    var container = document.getElementById('global-users-list');
    container.innerHTML = '<div class="loading-spinner">🔄 Загрузка...</div>';
    database.ref('users').limitToFirst(100).once('value').then(function(snapshot) {
        var users = snapshot.val();
        container.innerHTML = '';
        if (!users) {
            container.innerHTML = '<div>Пользователей не найдено</div>';
            return;
        }
        for (var uid in users) {
            if (uid === currentUser.uid) continue;
            var user = users[uid];
            var div = document.createElement('div');
            div.className = 'user-item';
            var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
            var avatarContent = user.avatar ? '' : '👤';
            div.innerHTML = '<div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><div class="user-item-info"><h4>'+escapeHtml(user.username)+'</h4></div><button class="add-contact-btn" onclick="addToContacts(\''+uid+'\',\''+escapeHtml(user.username)+'\')">➕ Добавить</button>';
            container.appendChild(div);
        }
    }).catch(function() {
        container.innerHTML = '<div>Ошибка загрузки</div>';
    });
}

function closeGlobalSearch() { 
    document.getElementById('global-search-modal').classList.add('hidden'); 
}

function addToContacts(uid, name) {
    database.ref('contacts/' + currentUser.uid + '/' + uid).set(true);
    database.ref('contactsReverse/' + uid + '/' + currentUser.uid).set(true);
    showNotification(name + ' добавлен в контакты', 'success');
    closeGlobalSearch();
    loadContacts(true);
}

function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    document.getElementById('new-chat-search').value = '';
    loadContacts();
}

function closeNewChatDialog() { 
    document.getElementById('new-chat-modal').classList.add('hidden'); 
}

function loadContacts(forceRefresh) {
    var now = Date.now();
    if (!forceRefresh && contactsCache && (now - contactsCacheTime) < CONTACTS_CACHE_TTL) {
        renderContactsList(contactsCache);
        return;
    }
    
    var list = document.getElementById('users-list');
    list.innerHTML = '<div class="loading-spinner">🔄 Загрузка...</div>';
    
    database.ref('contacts/' + currentUser.uid).once('value').then(function(snapshot) {
        var contacts = snapshot.val();
        contactsCache = contacts;
        contactsCacheTime = Date.now();
        renderContactsList(contacts);
    }).catch(function() {
        list.innerHTML = '<div>Ошибка загрузки контактов</div>';
    });
}

function renderContactsList(contacts) {
    var list = document.getElementById('users-list');
    if (!contacts) { 
        list.innerHTML = '<div>Нет контактов. Добавьте через 🔍 в боковом меню</div>'; 
        return; 
    }
    var userIds = Object.keys(contacts);
    if (userIds.length === 0) { 
        list.innerHTML = '<div>Нет контактов</div>'; 
        return; 
    }
    
    list.innerHTML = '';
    var pending = userIds.length;
    
    userIds.forEach(function(uid) {
        database.ref('users/' + uid).once('value').then(function(userSnap) {
            var user = userSnap.val();
            if (!user) {
                pending--;
                return;
            }
            var div = document.createElement('div');
            div.className = 'user-item';
            div.setAttribute('data-username', (user.username || '').toLowerCase());
            var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
            var avatarContent = user.avatar ? '' : '👤';
            div.innerHTML = '<div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><div class="user-item-info"><h4>'+escapeHtml(user.username)+'</h4></div>';
            div.onclick = (function(uid, user) { 
                return function() { startPrivateChat(uid, user); }; 
            })(uid, user);
            list.appendChild(div);
            pending--;
        }).catch(function() { pending--; });
    });
}

function searchContacts() {
    var text = document.getElementById('new-chat-search').value.toLowerCase();
    var items = document.querySelectorAll('#users-list .user-item');
    items.forEach(function(item) {
        var name = item.getAttribute('data-username') || '';
        item.style.display = name.indexOf(text) !== -1 ? 'flex' : 'none';
    });
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
        closeNewChatDialog();
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

function searchChats() {
    var text = document.getElementById('search-chats').value.toLowerCase().trim();
    var chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(function(item) {
        var nameEl = item.querySelector('.chat-item-name');
        if (nameEl) {
            var name = nameEl.textContent.toLowerCase();
            item.style.display = name.indexOf(text) !== -1 ? 'flex' : 'none';
        }
    });
    if (text.length >= 3) searchPublicChannels(text);
}

function searchPublicChannels(searchText) {
    database.ref('chats').once('value').then(function(snapshot) {
        var chats = snapshot.val();
        if (!chats) return;
        var chatsList = document.getElementById('chats-list');
        for (var chatId in chats) {
            var chat = chats[chatId];
            if (chat.type !== 'channel' || !chat.isPublic) continue;
            if (chat.subscribers && chat.subscribers[currentUser.uid]) continue;
            var name = (chat.name || '').toLowerCase();
            if (name.indexOf(searchText) === -1) continue;
            if (document.querySelector('[data-search-channel="'+chatId+'"]')) continue;
            var div = document.createElement('div');
            div.className = 'chat-item search-result';
            div.setAttribute('data-search-channel', chatId);
            var avatar = chat.avatar || '';
            var avatarStyle = avatar ? 'background-image:url('+avatar+');background-size:cover;' : '';
            var avatarContent = avatar ? '' : '📢';
            var subsCount = chat.subscribers ? Object.keys(chat.subscribers).length : 0;
            div.innerHTML = '<div class="chat-item-avatar"><div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><span class="chat-type-badge">📢</span></div><div class="chat-item-info"><div class="chat-item-header"><span class="chat-item-name">'+escapeHtml(chat.name)+'</span><span class="chat-item-time">'+subsCount+' подп.</span></div><div class="chat-item-preview">Нажмите чтобы подписаться</div></div>';
            div.onclick = (function(chatId, chat) { 
                return function() { subscribeToPublicChannel(chatId, chat); }; 
            })(chatId, chat);
            chatsList.insertBefore(div, chatsList.firstChild);
        }
    });
}

function subscribeToPublicChannel(chatId, channel) {
    database.ref('chats/'+chatId+'/subscribers/'+currentUser.uid).set(true).then(function() {
        return database.ref('userChats/'+currentUser.uid+'/'+chatId).set(true);
    }).then(function() {
        showNotification('Подписались на "'+channel.name+'"', 'success');
        var el = document.querySelector('[data-search-channel="'+chatId+'"]');
        if (el) el.remove();
        loadChats();
    }).catch(function(err) { 
        showNotification('Ошибка', 'error'); 
    });
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

function createChatItem(chatId, chatData) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    if (currentChatId === chatId) div.classList.add('active');
    var name = '', avatar = '', badge = '', isOnline = false;
    
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
        var avatarStyle = '', avatarContent = '';
        if (avatar && avatar.indexOf('http') === 0) { 
            avatarStyle = 'background-image:url('+avatar+');background-size:cover;'; 
            avatarContent = ''; 
        } else { 
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
    } else {
        chatAvatar.style.backgroundImage = '';
        chatAvatar.textContent = chatData.type === 'group' ? '👥' : (chatData.type === 'channel' ? '📢' : '👤');
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
    var activeChatItem = document.querySelector('.chat-item[onclick*="openChat(\''+chatId+'\'"]');
    if (activeChatItem) activeChatItem.classList.add('active');
    
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

// ========== СООБЩЕНИЯ (ОПТИМИЗИРОВАННЫЕ) ==========
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    container.innerHTML = '';
    loadedMessageIds.clear();
    
    if (messagesListener) messagesListener.off();
    
    messagesListener = database.ref('messages/'+chatId).orderByChild('timestamp').limitToLast(20);
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        var messageId = snapshot.key;
        
        if (loadedMessageIds.has(messageId)) return;
        loadedMessageIds.add(messageId);
        
        message.id = messageId;
        createMessageElement(message);
        
        // ЗВУК ПОЛУЧЕНИЯ (только если сообщение не от текущего пользователя)
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
    
    // Типы сообщений
    if (message.type === 'image') {
    content = '<div class="message-image" onclick="openLightbox(\''+message.imageUrl+'\')"><img data-src="'+message.imageUrl+'" class="lazy-message" loading="lazy"></div>';
    if (message.caption && message.caption.trim()) {
        content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
    }
}
   else if (message.type === 'gif') {
    content = '<div class="gif-message" onclick="openLightbox(\''+message.gifUrl+'\')">' +
        '<img data-src="'+message.gifUrl+'" alt="GIF" class="gif-image lazy-message" loading="lazy">' +
        '<span class="gif-badge">GIF</span>' +
        '</div>';
    if (message.caption && message.caption.trim()) {
        content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
    }
}
    else if (message.type === 'audio') {
        content = '<div class="audio-message"><button onclick="playAudio(\''+message.audioUrl+'\')">▶️</button><span>Голосовое сообщение</span></div>';
    }
    else if (message.type === 'video') {
        content = '<div class="video-message"><video src="'+message.videoUrl+'" controls preload="metadata" style="max-width:250px; max-height:300px; border-radius:12px;"></video><div class="message-text">'+escapeHtml(message.fileName || 'Видео')+'</div></div>';
    }
    else if (message.type === 'file') {
        var fileIcon = '📎';
        if (message.fileType && message.fileType.startsWith('video/')) fileIcon = '🎬';
        else if (message.fileType && message.fileType.startsWith('audio/')) fileIcon = '🎵';
        else if (message.fileType && message.fileType.startsWith('image/')) fileIcon = '🖼️';
        content = '<div class="file-message"><span style="font-size:24px;">'+fileIcon+'</span><a href="'+message.fileUrl+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(message.fileName)+'</a></div>';
    }
    else {
        var textContent = formatMessageText(message.text || '');
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content = '<div class="message-text">'+textContent+'</div>';
    }
    
    // Реакции
    var reactionsHtml = '';
    if (message.reactions) {
        var reactionCounts = {};
        for (var uid in message.reactions) {
            var r = message.reactions[uid];
            reactionCounts[r] = (reactionCounts[r] || 0) + 1;
        }
        for (var r in reactionCounts) {
            reactionsHtml += '<span class="reaction-badge" onclick="addReaction(\''+message.id+'\', \''+r+'\')">'+r+' '+reactionCounts[r]+'</span>';
        }
    }
    
    // Имя отправителя для групп/каналов
    var senderHtml = '';
    if (!isSent && (currentChatUser.type === 'group' || currentChatUser.type === 'channel')) {
        getUsername(message.senderId).then(function(name) {
            var senderEl = div.querySelector('.message-sender');
            if (senderEl) senderEl.textContent = name;
        });
        senderHtml = '<div class="message-sender" style="cursor:pointer;" onclick="openChatUserProfile(\''+message.senderId+'\')">Загрузка...</div>';
    }
    
    // Аватарка для полученных сообщений
    var avatarHtml = '';
    if (!isSent) {
        getUserAvatar(message.senderId).then(function(avatarUrl) {
            var avatarEl = div.querySelector('.message-avatar .avatar');
            if (avatarEl && avatarUrl) {
                avatarEl.style.backgroundImage = 'url(' + avatarUrl + ')';
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.textContent = '';
            }
        });
        avatarHtml = '<div class="message-avatar" style="cursor:pointer;" onclick="openChatUserProfile(\''+message.senderId+'\')"><div class="avatar" style="width:36px; height:36px;">👤</div></div>';
    }
    
    div.innerHTML = '<div class="message-content-wrapper" style="display:flex; gap:10px; align-items:flex-start;">' + avatarHtml + '<div class="message-content" style="flex:1;">'+senderHtml+content+'<div class="message-time">'+formatTime(message.timestamp)+'</div><div class="message-reactions">'+reactionsHtml+'</div></div></div>';
    
    // Контекстное меню
    div.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showMessageContextMenu(e, message.id, message.senderId, message.text, message.type, message.imageUrl || message.gifUrl);
    });
    
    var touchTimer = null;
    div.addEventListener('touchstart', function(e) {
        touchTimer = setTimeout(function() {
            showMessageContextMenu(e, message.id, message.senderId, message.text, message.type, message.imageUrl || message.gifUrl);
        }, 500);
    });
    div.addEventListener('touchend', function() { 
        if (touchTimer) clearTimeout(touchTimer); 
    });
    div.addEventListener('touchmove', function() { 
        if (touchTimer) clearTimeout(touchTimer); 
    });
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    // Ленивая загрузка изображений
    setTimeout(function() {
        var lazyImages = div.querySelectorAll('.lazy-message');
        lazyImages.forEach(function(img) {
            var src = img.getAttribute('data-src');
            if (src) {
                img.src = src;
                img.removeAttribute('data-src');
            }
        });
    }, 50);
}

function formatMessageText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #228B22; text-decoration: none;">$1</a>');
    text = text.replace(/@(\w+)/g, '<span style="color:#228B22; cursor:pointer;" onclick="openUserProfileByUsername(\'$1\')">@$1</span>');
    return text;
}

function openUserProfileByUsername(username) {
    database.ref('usernames/' + username.toLowerCase()).once('value').then(function(snap) {
        var userId = snap.val();
        if (userId && typeof openUserProfile === 'function') {
            openUserProfile(userId);
        } else {
            showNotification('Пользователь не найден', 'error');
        }
    });
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
        var reactionsDiv = existingDiv.querySelector('.message-reactions');
        if (reactionsDiv) {
            var reactionsHtml = '';
            if (message.reactions) {
                var reactionCounts = {};
                for (var uid in message.reactions) {
                    var r = message.reactions[uid];
                    reactionCounts[r] = (reactionCounts[r] || 0) + 1;
                }
                for (var r in reactionCounts) {
                    reactionsHtml += '<span class="reaction-badge" onclick="addReaction(\''+message.id+'\', \''+r+'\')">'+r+' '+reactionCounts[r]+'</span>';
                }
            }
            reactionsDiv.innerHTML = reactionsHtml;
        }
    }
}

function openChatUserProfile(userId) {
    if (typeof openUserProfile === 'function') {
        openUserProfile(userId);
    } else {
        showNotification('Профиль пользователя будет доступен в разделе Slices', 'info');
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
        
        // ЗВУК ОТПРАВКИ
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

// ========== КОНТЕКСТНОЕ МЕНЮ ==========
function showMessageContextMenu(event, messageId, senderId, messageText, messageType, mediaUrl) {
    var oldMenu = document.getElementById('message-context-menu');
    if (oldMenu) oldMenu.remove();
    
    var isOwnMessage = (senderId === currentUser.uid);
    var isGroupOrChannel = (currentChatUser.type === 'group' || currentChatUser.type === 'channel');
    var isAdmin = (currentChatUser.admins && currentChatUser.admins[currentUser.uid]);
    
    var menu = document.createElement('div');
    menu.id = 'message-context-menu';
    menu.style.cssText = 'position:fixed; z-index:10007; background:white; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.2); min-width:180px; overflow:hidden;';
    
    var menuHtml = '';
    
    if (isOwnMessage) {
        menuHtml += '<div class="context-menu-item" onclick="deleteMessageForMe(\''+messageId+'\')">🗑️ Удалить у меня</div>';
        if (isGroupOrChannel && isAdmin) {
            menuHtml += '<div class="context-menu-item" onclick="deleteMessageForEveryone(\''+messageId+'\')">⚠️ Удалить у всех</div>';
        } else if (!isGroupOrChannel) {
            menuHtml += '<div class="context-menu-item" onclick="deleteMessageForEveryone(\''+messageId+'\')">⚠️ Удалить у всех</div>';
        }
    } else if (isGroupOrChannel && isAdmin) {
        menuHtml += '<div class="context-menu-item" onclick="deleteMessageForEveryone(\''+messageId+'\')">🗑️ Удалить сообщение</div>';
    }
    
    if (isOwnMessage && messageType === 'text') {
        var safeText = (messageText || '').replace(/'/g, "\\'");
        menuHtml += '<div class="context-menu-item" onclick="editMessage(\''+messageId+'\', \''+escapeHtml(safeText)+'\')">✏️ Редактировать</div>';
    }
    
    menuHtml += '<div class="context-menu-item" onclick="showReactionsMenu(\''+messageId+'\')">😊 Поставить реакцию</div>';
    
    if (isGroupOrChannel && isAdmin) {
        menuHtml += '<div class="context-menu-item" onclick="pinMessage(\''+messageId+'\')">📌 Закрепить</div>';
    }
    
    menuHtml += '<div class="context-menu-item" onclick="openForwardDialog(\''+messageId+'\', \''+escapeHtml(messageText || '').replace(/'/g, "\\'")+'\', \''+(messageType || 'text')+'\', \''+(mediaUrl || '')+'\')">↗️ Переслать</div>';
    
    menuHtml += '<div class="context-menu-item" onclick="openChatUserProfile(\''+senderId+'\')">👤 Профиль пользователя</div>';
    
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    var x = event.clientX, y = event.clientY;
    if (event.touches) { 
        x = event.touches[0].clientX; 
        y = event.touches[0].clientY; 
    }
    
    var menuRect = menu.getBoundingClientRect();
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    if (x + menuRect.width > windowWidth) x = windowWidth - menuRect.width - 10;
    if (y + menuRect.height > windowHeight) y = windowHeight - menuRect.height - 10;
    if (x < 10) x = 10; if (y < 10) y = 10;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    
    setTimeout(function() {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

function deleteMessageForMe(messageId) {
    database.ref('messages/' + currentChatId + '/' + messageId).remove().then(function() {
        showNotification('Сообщение удалено', 'info');
        closeContextMenu();
    }).catch(function(err) { 
        showNotification('Ошибка удаления', 'error'); 
    });
}

function deleteMessageForEveryone(messageId) {
    if (!confirm('Удалить это сообщение у всех участников? Это действие необратимо.')) return;
    database.ref('messages/' + currentChatId + '/' + messageId).remove().then(function() {
        showNotification('Сообщение удалено у всех', 'success');
        closeContextMenu();
    }).catch(function(err) { 
        showNotification('Ошибка удаления', 'error'); 
    });
}

function editMessage(messageId, oldText) {
    var newText = prompt('Редактировать сообщение:', oldText);
    if (newText && newText.trim() && newText.trim() !== oldText) {
        database.ref('messages/' + currentChatId + '/' + messageId).update({
            text: newText.trim(),
            edited: true,
            editedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(function() {
            showNotification('Сообщение отредактировано', 'success');
            closeContextMenu();
        }).catch(function(err) { 
            showNotification('Ошибка редактирования', 'error'); 
        });
    }
}

// ========== РЕАКЦИИ ==========
function showReactionsMenu(messageId) {
    var reactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
    var reactionHtml = '<div style="padding:10px; display:flex; gap:12px; justify-content:center;">';
    reactions.forEach(function(r) {
        reactionHtml += '<span style="font-size:28px; cursor:pointer; padding:5px;" onclick="addReaction(\''+messageId+'\', \''+r+'\')">'+r+'</span>';
    });
    reactionHtml += '</div>';
    
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'reaction-modal';
    modal.style.zIndex = '10010';
    modal.innerHTML = '<div class="modal-content" style="max-width:300px;"><div class="modal-header"><h3>Выберите реакцию</h3><button onclick="closeReactionModal()" class="btn-close">×</button></div>' + reactionHtml + '</div>';
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    closeContextMenu();
}

function closeReactionModal() {
    var modal = document.getElementById('reaction-modal');
    if (modal) modal.remove();
}

function addReaction(messageId, reaction) {
    var reactionRef = database.ref('messages/' + currentChatId + '/' + messageId + '/reactions/' + currentUser.uid);
    reactionRef.set(reaction).then(function() {
        showNotification('Реакция добавлена', 'success');
        closeReactionModal();
    }).catch(function(err) { 
        showNotification('Ошибка', 'error'); 
    });
}

function pinMessage(messageId) {
    database.ref('chats/' + currentChatId + '/pinnedMessage').set(messageId).then(function() {
        showNotification('Сообщение закреплено', 'success');
        closeContextMenu();
    }).catch(function(err) { 
        showNotification('Ошибка', 'error'); 
    });
}

// ========== ПЕРЕСЫЛКА ==========
var forwardMessageData = null;

function openForwardDialog(messageId, text, type, mediaUrl) {
    forwardMessageData = { messageId: messageId, text: text, type: type, mediaUrl: mediaUrl };
    
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'forward-modal';
    modal.style.zIndex = '10011';
    modal.innerHTML = '<div class="modal-content" style="max-width:500px;"><div class="modal-header"><h3>Выберите получателей (макс. 5)</h3><button onclick="closeForwardModal()" class="btn-close">×</button></div><div id="forward-chats-list" class="users-list" style="max-height:400px; overflow-y:auto;">Загрузка...</div><div style="padding:15px; text-align:center;"><button onclick="sendForwardMessages()" class="btn-primary" style="background: #2196F3; width:auto; padding:10px 30px; border-radius:40px;">✓ Отправить</button></div></div>';
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    var selectedRecipients = [];
    var container = document.getElementById('forward-chats-list');
    container.innerHTML = '<div>Загрузка...</div>';
    
    database.ref('userChats/' + currentUser.uid).once('value').then(function(snapshot) {
        var userChats = snapshot.val();
        if (!userChats) { container.innerHTML = '<div>Нет доступных чатов</div>'; return; }
        
        var chatIds = Object.keys(userChats);
        var loadedChats = [];
        var count = 0;
        
        chatIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value').then(function(chatSnap) {
                var chat = chatSnap.val();
                if (chat) {
                    var name = '';
                    if (chat.type === 'group') name = chat.name || 'Группа';
                    else if (chat.type === 'channel') name = chat.name || 'Канал';
                    else {
                        var otherId = chat.participants.find(function(id) { return id !== currentUser.uid; });
                        if (otherId) {
                            getUsername(otherId).then(function(username) {
                                name = username;
                                loadedChats.push({ id: chatId, name: name, type: chat.type, avatar: chat.avatar });
                                if (loadedChats.length === chatIds.length) renderForwardList(loadedChats, selectedRecipients, container);
                            });
                        } else name = 'Пользователь';
                    }
                    if (name && !loadedChats.some(function(c) { return c.id === chatId; })) {
                        loadedChats.push({ id: chatId, name: name, type: chat.type, avatar: chat.avatar });
                    }
                }
                count++;
                if (count === chatIds.length && loadedChats.length === 0) {
                    container.innerHTML = '<div>Нет доступных чатов</div>';
                }
            });
        });
    });
}

function renderForwardList(chats, selectedRecipients, container) {
    container.innerHTML = '';
    chats.forEach(function(chat) {
        var isSelected = selectedRecipients.some(function(r) { return r.id === chat.id; });
        var div = document.createElement('div');
        div.className = 'user-item forward-item';
        div.setAttribute('data-chat-id', chat.id);
        div.style.cursor = 'pointer';
        var avatarHtml = '<div class="avatar">' + (chat.type === 'group' ? '👥' : (chat.type === 'channel' ? '📢' : '👤')) + '</div>';
        div.innerHTML = avatarHtml + '<div class="user-item-info"><h4>' + escapeHtml(chat.name) + '</h4><p>' + (chat.type === 'group' ? 'Группа' : (chat.type === 'channel' ? 'Канал' : 'Личный чат')) + '</p></div><span class="check-mark" style="color:#2196F3; font-size:20px;">' + (isSelected ? '✓' : '○') + '</span>';
        div.onclick = (function(chatId, chatName) {
            return function() {
                var index = selectedRecipients.findIndex(function(r) { return r.id === chatId; });
                if (index > -1) {
                    selectedRecipients.splice(index, 1);
                } else if (selectedRecipients.length < 5) {
                    selectedRecipients.push({ id: chatId, name: chatName });
                } else {
                    showNotification('Максимум 5 получателей', 'error');
                    return;
                }
                renderForwardList(chats, selectedRecipients, container);
            };
        })(chat.id, chat.name);
        container.appendChild(div);
    });
}

function closeForwardModal() {
    var modal = document.getElementById('forward-modal');
    if (modal) modal.remove();
    forwardMessageData = null;
}

function sendForwardMessages() {
    var selectedChatIds = [];
    document.querySelectorAll('#forward-chats-list .forward-item').forEach(function(item) {
        var checkSpan = item.querySelector('.check-mark');
        if (checkSpan && checkSpan.textContent === '✓') {
            var chatId = item.getAttribute('data-chat-id');
            if (chatId) selectedChatIds.push(chatId);
        }
    });
    
    if (selectedChatIds.length === 0) {
        showNotification('Выберите хотя бы одного получателя', 'error');
        return;
    }
    
    if (!forwardMessageData) return;
    
    var promises = [];
    selectedChatIds.forEach(function(chatId) {
        var newMessage = {
            type: forwardMessageData.type,
            text: forwardMessageData.text,
            senderId: currentUser.uid,
            forwarded: true,
            originalSender: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        if (forwardMessageData.mediaUrl && forwardMessageData.type === 'image') {
            newMessage.imageUrl = forwardMessageData.mediaUrl;
        }
        if (forwardMessageData.mediaUrl && forwardMessageData.type === 'gif') {
            newMessage.gifUrl = forwardMessageData.mediaUrl;
        }
        promises.push(database.ref('messages/' + chatId).push(newMessage));
        promises.push(database.ref('chats/' + chatId).update({ 
            lastMessage: '↗️ Пересланное сообщение', 
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP 
        }));
    });
    
    Promise.all(promises).then(function() {
        showNotification('Сообщение переслано ' + selectedChatIds.length + ' получателям', 'success');
        closeForwardModal();
        closeContextMenu();
    }).catch(function(err) {
        showNotification('Ошибка пересылки', 'error');
    });
}

function closeContextMenu() {
    var menu = document.getElementById('message-context-menu');
    if (menu) menu.remove();
}

// ========== ГРУППЫ И КАНАЛЫ ==========
function showCreateGroupDialog() {
    document.getElementById('create-group-modal').classList.remove('hidden');
    document.getElementById('group-step-1').classList.remove('hidden');
    document.getElementById('group-step-2').classList.add('hidden');
    document.getElementById('group-name').value = '';
    document.getElementById('group-description').value = '';
    document.getElementById('group-avatar-preview').style.backgroundImage = '';
    document.getElementById('group-avatar-preview').textContent = '👥';
    selectedGroupMembers = [];
}

function closeCreateGroupDialog() { 
    document.getElementById('create-group-modal').classList.add('hidden'); 
}

function goToGroupStep2() {
    var name = document.getElementById('group-name').value.trim();
    if (!name) { 
        showNotification('Введите название группы', 'error'); 
        return; 
    }
    document.getElementById('group-step-1').classList.add('hidden');
    document.getElementById('group-step-2').classList.remove('hidden');
    loadGroupMembersList();
}

function goToGroupStep1() {
    document.getElementById('group-step-2').classList.add('hidden');
    document.getElementById('group-step-1').classList.remove('hidden');
}

function loadGroupMembersList() {
    var list = document.getElementById('group-members-list');
    list.innerHTML = '<div class="loading-spinner">🔄 Загрузка...</div>';
    database.ref('contacts/' + currentUser.uid).once('value').then(function(snapshot) {
        var contacts = snapshot.val();
        if (!contacts) { 
            list.innerHTML = '<div>Нет контактов. Добавьте их через поиск</div>'; 
            return; 
        }
        var userIds = Object.keys(contacts);
        if (userIds.length === 0) { 
            list.innerHTML = '<div>Нет контактов</div>'; 
            return; 
        }
        list.innerHTML = '';
        var pending = userIds.length;
        
        userIds.forEach(function(uid) {
            database.ref('users/' + uid).once('value').then(function(userSnap) {
                var user = userSnap.val();
                if (!user) {
                    pending--;
                    return;
                }
                var isSelected = selectedGroupMembers.some(function(m) { return m.id === uid; });
                var div = document.createElement('div');
                div.className = 'user-item' + (isSelected ? ' selected' : '');
                div.setAttribute('data-username', (user.username || '').toLowerCase());
                var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                var avatarContent = user.avatar ? '' : '👤';
                div.innerHTML = '<div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><div class="user-item-info"><h4>'+escapeHtml(user.username)+'</h4></div><span class="check-mark">'+(isSelected ? '✓' : '')+'</span>';
                div.onclick = (function(uid, user) { 
                    return function() { toggleGroupMember(uid, user); }; 
                })(uid, user);
                list.appendChild(div);
                pending--;
            }).catch(function() { pending--; });
        });
    });
}

function toggleGroupMember(userId, user) {
    var index = selectedGroupMembers.findIndex(function(m) { return m.id === userId; });
    if (index > -1) selectedGroupMembers.splice(index, 1);
    else selectedGroupMembers.push({ id: userId, username: user.username, avatar: user.avatar });
    renderSelectedMembers();
    loadGroupMembersList();
}

function renderSelectedMembers() {
    var container = document.getElementById('selected-members');
    if (selectedGroupMembers.length === 0) { 
        container.innerHTML = ''; 
        return; 
    }
    var html = '';
    selectedGroupMembers.forEach(function(m) {
        html += '<div class="selected-member-chip"><span>'+escapeHtml(m.username)+'</span><button onclick="removeSelectedMember(\''+m.id+'\')">&times;</button></div>';
    });
    container.innerHTML = html;
}

function removeSelectedMember(userId) {
    selectedGroupMembers = selectedGroupMembers.filter(function(m) { return m.id !== userId; });
    renderSelectedMembers();
    loadGroupMembersList();
}

function searchGroupMembers() {
    var text = document.getElementById('group-members-search').value.toLowerCase();
    var items = document.querySelectorAll('#group-members-list .user-item');
    items.forEach(function(item) {
        var username = item.getAttribute('data-username') || '';
        item.style.display = username.indexOf(text) !== -1 ? 'flex' : 'none';
    });
}

function createGroup() {
    var name = document.getElementById('group-name').value.trim();
    var description = document.getElementById('group-description').value.trim();
    if (!name) { 
        showNotification('Введите название', 'error'); 
        return; 
    }
    var btn = document.querySelector('#group-step-2 .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Создание...';
    
    var avatarPromise = window.groupAvatarFile ? uploadToImgBB(window.groupAvatarFile) : Promise.resolve(null);
    avatarPromise.then(function(data) {
        var avatarUrl = data ? data : null;
        var chatId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        var members = { [currentUser.uid]: true };
        selectedGroupMembers.forEach(function(m) { members[m.id] = true; });
        return database.ref('chats/' + chatId).set({
            type: 'group', name: name, description: description, avatar: avatarUrl,
            members: members, admins: { [currentUser.uid]: true }, createdBy: currentUser.uid,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Группа создана', lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        }).then(function() {
            var promises = [database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true)];
            selectedGroupMembers.forEach(function(m) { 
                promises.push(database.ref('userChats/' + m.id + '/' + chatId).set(true)); 
            });
            return Promise.all(promises);
        });
    }).then(function() {
        closeCreateGroupDialog();
        showNotification('Группа "' + name + '" создана!', 'success');
        loadChats();
    }).catch(function(err) { 
        showNotification('Ошибка создания группы', 'error'); 
        console.error(err); 
    }).finally(function() { 
        btn.disabled = false; 
        btn.textContent = 'Создать группу'; 
        window.groupAvatarFile = null;
    });
}

function showCreateChannelDialog() {
    document.getElementById('create-channel-modal').classList.remove('hidden');
    document.getElementById('channel-name').value = '';
    document.getElementById('channel-description').value = '';
    document.getElementById('channel-link').value = '';
    document.getElementById('channel-avatar-preview').style.backgroundImage = '';
    document.getElementById('channel-avatar-preview').textContent = '📢';
    document.getElementById('channel-link-hint').textContent = '';
}

function closeCreateChannelDialog() { 
    document.getElementById('create-channel-modal').classList.add('hidden'); 
}

function validateChannelLink() {
    var link = document.getElementById('channel-link').value.trim().toLowerCase();
    var hint = document.getElementById('channel-link-hint');
    if (!link) { 
        hint.textContent = ''; 
        hint.className = 'hint'; 
        return true; 
    }
    if (!/^[a-z0-9_]+$/.test(link)) { 
        hint.textContent = 'Только латинские буквы, цифры и _'; 
        hint.className = 'hint error'; 
        return false; 
    }
    if (link.length < 3) { 
        hint.textContent = 'Минимум 3 символа'; 
        hint.className = 'hint error'; 
        return false; 
    }
    hint.textContent = '✓ Ссылка: ' + link; 
    hint.className = 'hint success';
    return true;
}

function createChannel() {
    var name = document.getElementById('channel-name').value.trim();
    var description = document.getElementById('channel-description').value.trim();
    var link = document.getElementById('channel-link').value.trim().toLowerCase();
    var typeRadio = document.querySelector('input[name="channel-type"]:checked');
    var isPublic = typeRadio ? typeRadio.value === 'public' : true;
    
    if (!name) { 
        showNotification('Введите название', 'error'); 
        return; 
    }
    if (link && !validateChannelLink()) return;
    
    var btn = document.querySelector('#create-channel-modal .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Создание...';
    
    var checkLinkPromise = link ? database.ref('channelLinks/' + link).once('value').then(function(snap) { 
        if (snap.exists()) throw new Error('Ссылка занята'); 
    }) : Promise.resolve();
    
    checkLinkPromise.then(function() {
        var avatarPromise = window.channelAvatarFile ? uploadToImgBB(window.channelAvatarFile) : Promise.resolve(null);
        return avatarPromise.then(function(data) {
            var avatarUrl = data ? data : '';
            var chatId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var updates = {
                type: 'channel', name: name, description: description, avatar: avatarUrl,
                link: link || null, isPublic: isPublic,
                subscribers: { [currentUser.uid]: true }, admins: { [currentUser.uid]: true },
                createdBy: currentUser.uid, createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: 'Канал создан', lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            };
            return database.ref('chats/' + chatId).set(updates)
                .then(function() { return database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true); })
                .then(function() { if (link) return database.ref('channelLinks/' + link).set(chatId); });
        });
    }).then(function() {
        closeCreateChannelDialog();
        showNotification('Канал "' + name + '" создан!', 'success');
        loadChats();
    }).catch(function(err) { 
        showNotification(err.message || 'Ошибка', 'error'); 
        console.error(err); 
    }).finally(function() { 
        btn.disabled = false; 
        btn.textContent = 'Создать канал'; 
        window.channelAvatarFile = null;
    });
}

function showChatInfo() {
    if (!currentChatUser) return;
    var modal = document.getElementById('chat-info-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    var chat = currentChatUser;
    var name = '', avatar = '', status = '', description = '';
    
    if (chat.type === 'group') {
        document.getElementById('info-title').textContent = 'Информация о группе';
        name = chat.name || 'Группа';
        avatar = chat.avatar || '';
        var membersCount = chat.members ? Object.keys(chat.members).length : 0;
        status = membersCount + ' участник(ов)';
        description = chat.description || '';
        document.getElementById('channel-stats').classList.add('hidden');
        document.getElementById('group-members-section').classList.remove('hidden');
        document.getElementById('members-count').textContent = membersCount;
        loadMembersList(chat.members, chat.admins);
        var isAdmin = chat.admins && chat.admins[currentUser.uid];
        document.getElementById('add-member-btn').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('leave-btn').classList.remove('hidden');
        document.getElementById('subscribe-btn').classList.add('hidden');
        document.getElementById('unsubscribe-btn').classList.add('hidden');
        document.getElementById('delete-btn').style.display = isAdmin ? 'flex' : 'none';
    } else if (chat.type === 'channel') {
        document.getElementById('info-title').textContent = 'Информация о канале';
        name = chat.name || 'Канал';
        avatar = chat.avatar || '';
        var subsCount = chat.subscribers ? Object.keys(chat.subscribers).length : 0;
        status = chat.isPublic ? 'Публичный канал' : 'Приватный канал';
        description = chat.description || '';
        document.getElementById('channel-stats').classList.remove('hidden');
        document.getElementById('subscribers-count').textContent = subsCount;
        document.getElementById('group-members-section').classList.add('hidden');
        var isSubscribed = chat.subscribers && chat.subscribers[currentUser.uid];
        var isChannelAdmin = chat.admins && chat.admins[currentUser.uid];
        document.getElementById('leave-btn').classList.add('hidden');
        document.getElementById('subscribe-btn').style.display = isSubscribed ? 'none' : 'flex';
        document.getElementById('unsubscribe-btn').style.display = (isSubscribed && !isChannelAdmin) ? 'flex' : 'none';
        document.getElementById('delete-btn').style.display = isChannelAdmin ? 'flex' : 'none';
    } else {
        document.getElementById('info-title').textContent = 'Информация';
        name = chat.otherUser ? chat.otherUser.username : 'Пользователь';
        avatar = chat.otherUser ? chat.otherUser.avatar : '';
        status = (chat.otherUser && chat.otherUser.status && chat.otherUser.status.online) ? 'в сети' : 'был(а) недавно';
        document.getElementById('channel-stats').classList.add('hidden');
        document.getElementById('group-members-section').classList.add('hidden');
        document.getElementById('leave-btn').classList.add('hidden');
        document.getElementById('subscribe-btn').classList.add('hidden');
        document.getElementById('unsubscribe-btn').classList.add('hidden');
        document.getElementById('delete-btn').style.display = 'flex';
    }
    
    document.getElementById('info-name').textContent = name;
    document.getElementById('info-status').textContent = status;
    document.getElementById('info-description').textContent = description || 'Нет описания';
    var infoAvatar = document.getElementById('info-avatar');
    if (avatar && avatar.indexOf('http') === 0) {
        infoAvatar.style.backgroundImage = 'url(' + avatar + ')';
        infoAvatar.style.backgroundSize = 'cover';
        infoAvatar.textContent = '';
    } else {
        infoAvatar.style.backgroundImage = '';
        infoAvatar.textContent = chat.type === 'group' ? '👥' : (chat.type === 'channel' ? '📢' : '👤');
    }
}

function closeChatInfo() { 
    var modal = document.getElementById('chat-info-modal');
    if (modal) modal.classList.add('hidden'); 
}

function loadMembersList(members, admins) {
    var list = document.getElementById('info-members-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-spinner">🔄 Загрузка...</div>';
    if (!members) {
        list.innerHTML = '<div>Нет участников</div>';
        return;
    }
    
    var memberIds = Object.keys(members);
    if (memberIds.length === 0) {
        list.innerHTML = '<div>Нет участников</div>';
        return;
    }
    
    list.innerHTML = '';
    var pending = memberIds.length;
    
    memberIds.forEach(function(memberId) {
        Promise.all([getUsername(memberId), getUserAvatar(memberId)]).then(function(results) {
            var userName = results[0];
            var userAvatar = results[1];
            var isAdmin = admins && admins[memberId];
            var avatarStyle = userAvatar ? 'background-image:url('+userAvatar+');background-size:cover;' : '';
            var avatarContent = userAvatar ? '' : '👤';
            var div = document.createElement('div');
            div.className = 'member-item';
            div.innerHTML = '<div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><span class="member-name" style="flex:1;">'+escapeHtml(userName)+'</span>'+(isAdmin ? '<span class="member-role">админ</span>' : '');
            list.appendChild(div);
            pending--;
        }).catch(function() { pending--; });
    });
}

function showAddMembersDialog() {
    document.getElementById('add-members-modal').classList.remove('hidden');
    document.getElementById('add-members-search').value = '';
    loadAddMembersList();
}

function closeAddMembersDialog() { 
    document.getElementById('add-members-modal').classList.add('hidden'); 
}

function loadAddMembersList() {
    var list = document.getElementById('add-members-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-spinner">🔄 Загрузка...</div>';
    var currentMembers = currentChatUser.members || {};
    
    database.ref('contacts/' + currentUser.uid).once('value').then(function(snapshot) {
        var contacts = snapshot.val();
        if (!contacts) { 
            list.innerHTML = '<div>Нет контактов для добавления</div>'; 
            return; 
        }
        var userIds = Object.keys(contacts).filter(function(uid) { return !currentMembers[uid]; });
        if (userIds.length === 0) {
            list.innerHTML = '<div>Нет доступных контактов для добавления</div>';
            return;
        }
        list.innerHTML = '';
        var pending = userIds.length;
        
        userIds.forEach(function(uid) {
            database.ref('users/' + uid).once('value').then(function(userSnap) {
                var user = userSnap.val();
                if (!user) {
                    pending--;
                    return;
                }
                var div = document.createElement('div');
                div.className = 'user-item';
                div.setAttribute('data-username', (user.username || '').toLowerCase());
                var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                var avatarContent = user.avatar ? '' : '👤';
                div.innerHTML = '<div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><div class="user-item-info"><h4>'+escapeHtml(user.username)+'</h4></div>';
                div.onclick = (function(uid) { 
                    return function() { addMemberToGroup(uid); }; 
                })(uid);
                list.appendChild(div);
                pending--;
            }).catch(function() { pending--; });
        });
    });
}

function addMemberToGroup(userId) {
    if (!currentChatId) return;
    database.ref('chats/' + currentChatId + '/members/' + userId).set(true)
        .then(function() { return database.ref('userChats/' + userId + '/' + currentChatId).set(true); })
        .then(function() { 
            showNotification('Участник добавлен', 'success'); 
            closeAddMembersDialog(); 
            return database.ref('chats/' + currentChatId).once('value'); 
        })
        .then(function(snap) { 
            currentChatUser = snap.val(); 
            currentChatUser.chatId = currentChatId; 
            showChatInfo(); 
        })
        .catch(function(err) { 
            showNotification('Ошибка', 'error'); 
        });
}

function searchAddMembers() {
    var text = document.getElementById('add-members-search').value.toLowerCase();
    var items = document.querySelectorAll('#add-members-list .user-item');
    items.forEach(function(item) {
        var username = item.getAttribute('data-username') || '';
        item.style.display = username.indexOf(text) !== -1 ? 'flex' : 'none';
    });
}

function subscribeToChannel() {
    if (!currentChatId) return;
    database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid).set(true)
        .then(function() { return database.ref('userChats/' + currentUser.uid + '/' + currentChatId).set(true); })
        .then(function() { 
            showNotification('Подписались', 'success'); 
            closeChatInfo(); 
            loadChats(); 
        })
        .catch(function(err) { 
            showNotification('Ошибка', 'error'); 
        });
}

function unsubscribeFromChannel() {
    if (!currentChatId) return;
    if (!confirm('Отписаться от канала?')) return;
    database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid).remove()
        .then(function() { return database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove(); })
        .then(function() { 
            showNotification('Отписались', 'info'); 
            closeChatInfo(); 
            closeChat(); 
            loadChats(); 
        })
        .catch(function(err) { 
            showNotification('Ошибка', 'error'); 
        });
}

function leaveChat() {
    if (!currentChatId) return;
    if (!confirm('Покинуть чат?')) return;
    var promise = (currentChatUser.type === 'group') ? database.ref('chats/' + currentChatId + '/members/' + currentUser.uid).remove() : Promise.resolve();
    promise.then(function() { 
        return database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove(); 
    }).then(function() { 
        showNotification('Вы покинули чат', 'info'); 
        closeChatInfo(); 
        closeChat(); 
        loadChats(); 
    }).catch(function(err) { 
        showNotification('Ошибка', 'error'); 
    });
}

function deleteChat() {
    if (!currentChatId) return;
    if (!confirm('Удалить чат? Это действие нельзя отменить.')) return;
    database.ref('chats/' + currentChatId).remove()
        .then(function() { return database.ref('messages/' + currentChatId).remove(); })
        .then(function() { return database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove(); })
        .then(function() { 
            showNotification('Чат удалён', 'info'); 
            closeChatInfo(); 
            closeChat(); 
            loadChats(); 
        })
        .catch(function(err) { 
            showNotification('Ошибка', 'error'); 
        });
}

// ========== СТИЛИ ==========
var chatStyles = document.createElement('style');
chatStyles.textContent = `
    .gif-message {
        position: relative;
        display: inline-block;
        cursor: pointer;
        border-radius: 16px;
        overflow: hidden;
        max-width: 280px;
    }
    .gif-image {
        width: 100%;
        max-height: 250px;
        object-fit: cover;
        display: block;
        border-radius: 16px;
        transition: transform 0.2s;
    }
    .gif-message:hover .gif-image {
        transform: scale(1.02);
    }
    .gif-badge {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: bold;
    }
    .message.sent .gif-badge {
        background: rgba(255, 255, 255, 0.3);
    }
    .context-menu-item {
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.1s;
        font-size: 14px;
    }
    .context-menu-item:hover {
        background: var(--background);
    }
    .message-avatar .avatar {
        width: 36px;
        height: 36px;
        font-size: 18px;
    }
    .loading-spinner {
        text-align: center;
        padding: 20px;
        color: var(--text-muted);
    }
    .add-contact-btn {
        background: var(--forest);
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 12px;
    }
    .member-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-bottom: 1px solid var(--border);
    }
    .member-role {
        font-size: 11px;
        background: var(--sage);
        padding: 2px 8px;
        border-radius: 12px;
        color: var(--text-dark);
    }
    @media (max-width: 768px) {
        .gif-message { max-width: 220px; }
        .gif-image { max-height: 200px; }
        .message-avatar .avatar { width: 32px; height: 32px; font-size: 16px; }
    }
`;
document.head.appendChild(chatStyles);

// Инициализация
initChatSounds();
function searchGlobalUsers() {
    const query = document.getElementById('global-search-input').value.toLowerCase();
    const container = document.getElementById('global-users-list');
    
    if (!query) {
        container.innerHTML = '<div>Введите имя или @юзернейм</div>';
        return;
    }
    
    database.ref('users').once('value').then(snapshot => {
        const users = snapshot.val();
        const results = [];
        
        for (let uid in users) {
            if (uid === currentUser.uid) continue;
            const user = users[uid];
            const username = (user.username || '').toLowerCase();
            const userTag = (user.userTag || '').toLowerCase();
            
            if (username.includes(query) || userTag.includes(query.replace('@', ''))) {
                results.push({ uid, ...user });
            }
        }
        
        renderGlobalSearchResults(results);
    });
}

function renderGlobalSearchResults(users) {
    const container = document.getElementById('global-users-list');
    if (!users.length) {
        container.innerHTML = '<div>Ничего не найдено</div>';
        return;
    }
    
    container.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
            <div class="avatar" style="background-image: url(${user.avatar || ''}); background-size: cover;">${!user.avatar ? '👤' : ''}</div>
            <div class="user-item-info">
                <h4>${escapeHtml(user.username)}</h4>
                <small style="color: var(--text-muted);">${escapeHtml(user.userTag || '@' + user.username.toLowerCase())}</small>
            </div>
            <button class="add-contact-btn" onclick="addToContacts('${user.uid}', '${escapeHtml(user.username)}')">➕ Добавить</button>
        `;
        container.appendChild(div);
    });
}
// ========== НОВЫЙ ГЛОБАЛЬНЫЙ ПОИСК ==========
let searchTimeoutNew = null;

function searchGlobalNew() {
    const query = document.getElementById('global-search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('global-search-results');
    const resultsList = document.getElementById('search-results-list');
    
    if (!query) {
        resultsContainer.style.display = 'none';
        return;
    }
    
    if (searchTimeoutNew) clearTimeout(searchTimeoutNew);
    searchTimeoutNew = setTimeout(() => {
        resultsContainer.style.display = 'flex';
        resultsList.innerHTML = '<div class="loading-spinner">🔍 Поиск...</div>';
        
        Promise.all([
            searchUsers(query),
            searchChatsGlobal(query),
            searchPublicChannelsGlobal(query)
        ]).then(([users, chats, channels]) => {
            renderSearchResults(users, chats, channels);
        });
    }, 300);
}

async function searchUsers(query) {
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

async function searchPublicChannelsGlobal(query) {
    const snapshot = await database.ref('chats').once('value');
    const chats = snapshot.val();
    const results = [];
    
    for (let chatId in chats) {
        const chat = chats[chatId];
        if (chat.type !== 'channel' || !chat.isPublic) continue;
        if (chat.subscribers?.[currentUser.uid]) continue;
        
        const name = (chat.name || '').toLowerCase();
        const kname = (chat.kname || '').toLowerCase();
        
        if (name.includes(query) || kname.includes(query)) {
            results.push({ type: 'publicChannel', chatId, data: chat });
        }
    }
    return results.slice(0, 20);
}

function renderSearchResults(users, chats, channels) {
    const container = document.getElementById('search-results-list');
    container.innerHTML = '';
    
    if (!users.length && !chats.length && !channels.length) {
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
    
    channels.forEach(channel => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="search-result-avatar" style="background-image: url(${channel.data.avatar || ''}); background-size: cover;">${!channel.data.avatar ? '📢' : ''}</div>
            <div class="search-result-info">
                <div class="search-result-name">${escapeHtml(channel.data.name)}</div>
                <div class="search-result-username">${channel.data.kname ? '@' + channel.data.kname : ''}</div>
            </div>
            <div class="search-result-badge">📢 Публичный канал</div>
        `;
        div.onclick = () => subscribeToPublicChannel(channel.chatId, channel.data);
        container.appendChild(div);
    });
}

function closeSearchResults() {
    document.getElementById('global-search-results').style.display = 'none';
    document.getElementById('global-search-input').value = '';
}

function openCreateMenu() {
    // TODO: открыть меню создания (канал, группа, чат)
    showNotification('Меню создания в разработке', 'info');
}
// ========== МЕНЮ СОЗДАНИЯ ==========
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
// ========== СОЗДАНИЕ КАНАЛА (МАСТЕР) ==========
let channelWizardData = {
    avatarFile: null,
    name: '',
    kname: '',
    description: '',
    isPublic: true,
    members: [],
    admins: [],
    commentsEnabled: true,
    category: 'food'
};

function openCreateChannelWizard() {
    closeCreateMenu();
    resetChannelWizard();
    document.getElementById('create-channel-wizard').classList.remove('hidden');
    document.getElementById('channel-step-1').style.display = 'block';
    document.getElementById('channel-step-2').style.display = 'none';
    document.getElementById('channel-step-3').style.display = 'none';
    updateWizardSteps(1);
    loadChannelContactsForWizard();
}

function closeChannelWizard() {
    document.getElementById('create-channel-wizard').classList.add('hidden');
    resetChannelWizard();
}

function resetChannelWizard() {
    channelWizardData = {
        avatarFile: null,
        name: '',
        kname: '',
        description: '',
        isPublic: true,
        members: [],
        admins: [],
        commentsEnabled: true,
        category: 'food'
    };
    document.getElementById('channel-wizard-name').value = '';
    document.getElementById('channel-wizard-kname').value = '';
    document.getElementById('channel-wizard-desc').value = '';
    document.querySelector('input[name="channel-wizard-type"][value="public"]').checked = true;
    document.getElementById('channel-comments-enabled').checked = true;
    document.getElementById('channel-category').value = 'food';
    document.getElementById('channel-wizard-avatar').style.backgroundImage = '';
    document.getElementById('channel-wizard-avatar').textContent = '📢';
    document.getElementById('channel-selected-members').innerHTML = '';
}

function updateWizardSteps(step) {
    const steps = document.querySelectorAll('.wizard-step');
    steps.forEach((s, i) => {
        if (i + 1 <= step) s.classList.add('active');
        else s.classList.remove('active');
    });
}

function goToChannelStep1() {
    document.getElementById('channel-step-1').style.display = 'block';
    document.getElementById('channel-step-2').style.display = 'none';
    document.getElementById('channel-step-3').style.display = 'none';
    updateWizardSteps(1);
}

function goToChannelStep2() {
    const name = document.getElementById('channel-wizard-name').value.trim();
    if (!name) {
        showNotification('Введите название канала', 'error');
        return;
    }
    channelWizardData.name = name;
    channelWizardData.kname = document.getElementById('channel-wizard-kname').value.trim().toLowerCase();
    channelWizardData.description = document.getElementById('channel-wizard-desc').value.trim();
    channelWizardData.isPublic = document.querySelector('input[name="channel-wizard-type"]:checked').value === 'public';
    
    document.getElementById('channel-step-1').style.display = 'none';
    document.getElementById('channel-step-2').style.display = 'block';
    document.getElementById('channel-step-3').style.display = 'none';
    updateWizardSteps(2);
    loadChannelContactsForWizard();
}

function goToChannelStep3() {
    document.getElementById('channel-step-1').style.display = 'none';
    document.getElementById('channel-step-2').style.display = 'none';
    document.getElementById('channel-step-3').style.display = 'block';
    updateWizardSteps(3);
}

function previewChannelWizardAvatar(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        channelWizardData.avatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('channel-wizard-avatar');
            preview.style.backgroundImage = `url(${e.target.result})`;
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function loadChannelContactsForWizard() {
    const list = document.getElementById('channel-wizard-members-list');
    list.innerHTML = '<div class="loading-spinner">Загрузка контактов...</div>';
    
    database.ref('contacts/' + currentUser.uid).once('value').then(snapshot => {
        const contacts = snapshot.val();
        if (!contacts) {
            list.innerHTML = '<div>Нет контактов</div>';
            return;
        }
        list.innerHTML = '';
        const userIds = Object.keys(contacts);
        
        userIds.forEach(uid => {
            database.ref('users/' + uid).once('value').then(userSnap => {
                const user = userSnap.val();
                if (!user) return;
                const isSelected = channelWizardData.members.includes(uid);
                const isAdmin = channelWizardData.admins.includes(uid);
                const div = document.createElement('div');
                div.className = 'user-item';
                div.innerHTML = `
                    <div class="avatar" style="background-image: url(${user.avatar || ''}); background-size: cover;">${!user.avatar ? '👤' : ''}</div>
                    <div class="user-item-info">
                        <h4>${escapeHtml(user.username)}</h4>
                        <small>${user.userTag ? '@' + user.userTag : ''}</small>
                    </div>
                    <button class="add-contact-btn" onclick="toggleChannelMember('${uid}')">${isSelected ? '✓' : '+'}</button>
                `;
                list.appendChild(div);
                
                if (isSelected) {
                    addChannelMemberToUI(uid, user.username, user.avatar);
                }
            });
        });
    });
}

function toggleChannelMember(uid) {
    const index = channelWizardData.members.indexOf(uid);
    if (index > -1) {
        channelWizardData.members.splice(index, 1);
        // Если был админом, убрать из админов
        const adminIndex = channelWizardData.admins.indexOf(uid);
        if (adminIndex > -1) channelWizardData.admins.splice(adminIndex, 1);
    } else {
        channelWizardData.members.push(uid);
    }
    loadChannelContactsForWizard();
}

function addChannelMemberToUI(uid, username, avatar) {
    const container = document.getElementById('channel-selected-members');
    const existing = document.querySelector(`.selected-member-chip[data-uid="${uid}"]`);
    if (existing) return;
    
    const chip = document.createElement('div');
    chip.className = 'selected-member-chip';
    chip.setAttribute('data-uid', uid);
    chip.innerHTML = `
        <span>${escapeHtml(username)}</span>
        <button class="make-admin-btn" onclick="makeChannelAdmin('${uid}')">👑</button>
        <button onclick="removeChannelMember('${uid}')">&times;</button>
    `;
    container.appendChild(chip);
}

function removeChannelMember(uid) {
    const index = channelWizardData.members.indexOf(uid);
    if (index > -1) channelWizardData.members.splice(index, 1);
    const adminIndex = channelWizardData.admins.indexOf(uid);
    if (adminIndex > -1) channelWizardData.admins.splice(adminIndex, 1);
    
    const chip = document.querySelector(`.selected-member-chip[data-uid="${uid}"]`);
    if (chip) chip.remove();
    loadChannelContactsForWizard();
}

function makeChannelAdmin(uid) {
    if (!channelWizardData.members.includes(uid)) {
        showNotification('Сначала добавьте участника', 'error');
        return;
    }
    if (!channelWizardData.admins.includes(uid)) {
        channelWizardData.admins.push(uid);
        showNotification('Администратор назначен', 'success');
    } else {
        const index = channelWizardData.admins.indexOf(uid);
        channelWizardData.admins.splice(index, 1);
        showNotification('Права администратора сняты', 'info');
    }
}

function searchChannelMembers() {
    const query = document.getElementById('channel-wizard-search').value.toLowerCase();
    const items = document.querySelectorAll('#channel-wizard-members-list .user-item');
    items.forEach(item => {
        const name = item.querySelector('h4')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

async function createChannelFinal() {
    channelWizardData.commentsEnabled = document.getElementById('channel-comments-enabled').checked;
    channelWizardData.category = document.getElementById('channel-category').value;
    
    showNotification('Создание канала...', 'info');
    
    let avatarUrl = '';
    if (channelWizardData.avatarFile) {
        try {
            avatarUrl = await uploadToImgBB(channelWizardData.avatarFile);
        } catch (err) {
            showNotification('Ошибка загрузки аватарки', 'error');
        }
    }
    
    const chatId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const channelData = {
        type: 'channel',
        name: channelWizardData.name,
        kname: channelWizardData.kname || null,
        description: channelWizardData.description,
        avatar: avatarUrl || '',
        isPublic: channelWizardData.isPublic,
        commentsEnabled: channelWizardData.commentsEnabled,
        category: channelWizardData.category,
        subscribers: { [currentUser.uid]: true },
        admins: { [currentUser.uid]: true },
        members: { [currentUser.uid]: true },
        createdBy: currentUser.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastMessage: 'Канал создан',
        lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
        pinnedMessage: null
    };
    
    // Добавляем участников и админов
    channelWizardData.members.forEach(uid => {
        channelData.subscribers[uid] = true;
        channelData.members[uid] = true;
    });
    channelWizardData.admins.forEach(uid => {
        channelData.admins[uid] = true;
    });
    
    try {
        await database.ref('chats/' + chatId).set(channelData);
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        
        for (const uid of channelWizardData.members) {
            await database.ref('userChats/' + uid + '/' + chatId).set(true);
        }
        
        if (channelWizardData.kname) {
            await database.ref('channelKnames/' + channelWizardData.kname).set(chatId);
        }
        
        showNotification('Канал "' + channelWizardData.name + '" создан!', 'success');
        closeChannelWizard();
        loadChats();
        setTimeout(() => {
            database.ref('chats/' + chatId).once('value').then(snap => {
                openChat(chatId, snap.val());
            });
        }, 500);
    } catch (err) {
        console.error(err);
        showNotification('Ошибка создания канала', 'error');
    }
}
// ========== СОЗДАНИЕ ГРУППЫ (МАСТЕР) ==========
let groupWizardData = {
    avatarFile: null,
    name: '',
    kname: '',
    description: '',
    isPublic: true,
    members: [],
    admins: []
};

function openCreateGroupWizard() {
    closeCreateMenu();
    resetGroupWizard();
    document.getElementById('create-group-wizard').classList.remove('hidden');
    document.getElementById('group-step-1-content').style.display = 'block';
    document.getElementById('group-step-2-content').style.display = 'none';
    updateGroupWizardSteps(1);
    loadGroupContactsForWizard();
}

function closeGroupWizard() {
    document.getElementById('create-group-wizard').classList.add('hidden');
    resetGroupWizard();
}

function resetGroupWizard() {
    groupWizardData = {
        avatarFile: null,
        name: '',
        kname: '',
        description: '',
        isPublic: true,
        members: [],
        admins: []
    };
    document.getElementById('group-wizard-name').value = '';
    document.getElementById('group-wizard-kname').value = '';
    document.getElementById('group-wizard-desc').value = '';
    document.querySelector('input[name="group-wizard-type"][value="public"]').checked = true;
    document.getElementById('group-wizard-avatar').style.backgroundImage = '';
    document.getElementById('group-wizard-avatar').textContent = '👥';
    document.getElementById('group-selected-members').innerHTML = '';
}

function updateGroupWizardSteps(step) {
    const steps = document.querySelectorAll('#create-group-wizard .wizard-step');
    steps.forEach((s, i) => {
        if (i + 1 <= step) s.classList.add('active');
        else s.classList.remove('active');
    });
}

function goToGroupStep1() {
    document.getElementById('group-step-1-content').style.display = 'block';
    document.getElementById('group-step-2-content').style.display = 'none';
    updateGroupWizardSteps(1);
}

function goToGroupStep2() {
    const name = document.getElementById('group-wizard-name').value.trim();
    if (!name) {
        showNotification('Введите название группы', 'error');
        return;
    }
    groupWizardData.name = name;
    groupWizardData.kname = document.getElementById('group-wizard-kname').value.trim().toLowerCase();
    groupWizardData.description = document.getElementById('group-wizard-desc').value.trim();
    groupWizardData.isPublic = document.querySelector('input[name="group-wizard-type"]:checked').value === 'public';
    
    document.getElementById('group-step-1-content').style.display = 'none';
    document.getElementById('group-step-2-content').style.display = 'block';
    updateGroupWizardSteps(2);
    loadGroupContactsForWizard();
}

function previewGroupWizardAvatar(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        groupWizardData.avatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('group-wizard-avatar');
            preview.style.backgroundImage = `url(${e.target.result})`;
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function loadGroupContactsForWizard() {
    const list = document.getElementById('group-wizard-members-list');
    list.innerHTML = '<div class="loading-spinner">Загрузка контактов...</div>';
    
    database.ref('contacts/' + currentUser.uid).once('value').then(snapshot => {
        const contacts = snapshot.val();
        if (!contacts) {
            list.innerHTML = '<div>Нет контактов</div>';
            return;
        }
        list.innerHTML = '';
        const userIds = Object.keys(contacts);
        
        userIds.forEach(uid => {
            database.ref('users/' + uid).once('value').then(userSnap => {
                const user = userSnap.val();
                if (!user) return;
                const isSelected = groupWizardData.members.includes(uid);
                const div = document.createElement('div');
                div.className = 'user-item';
                div.innerHTML = `
                    <div class="avatar" style="background-image: url(${user.avatar || ''}); background-size: cover;">${!user.avatar ? '👤' : ''}</div>
                    <div class="user-item-info">
                        <h4>${escapeHtml(user.username)}</h4>
                        <small>${user.userTag ? '@' + user.userTag : ''}</small>
                    </div>
                    <button class="add-contact-btn" onclick="toggleGroupWizardMember('${uid}')">${isSelected ? '✓' : '+'}</button>
                `;
                list.appendChild(div);
                
                if (isSelected) {
                    addGroupMemberToUI(uid, user.username, user.avatar);
                }
            });
        });
    });
}

function toggleGroupWizardMember(uid) {
    const index = groupWizardData.members.indexOf(uid);
    if (index > -1) {
        groupWizardData.members.splice(index, 1);
        const adminIndex = groupWizardData.admins.indexOf(uid);
        if (adminIndex > -1) groupWizardData.admins.splice(adminIndex, 1);
    } else {
        groupWizardData.members.push(uid);
    }
    loadGroupContactsForWizard();
}

function addGroupMemberToUI(uid, username, avatar) {
    const container = document.getElementById('group-selected-members');
    const existing = document.querySelector(`.selected-member-chip[data-uid="${uid}"]`);
    if (existing) return;
    
    const chip = document.createElement('div');
    chip.className = 'selected-member-chip';
    chip.setAttribute('data-uid', uid);
    chip.innerHTML = `
        <span>${escapeHtml(username)}</span>
        <button class="make-admin-btn" onclick="makeGroupWizardAdmin('${uid}')">👑</button>
        <button onclick="removeGroupWizardMember('${uid}')">&times;</button>
    `;
    container.appendChild(chip);
}

function removeGroupWizardMember(uid) {
    const index = groupWizardData.members.indexOf(uid);
    if (index > -1) groupWizardData.members.splice(index, 1);
    const adminIndex = groupWizardData.admins.indexOf(uid);
    if (adminIndex > -1) groupWizardData.admins.splice(adminIndex, 1);
    
    const chip = document.querySelector(`.selected-member-chip[data-uid="${uid}"]`);
    if (chip) chip.remove();
    loadGroupContactsForWizard();
}

function makeGroupWizardAdmin(uid) {
    if (!groupWizardData.members.includes(uid)) {
        showNotification('Сначала добавьте участника', 'error');
        return;
    }
    if (!groupWizardData.admins.includes(uid)) {
        groupWizardData.admins.push(uid);
        showNotification('Администратор назначен', 'success');
    } else {
        const index = groupWizardData.admins.indexOf(uid);
        groupWizardData.admins.splice(index, 1);
        showNotification('Права администратора сняты', 'info');
    }
}

function searchGroupWizardMembers() {
    const query = document.getElementById('group-wizard-search').value.toLowerCase();
    const items = document.querySelectorAll('#group-wizard-members-list .user-item');
    items.forEach(item => {
        const name = item.querySelector('h4')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

async function createGroupFinal() {
    showNotification('Создание группы...', 'info');
    
    let avatarUrl = '';
    if (groupWizardData.avatarFile) {
        try {
            avatarUrl = await uploadToImgBB(groupWizardData.avatarFile);
        } catch (err) {
            showNotification('Ошибка загрузки аватарки', 'error');
        }
    }
    
    const chatId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const groupData = {
        type: 'group',
        name: groupWizardData.name,
        kname: groupWizardData.kname || null,
        description: groupWizardData.description,
        avatar: avatarUrl || '',
        isPublic: groupWizardData.isPublic,
        members: { [currentUser.uid]: true },
        admins: { [currentUser.uid]: true },
        createdBy: currentUser.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastMessage: 'Группа создана',
        lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
        pinnedMessage: null
    };
    
    // Добавляем участников и админов
    groupWizardData.members.forEach(uid => {
        groupData.members[uid] = true;
    });
    groupWizardData.admins.forEach(uid => {
        groupData.admins[uid] = true;
    });
    
    try {
        await database.ref('chats/' + chatId).set(groupData);
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        
        for (const uid of groupWizardData.members) {
            await database.ref('userChats/' + uid + '/' + chatId).set(true);
        }
        
        if (groupWizardData.kname) {
            await database.ref('groupKnames/' + groupWizardData.kname).set(chatId);
        }
        
        showNotification('Группа "' + groupWizardData.name + '" создана!', 'success');
        closeGroupWizard();
        loadChats();
        setTimeout(() => {
            database.ref('chats/' + chatId).once('value').then(snap => {
                openChat(chatId, snap.val());
            });
        }, 500);
    } catch (err) {
        console.error(err);
        showNotification('Ошибка создания группы', 'error');
    }
}

// ========== ПРОФИЛЬ КАНАЛА/ГРУППЫ ==========
let currentChannelProfileId = null;
let currentChannelProfileData = null;

function openChannelProfile(chatId) {
    currentChannelProfileId = chatId;
    
    database.ref('chats/' + chatId).once('value').then(snapshot => {
        const chat = snapshot.val();
        if (!chat) return;
        
        currentChannelProfileData = chat;
        const isChannel = chat.type === 'channel';
        const isGroup = chat.type === 'group';
        const isAdmin = chat.admins && chat.admins[currentUser.uid];
        const isOwner = chat.createdBy === currentUser.uid;
        const isSubscribed = chat.subscribers && chat.subscribers[currentUser.uid];
        const isMember = chat.members && chat.members[currentUser.uid];
        
        // ⚠️ ПРОВЕРКА: существует ли модальное окно в DOM?
        const modal = document.getElementById('channel-profile-modal');
        if (!modal) {
            console.error('Ошибка: channel-profile-modal не найден в DOM');
            showNotification('Ошибка: окно профиля не найдено', 'error');
            return;
        }
        
        // Заполняем данные с ПРОВЕРКАМИ
        const nameEl = document.getElementById('channel-profile-name');
        const knameEl = document.getElementById('channel-profile-kname');
        const descEl = document.getElementById('channel-profile-desc');
        const typeEl = document.getElementById('channel-profile-type');
        const statsEl = document.getElementById('channel-profile-stats');
        const avatarDiv = document.getElementById('channel-profile-avatar');
        const bannerDiv = document.getElementById('channel-profile-banner');
        
        if (nameEl) nameEl.textContent = chat.name || (isChannel ? 'Канал' : 'Группа');
        if (knameEl) knameEl.textContent = chat.kname ? '@' + chat.kname : '';
        if (descEl) descEl.textContent = chat.description || 'Нет описания';
        if (typeEl) typeEl.textContent = isChannel ? (chat.isPublic ? '🌍 Публичный канал' : '🔒 Приватный канал') : (chat.isPublic ? '🌍 Публичная группа' : '🔒 Приватная группа');
        
        const membersCount = Object.keys(chat.subscribers || chat.members || {}).length;
        if (statsEl) statsEl.textContent = isChannel ? `👥 ${membersCount} подписчиков` : `👥 ${membersCount} участников`;
        
        // Аватар
        if (avatarDiv) {
            if (chat.avatar) {
                avatarDiv.style.backgroundImage = `url(${chat.avatar})`;
                avatarDiv.style.backgroundSize = 'cover';
                avatarDiv.textContent = '';
            } else {
                avatarDiv.style.backgroundImage = '';
                avatarDiv.textContent = isChannel ? '📢' : '👥';
            }
        }
        
        // Баннер
        if (bannerDiv) {
            if (chat.banner) {
                if (chat.banner.startsWith('#')) {
                    bannerDiv.style.background = chat.banner;
                    bannerDiv.style.backgroundImage = 'none';
                } else {
                    bannerDiv.style.backgroundImage = `url(${chat.banner})`;
                    bannerDiv.style.backgroundSize = 'cover';
                    bannerDiv.style.backgroundPosition = 'center';
                }
            } else {
                bannerDiv.style.background = 'linear-gradient(135deg, #228B22, #556B2F)';
                bannerDiv.style.backgroundImage = 'none';
            }
        }
        
        // Кнопки действий
        const subscribeBtn = document.getElementById('channel-subscribe-btn');
        const unsubscribeBtn = document.getElementById('channel-unsubscribe-btn');
        const leaveBtn = document.getElementById('channel-leave-btn');
        
        if (subscribeBtn) subscribeBtn.style.display = 'none';
        if (unsubscribeBtn) unsubscribeBtn.style.display = 'none';
        if (leaveBtn) leaveBtn.style.display = 'none';
        
        if (isChannel) {
            if (isSubscribed && !isAdmin && unsubscribeBtn) {
                unsubscribeBtn.style.display = 'flex';
                unsubscribeBtn.textContent = 'Отписаться';
                unsubscribeBtn.onclick = () => unsubscribeFromChannel(chatId);
            } else if (!isSubscribed && !isAdmin && subscribeBtn) {
                subscribeBtn.style.display = 'flex';
                subscribeBtn.textContent = 'Подписаться';
                subscribeBtn.onclick = () => subscribeToChannel(chatId);
            }
        } else {
            if (isMember && !isAdmin && leaveBtn) {
                leaveBtn.style.display = 'flex';
                leaveBtn.textContent = 'Покинуть группу';
                leaveBtn.onclick = () => leaveGroup(chatId);
            } else if (!isMember && !isAdmin && subscribeBtn) {
                subscribeBtn.style.display = 'flex';
                subscribeBtn.textContent = 'Вступить';
                subscribeBtn.onclick = () => joinGroup(chatId);
            }
        }
        
        // Вкладка админа
        const adminTab = document.getElementById('channel-admin-tab');
        const bannerEditBtn = document.getElementById('channel-banner-edit');
        const avatarEditBtn = document.getElementById('channel-avatar-edit');
        
        if (isAdmin || isOwner) {
            if (adminTab) adminTab.style.display = 'flex';
            if (bannerEditBtn) bannerEditBtn.style.display = 'flex';
            if (avatarEditBtn) avatarEditBtn.style.display = 'flex';
            if (bannerEditBtn) bannerEditBtn.onclick = () => editChannelBanner(chatId);
            if (avatarEditBtn) avatarEditBtn.onclick = () => editChannelAvatar(chatId);
        } else {
            if (adminTab) adminTab.style.display = 'none';
            if (bannerEditBtn) bannerEditBtn.style.display = 'none';
            if (avatarEditBtn) avatarEditBtn.style.display = 'none';
        }
        
        // Открываем модальное окно
        modal.classList.remove('hidden');
        
        // Загружаем вкладку "Посты"
        switchChannelTab('posts');
    }).catch(err => {
        console.error('Ошибка загрузки профиля канала:', err);
        showNotification('Ошибка загрузки профиля', 'error');
    });
}
function closeChannelProfile() {
    document.getElementById('channel-profile-modal').classList.add('hidden');
}

function switchChannelTab(tab) {
    const content = document.getElementById('channel-profile-content');
    if (!content) return;
    
    const btns = document.querySelectorAll('#channel-profile-modal .profile-tab-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    
    // Отмечаем активную вкладку
    if (tab === 'posts' && btns[0]) btns[0].classList.add('active');
    else if (tab === 'members' && btns[1]) btns[1].classList.add('active');
    else if (tab === 'admin' && btns[2]) btns[2].classList.add('active');
    
    content.innerHTML = '<div class="profile-loading">Загрузка...</div>';
    
    if (tab === 'posts') {
        loadChannelPosts(content);
    } else if (tab === 'members') {
        loadChannelMembers(content);
    } else if (tab === 'admin') {
        loadChannelAdminPanel(content);
    }
}
function loadChannelPosts(container) {
    database.ref('slices').orderByChild('channelId').equalTo(currentChannelProfileId).once('value', snapshot => {
        const slices = snapshot.val();
        container.innerHTML = '';
        if (!slices) {
            container.innerHTML = '<div class="profile-empty">Нет постов</div>';
            return;
        }
        const posts = Object.entries(slices).map(([id, data]) => ({id, data}));
        posts.sort((a,b) => (b.data.createdAt||0) - (a.data.createdAt||0));
        posts.forEach(post => {
            container.appendChild(createSliceCard(post.id, post.data));
        });
    });
}

function loadChannelMembers(container) {
    database.ref('chats/' + currentChannelProfileId).once('value', snapshot => {
        const chat = snapshot.val();
        const members = chat.subscribers || chat.members || {};
        
        const memberIds = Object.keys(members);
        if (memberIds.length === 0) {
            container.innerHTML = '<div class="profile-empty">Нет участников</div>';
            return;
        }
        
        container.innerHTML = '';
        memberIds.forEach(uid => {
            database.ref('users/' + uid).once('value', userSnap => {
                const user = userSnap.val();
                if (!user) return;
                const div = document.createElement('div');
                div.className = 'member-item';
                div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px solid var(--border);';
                div.innerHTML = `
                    <div class="avatar" style="background-image: url(${user.avatar || ''}); background-size: cover; width:40px; height:40px;">${!user.avatar ? '👤' : ''}</div>
                    <div style="flex:1;"><strong>${escapeHtml(user.username)}</strong></div>
                `;
                container.appendChild(div);
            });
        });
    });
}

function loadChannelAdminPanel(container) {
    database.ref('chats/' + currentChannelProfileId).once('value', snapshot => {
        const chat = snapshot.val();
        const isOwner = chat.createdBy === currentUser.uid;
        
        container.innerHTML = `
            <div class="admin-panel">
                <div class="setting-item" onclick="editChannelInfo()">
                    <span>✏️ Редактировать название и описание</span>
                    <span>›</span>
                </div>
                <div class="setting-item" onclick="changeChannelBanner()">
                    <span>🎨 Изменить баннер</span>
                    <span>›</span>
                </div>
                <div class="setting-item" onclick="changeChannelAvatar()">
                    <span>🖼️ Изменить аватарку</span>
                    <span>›</span>
                </div>
                <div class="setting-item">
                    <span>💬 Комментарии</span>
                    <label class="switch">
                        <input type="checkbox" id="channel-comments-toggle" ${chat.commentsEnabled !== false ? 'checked' : ''} onchange="toggleChannelComments(this.checked)">
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="setting-item" onclick="manageChannelAdmins()">
                    <span>👑 Управление администраторами</span>
                    <span>›</span>
                </div>
                <div class="setting-item" onclick="generateChannelInviteLink()">
                    <span>🔗 Ссылка-приглашение</span>
                    <span>›</span>
                </div>
                ${isOwner ? `
                    <div class="setting-item" onclick="transferChannelOwnership()">
                        <span>📤 Передать права владельца</span>
                        <span>›</span>
                    </div>
                    <div class="setting-item danger" onclick="deleteChannel()">
                        <span>🗑️ Удалить ${chat.type === 'channel' ? 'канал' : 'группу'}</span>
                    </div>
                ` : ''}
            </div>
        `;
    });
}

// Вспомогательные функции
function subscribeToChannel(chatId) {
    database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true)
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true))
        .then(() => {
            showNotification('Вы подписались на канал!', 'success');
            closeChannelProfile();
            openChannelProfile(chatId);
        });
}

function unsubscribeFromChannel(chatId) {
    if (!confirm('Отписаться от канала?')) return;
    database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).remove()
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).remove())
        .then(() => {
            showNotification('Вы отписались', 'info');
            closeChannelProfile();
            loadChats();
        });
}

function joinGroup(chatId) {
    database.ref('chats/' + chatId + '/members/' + currentUser.uid).set(true)
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true))
        .then(() => {
            showNotification('Вы вступили в группу!', 'success');
            closeChannelProfile();
            openChannelProfile(chatId);
        });
}

function leaveGroup(chatId) {
    if (!confirm('Покинуть группу?')) return;
    database.ref('chats/' + chatId + '/members/' + currentUser.uid).remove()
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).remove())
        .then(() => {
            showNotification('Вы покинули группу', 'info');
            closeChannelProfile();
            closeChat();
            loadChats();
        });
}
// chat.js - добавьте в конец файла
// chat.js - замените существующую функцию на эту
function openChannelOrGroupProfile() {
    if (!currentChatId || !currentChatUser) {
        showNotification('Чат не выбран', 'error');
        return;
    }
    
    // Открываем красивый профиль канала/группы
    if (typeof openChannelProfile === 'function') {
        openChannelProfile(currentChatId);
    } else {
        // fallback - старое окно
        var modal = document.getElementById('chat-info-modal');
        if (modal) {
            showChatInfo();
        } else {
            showNotification('Информация о чате: ' + (currentChatUser.name || 'Чат'), 'info');
        }
    }
}
// chat.js - добавьте в самый конец файла (после openChannelOrGroupProfile)

// Заглушка для createSliceCard, если функция не загружена из slices.js
if (typeof createSliceCard === 'undefined') {
    window.createSliceCard = function(sliceId, sliceData) {
        const div = document.createElement('div');
        div.className = 'slice-card profile-slice-card';
        div.setAttribute('data-slice-id', sliceId);
        
        const avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
        const avatarContent = sliceData.authorAvatar ? '' : '👤';
        
        let mediaHtml = '';
        if (sliceData.mediaUrl) {
            mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-image" style="max-width:100%; max-height:300px; object-fit:contain;"></div>';
        }
        
        const textHtml = sliceData.text ? '<div class="slice-text">'+escapeHtml(sliceData.text)+'</div>' : '';
        
        div.innerHTML = `
            <div class="slice-header">
                <div class="slice-author">
                    <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                    <div class="slice-author-info">
                        <span class="slice-author-name">${escapeHtml(sliceData.authorName)}</span>
                        <span class="slice-date">${formatSliceDate ? formatSliceDate(sliceData.createdAt) : ''}</span>
                    </div>
                </div>
            </div>
            ${mediaHtml}
            ${textHtml}
        `;
        return div;
    };
}

// Форматирование даты для слайсов (если нет в slices.js)
if (typeof formatSliceDate === 'undefined') {
    window.formatSliceDate = function(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'только что';
        if (diff < 3600) return Math.floor(diff/60) + ' мин назад';
        if (diff < 86400) return 'сегодня';
        return date.toLocaleDateString('ru-RU');
    };
}

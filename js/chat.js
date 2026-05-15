// KUKUMBER MESSENGER - CHAT.JS (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ)

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var selectedGroupMembers = [];
var typingTimeout = null;
var loadedMessageIds = new Set();
var messagesListener = null;
var usernameCache = {};
var userAvatarCache = {};
var userStatusCache = {};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
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

function getUserStatus(userId) {
    return new Promise(function(resolve) {
        if (userStatusCache[userId] && (Date.now() - userStatusCache[userId].time) < 15000) {
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

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== ЗАГРУЗКА ЧАТОВ ==========
function loadChats() {
    if (!currentUser) return;
    
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) return;
    
    if (window.chatsListener) {
        window.chatsListener.off();
    }
    
    chatsList.innerHTML = '<div class="empty-chats"><div>🔄 Загрузка чатов...</div></div>';
    
    window.chatsListener = database.ref('userChats/' + currentUser.uid);
    window.chatsListener.on('value', function(snapshot) {
        var chatsData = snapshot.val();
        
        if (!chatsData) { 
            chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>'; 
            return; 
        }
        
        var chatIds = Object.keys(chatsData);
        var loadedChats = [];
        var count = 0;
        
        if (chatIds.length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>';
            return;
        }
        
        chatIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value').then(function(chatSnap) {
                var chatData = chatSnap.val();
                if (chatData) {
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
    
    chats.sort(function(a, b) { 
        return (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0); 
    });
    
    chatsList.innerHTML = '';
    
    if (chats.length === 0) { 
        chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>'; 
        return; 
    }
    
    chats.forEach(function(chat) {
        createChatItem(chat.chatId, chat.data);
    });
}

function createChatItem(chatId, chatData) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    if (currentChatId === chatId) div.classList.add('active');
    
    if (chatData.type === 'group') {
        var name = chatData.name || 'Группа';
        var avatar = chatData.avatar || '';
        var badge = '<span class="chat-type-badge">👥</span>';
        finishCreate(name, avatar, badge, false);
    } else if (chatData.type === 'channel') {
        var name = chatData.name || 'Канал';
        var avatar = chatData.avatar || '';
        var badge = '<span class="chat-type-badge">📢</span>';
        finishCreate(name, avatar, badge, false);
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
                var name = results[0];
                var avatar = results[1];
                var isOnline = results[2].online === true;
                chatData.otherUserId = otherUserId;
                if (!chatData.otherUser) chatData.otherUser = {};
                chatData.otherUser.username = name;
                chatData.otherUser.avatar = avatar;
                finishCreate(name, avatar, '', isOnline);
            });
        } else {
            finishCreate('Пользователь', '', '', false);
        }
        return;
    }
    
    function finishCreate(name, avatar, badge, isOnline) {
        var avatarStyle = (avatar && avatar.indexOf('http') === 0) ? 'background-image:url('+avatar+');background-size:cover;' : '';
        var avatarContent = (!avatar || avatar.indexOf('http') !== 0) ? (badge ? (badge.includes('👥') ? '👥' : '📢') : '👤') : '';
        var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
        var preview = chatData.lastMessage || 'Нет сообщений';
        if (preview.length > 50) preview = preview.substring(0, 47) + '...';
        
        div.innerHTML = '<div class="chat-item-avatar"><div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div>'+(isOnline?'<div class="online-indicator"></div>':'')+badge+'</div><div class="chat-item-info"><div class="chat-item-header"><span class="chat-item-name">'+escapeHtml(name)+'</span><span class="chat-item-time">'+time+'</span></div><div class="chat-item-preview">'+escapeHtml(preview)+'</div></div>';
        div.onclick = function() { openChat(chatId, chatData); };
        var chatsList = document.getElementById('chats-list');
        if (chatsList) chatsList.appendChild(div);
    }
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(chatId, chatData) {
    console.log('openChat:', chatId);
    
    // Закрываем боковое меню
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    
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
    currentChatId = chatId;
    currentChatUser = chatData;
    currentChatUser.chatId = chatId;
    
    // Показываем активный чат
    var noChatEl = document.getElementById('no-chat-selected');
    var activeChatEl = document.getElementById('active-chat');
    if (noChatEl) noChatEl.classList.add('hidden');
    if (activeChatEl) activeChatEl.classList.remove('hidden');
    
    // Настройка UI в зависимости от типа чата
    var messageInputArea = document.getElementById('message-input-area');
    var channelFooter = document.getElementById('channel-footer');
    var callBtns = document.querySelectorAll('.call-btn');
    
    if (chatData.type === 'group') {
        document.getElementById('chat-username').textContent = chatData.name || 'Группа';
        var membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
        document.getElementById('chat-status').textContent = membersCount + ' участников';
        if (messageInputArea) messageInputArea.classList.remove('hidden');
        if (channelFooter) channelFooter.classList.add('hidden');
        callBtns.forEach(function(btn) { if (btn) btn.style.display = 'none'; });
        
        var avatar = chatData.avatar || '';
        var chatAvatar = document.getElementById('chat-avatar');
        if (avatar && avatar.indexOf('http') === 0) {
            chatAvatar.style.backgroundImage = 'url(' + avatar + ')';
            chatAvatar.style.backgroundSize = 'cover';
            chatAvatar.textContent = '';
        } else {
            chatAvatar.style.backgroundImage = '';
            chatAvatar.textContent = '👥';
        }
    } else if (chatData.type === 'channel') {
        document.getElementById('chat-username').textContent = chatData.name || 'Канал';
        var subsCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
        document.getElementById('chat-status').textContent = subsCount + ' подписчиков';
        var isAdmin = chatData.admins && chatData.admins[currentUser.uid];
        if (messageInputArea) {
            if (isAdmin) messageInputArea.classList.remove('hidden');
            else messageInputArea.classList.add('hidden');
        }
        if (channelFooter) {
            if (isAdmin) channelFooter.classList.add('hidden');
            else channelFooter.classList.remove('hidden');
        }
        callBtns.forEach(function(btn) { if (btn) btn.style.display = 'none'; });
        
        var avatar = chatData.avatar || '';
        var chatAvatar = document.getElementById('chat-avatar');
        if (avatar && avatar.indexOf('http') === 0) {
            chatAvatar.style.backgroundImage = 'url(' + avatar + ')';
            chatAvatar.style.backgroundSize = 'cover';
            chatAvatar.textContent = '';
        } else {
            chatAvatar.style.backgroundImage = '';
            chatAvatar.textContent = '📢';
        }
    } else {
        // ПРИВАТНЫЙ ЧАТ
        if (messageInputArea) messageInputArea.classList.remove('hidden');
        if (channelFooter) channelFooter.classList.add('hidden');
        callBtns.forEach(function(btn) { if (btn) btn.style.display = 'inline-flex'; });
        
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
            
            Promise.all([getUsername(otherUserId), getUserAvatar(otherUserId), getUserStatus(otherUserId)]).then(function(results) {
                var userName = results[0];
                var userAvatar = results[1];
                var userStatus = results[2];
                
                document.getElementById('chat-username').textContent = userName;
                
                var chatAvatar = document.getElementById('chat-avatar');
                if (userAvatar && userAvatar.indexOf('http') === 0) {
                    chatAvatar.style.backgroundImage = 'url(' + userAvatar + ')';
                    chatAvatar.style.backgroundSize = 'cover';
                    chatAvatar.textContent = '';
                } else {
                    chatAvatar.style.backgroundImage = '';
                    chatAvatar.textContent = '👤';
                }
                
                var statusEl = document.getElementById('chat-status');
                if (userStatus.online) {
                    statusEl.innerHTML = 'в сети';
                } else {
                    statusEl.innerHTML = formatLastSeen(userStatus.lastSeen);
                }
                
                // Делаем шапку кликабельной
                var chatHeader = document.querySelector('.chat-user-info');
                if (chatHeader) {
                    chatHeader.style.cursor = 'pointer';
                    chatHeader.onclick = function(e) {
                        e.stopPropagation();
                        if (typeof openUserProfile === 'function') {
                            openUserProfile(otherUserId);
                        }
                    };
                }
            });
        } else {
            document.getElementById('chat-username').textContent = 'Пользователь';
            document.getElementById('chat-status').textContent = 'загрузка...';
        }
    }
    
    // Подсвечиваем активный чат
    document.querySelectorAll('.chat-item').forEach(function(item) {
        item.classList.remove('active');
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
    
    // Загружаем сообщения
    loadMessages(chatId);
    setupTypingListener(chatId);
}

function closeChat() {
    var activeChat = document.getElementById('active-chat');
    var noChat = document.getElementById('no-chat-selected');
    if (activeChat) activeChat.classList.add('hidden');
    if (noChat) noChat.classList.remove('hidden');
    if (messagesListener) messagesListener.off();
    loadedMessageIds.clear();
    currentChatId = null;
    currentChatUser = null;
}

// ========== СООБЩЕНИЯ С ПРАВИЛЬНОЙ ПРОКРУТКОЙ ==========
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    container.innerHTML = '';
    loadedMessageIds.clear();
    
    if (messagesListener) messagesListener.off();
    
    // Флаг для авто-прокрутки
    var shouldAutoScroll = true;
    
    container.onscroll = function() {
        var isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        shouldAutoScroll = isAtBottom;
    };
    
    messagesListener = database.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(50);
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        var messageId = snapshot.key;
        
        if (loadedMessageIds.has(messageId)) return;
        loadedMessageIds.add(messageId);
        
        message.id = messageId;
        appendMessage(message);
        
        if (shouldAutoScroll) {
            setTimeout(function() {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
    });
}

function appendMessage(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var div = document.createElement('div');
    var isSent = message.senderId === currentUser.uid;
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.setAttribute('data-message-id', message.id);
    
    var content = '';
    
    if (message.type === 'image') {
        content = '<div class="message-image" onclick="openLightbox(\'' + message.imageUrl + '\')"><img src="' + message.imageUrl + '" loading="lazy"></div>';
        if (message.caption) content += '<div class="message-text">' + formatMessageText(message.caption) + '</div>';
    } else if (message.type === 'gif') {
        content = '<div class="gif-message" onclick="openLightbox(\'' + message.gifUrl + '\')"><img src="' + message.gifUrl + '" loading="lazy"><span class="gif-badge">GIF</span></div>';
        if (message.caption) content += '<div class="message-text">' + formatMessageText(message.caption) + '</div>';
    } else if (message.type === 'audio') {
        content = '<div class="audio-message"><button onclick="playAudio(\'' + message.audioUrl + '\')">▶️</button><span>Голосовое сообщение</span></div>';
        if (message.duration) content += ' <span>' + message.duration + ' сек</span>';
    } else if (message.type === 'video') {
        content = '<div class="video-message"><video src="' + message.videoUrl + '" controls style="max-width:250px; max-height:250px; border-radius:12px;"></video></div>';
        if (message.caption) content += '<div class="message-text">' + formatMessageText(message.caption) + '</div>';
    } else if (message.type === 'file') {
        content = '<div class="file-message">📎 <a href="' + message.fileUrl + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(message.fileName) + '</a></div>';
    } else if (message.type === 'system') {
        div.className = 'message system';
        content = '<div class="message-text system" style="text-align:center; font-style:italic; opacity:0.7;">' + escapeHtml(message.text) + '</div>';
    } else {
        var text = formatMessageText(message.text || '');
        if (message.edited) text += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content = '<div class="message-text">' + text + '</div>';
    }
    
    div.innerHTML = content + '<div class="message-time">' + formatTime(message.timestamp) + '</div>';
    container.appendChild(div);
}

function formatMessageText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#228B22; text-decoration:none;">$1</a>');
    text = text.replace(/@(\w+)/g, '<span style="color:#228B22; cursor:pointer;" onclick="openUserProfileByUsername(\'$1\')">@$1</span>');
    return text;
}

function sendMessage() {
    var input = document.getElementById('message-input');
    if (!input || !input.value.trim() || !currentChatId) return;
    
    var text = input.value.trim();
    input.value = '';
    
    var message = {
        type: 'text',
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    database.ref('messages/' + currentChatId).push(message).then(function() {
        var lastMsg = text.length > 50 ? text.substring(0, 47) + '...' : text;
        database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        if (typeof playSendSound === 'function') {
            playSendSound();
        }
    }).catch(function(err) {
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
    database.ref('typing/' + chatId).off();
    database.ref('typing/' + chatId).on('value', function(snap) {
        var data = snap.val();
        var typingUsers = [];
        for (var uid in data) {
            if (uid !== currentUser.uid && data[uid] === true) typingUsers.push(uid);
        }
        var statusEl = document.getElementById('chat-status');
        if (!statusEl) return;
        
        if (typingUsers.length) {
            statusEl.innerHTML = 'печатает...';
        } else if (currentChatUser && currentChatUser.type === 'private' && currentChatUser.otherUserId) {
            getUserStatus(currentChatUser.otherUserId).then(function(s) {
                if (s.online) statusEl.innerHTML = 'в сети';
                else statusEl.innerHTML = formatLastSeen(s.lastSeen);
            });
        }
    });
}

function openLightbox(url) {
    var lightbox = document.getElementById('image-lightbox');
    var img = document.getElementById('lightbox-image');
    if (lightbox && img) {
        img.src = url;
        lightbox.classList.remove('hidden');
    }
}

function closeLightbox() {
    var lightbox = document.getElementById('image-lightbox');
    if (lightbox) lightbox.classList.add('hidden');
}

function playAudio(url) {
    var audio = new Audio(url);
    audio.play().catch(function(e) { console.log('Audio play error:', e); });
}

// ========== ДЛЯ ПРОФИЛЯ ==========
function openChannelOrGroupProfile() {
    if (!currentChatId || !currentChatUser) {
        showNotification('Чат не выбран', 'error');
        return;
    }
    
    if (currentChatUser.type === 'private' && currentChatUser.otherUserId) {
        if (typeof openUserProfile === 'function') {
            openUserProfile(currentChatUser.otherUserId);
        } else if (typeof window.openUserProfile === 'function') {
            window.openUserProfile(currentChatUser.otherUserId);
        } else {
            showNotification('Функция профиля не загружена', 'error');
        }
    } else if (currentChatUser.type === 'channel') {
        if (typeof openChannelProfile === 'function') {
            openChannelProfile(currentChatId);
        } else {
            showNotification('Функция профиля канала не загружена', 'error');
        }
    } else if (currentChatUser.type === 'group') {
        if (typeof openGroupProfile === 'function') {
            openGroupProfile(currentChatId);
        } else {
            showNotification('Функция профиля группы не загружена', 'error');
        }
    } else {
        showNotification('Неизвестный тип чата', 'error');
    }
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

function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + '_' + userId2 : userId2 + '_' + userId1;
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
            type: 'system',
            text: '🍃 Добро пожаловать в чат! Здесь вы можете общаться, делиться фото и файлами.',
            senderId: 'system',
            timestamp: firebase.database.ServerValue.TIMESTAMP
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

// ========== ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ==========
window.loadChats = loadChats;
window.openChat = openChat;
window.closeChat = closeChat;
window.sendMessage = sendMessage;
window.handleMessageKeyPress = handleMessageKeyPress;
window.onTyping = onTyping;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.playAudio = playAudio;
window.openChannelOrGroupProfile = openChannelOrGroupProfile;
window.hideCallButtons = hideCallButtons;
window.showCallButtons = showCallButtons;
window.searchGlobalNew = searchGlobalNew;
window.closeSearchResults = closeSearchResults;
window.openCreateMenu = openCreateMenu;
window.closeCreateMenu = closeCreateMenu;
window.openNewChatFromMenu = openNewChatFromMenu;
window.showNewChatDialog = showNewChatDialog;
window.closeNewChatDialog = closeNewChatDialog;
window.searchUsersForNewChat = searchUsersForNewChat;
window.startPrivateChat = startPrivateChat;
window.generateChatId = generateChatId;
window.formatTime = formatTime;
window.formatLastSeen = formatLastSeen;
window.escapeHtml = escapeHtml;
window.showNotification = showNotification;

// Инициализация звуков
if (typeof KukumberSounds !== 'undefined') {
    KukumberSounds.init();
}

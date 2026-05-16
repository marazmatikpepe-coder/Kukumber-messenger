// KUKUMBER MESSENGER - CHAT.JS (ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ)

var selectedGroupMembers = [];
var typingTimeout = null;
var loadedMessageIds = new Set();
var chatsCache = [];
var contactsCache = null;
var contactsCacheTime = 0;
var userStatusCache = {};
var userAvatarCache = {};
var usernameCache = {};
var messagesListener = null;

var CONTACTS_CACHE_TTL = 30000;
var STATUS_CACHE_TTL = 15000;
var CHATS_LIMIT = 50;

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
    console.log('loadChats вызвана');
    if (!currentUser) {
        console.log('Нет currentUser');
        return;
    }
    
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) {
        console.log('chats-list не найден');
        return;
    }
    
    chatsList.innerHTML = '<div class="empty-chats">🔄 Загрузка чатов...</div>';
    
    if (window.chatsListener) {
        window.chatsListener.off();
    }
    
    window.chatsListener = database.ref('userChats/' + currentUser.uid);
    window.chatsListener.on('value', function(snapshot) {
        var chatsData = snapshot.val();
        console.log('userChats данные:', chatsData);
        
        if (!chatsData) { 
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов. Начните диалог!</div>'; 
            return; 
        }
        
        var chatIds = Object.keys(chatsData);
        console.log('Найдено чатов:', chatIds.length);
        
        if (chatIds.length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов</div>';
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
            }).catch(function(err) { 
                console.error('Ошибка загрузки чата', chatId, err);
                count++; 
            });
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
        chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов</div>'; 
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
    
    // Устанавливаем onclick СРАЗУ, до любой асинхронной загрузки
    // В createChatItem, где устанавливается div.onclick, замените на:
div.onclick = (function(cId, cData) {
    return function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Клик по чату:', cId);
        openChat(cId, cData);
    };
})(chatId, chatData);
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
                updateChatItemDisplay(div, name, avatar, isOnline, badge, chatData);
            });
        } else { 
            name = 'Пользователь'; 
            updateChatItemDisplay(div, name, avatar, isOnline, badge, chatData);
        }
        return;
    }
    
    function finishCreate() {
        updateChatItemDisplay(div, name, avatar, isOnline, badge, chatData);
    }
}

function updateChatItemDisplay(div, name, avatar, isOnline, badge, chatData) {
    var avatarStyle = '';
    var avatarContent = '';
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
    
    div.innerHTML = '<div class="chat-item-avatar"><div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div>'+(isOnline ? '<div class="online-indicator"></div>' : '')+badge+'</div><div class="chat-item-info"><div class="chat-item-header"><span class="chat-item-name">'+escapeHtml(name)+'</span><span class="chat-item-time">'+time+'</span></div><div class="chat-item-preview">'+escapeHtml(preview)+'</div></div>';
    
    var chatsList = document.getElementById('chats-list');
    if (chatsList && !chatsList.contains(div)) {
        chatsList.appendChild(div);
    }
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(chatId, chatData) {
    console.log('=== ОТКРЫТИЕ ЧАТА ===');
    console.log('chatId:', chatId);
    console.log('chatData:', chatData);
    console.log('currentUser:', currentUser);
    
    if (!chatId) {
        console.error('Нет chatId!');
        showNotification('Ошибка: нет ID чата', 'error');
        return;
    }
    
    if (!currentUser) {
        console.error('Нет currentUser!');
        showNotification('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Закрываем сайдбар только на мобильных
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
    
    // Если нет данных чата, загружаем их
    if (!chatData || !chatData.type) {
        console.log('Нет данных чата, загружаем из БД...');
        database.ref('chats/' + chatId).once('value').then(function(snapshot) {
            var freshData = snapshot.val();
            console.log('Загруженные данные чата:', freshData);
            if (freshData) {
                openChatWithData(chatId, freshData);
            } else {
                console.error('Чат не найден в БД!');
                showNotification('Чат не найден', 'error');
            }
        }).catch(function(err) {
            console.error('Ошибка загрузки чата:', err);
            showNotification('Ошибка загрузки чата', 'error');
        });
        return;
    }
    
  function openChatWithData(chatId, chatData) {
    console.log('=== openChatWithData ===');
    console.log('chatId:', chatId);
    console.log('chatData:', chatData);
    
    if (!chatData) {
        console.error('Нет данных чата в openChatWithData');
        return;
    }
    
    currentChatId = chatId;
    currentChatUser = chatData;
    currentChatUser.chatId = chatId;
    
    // Показываем область активного чата
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    console.log('noChatElement:', noChatElement);
    console.log('activeChatElement:', activeChatElement);
    
    if (noChatElement) noChatElement.classList.add('hidden');
    if (activeChatElement) activeChatElement.classList.remove('hidden');
    
    // Устанавливаем базовую информацию
    var chatUsername = document.getElementById('chat-username');
    var chatStatus = document.getElementById('chat-status');
    
    if (!chatUsername || !chatStatus) {
        console.error('Элементы чата не найдены!');
        return;
    }
    
    // Временные значения
    if (chatData.type === 'group') {
        chatUsername.textContent = chatData.name || 'Группа';
        chatStatus.textContent = 'загрузка...';
    } else if (chatData.type === 'channel') {
        chatUsername.textContent = chatData.name || 'Канал';
        chatStatus.textContent = 'загрузка...';
    } else {
        chatUsername.textContent = 'загрузка...';
        chatStatus.textContent = 'загрузка...';
    }
    
    console.log('Базовые данные установлены, загружаем сообщения...');
    
    // Загружаем сообщения
    loadMessages(chatId);
    setupTypingListener(chatId);
    
    // Обновляем данные пользователя для приватного чата
    if (chatData.type === 'private' && chatData.participants) {
        var otherUserId = null;
        for (var i = 0; i < chatData.participants.length; i++) {
            if (chatData.participants[i] !== currentUser.uid) {
                otherUserId = chatData.participants[i];
                break;
            }
        }
        
        if (otherUserId) {
            console.log('Загружаем данные пользователя:', otherUserId);
            chatData.otherUserId = otherUserId;
            
            Promise.all([getUsername(otherUserId), getUserAvatar(otherUserId), getUserStatus(otherUserId)]).then(function(results) {
                console.log('Данные загружены:', results);
                var userName = results[0];
                var userAvatar = results[1];
                var userStatusData = results[2];
                
                var chatUsernameEl = document.getElementById('chat-username');
                if (chatUsernameEl) chatUsernameEl.textContent = userName;
                
                var chatAvatar = document.getElementById('chat-avatar');
                if (chatAvatar) {
                    if (userAvatar && userAvatar.indexOf('http') === 0) {
                        chatAvatar.style.backgroundImage = 'url(' + userAvatar + ')';
                        chatAvatar.style.backgroundSize = 'cover';
                        chatAvatar.textContent = '';
                    } else {
                        chatAvatar.style.backgroundImage = '';
                        chatAvatar.textContent = '👤';
                    }
                }
                
                var statusEl = document.getElementById('chat-status');
                if (statusEl) {
                    if (userStatusData.online) {
                        statusEl.innerHTML = 'в сети';
                    } else {
                        statusEl.innerHTML = formatLastSeen(userStatusData.lastSeen);
                    }
                }
            }).catch(function(err) {
                console.error('Ошибка загрузки данных пользователя:', err);
            });
        }
    }
    
    console.log('Чат успешно открыт!');
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
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
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
    if (!container) return;
    
    var div = document.createElement('div');
    var isSent = message.senderId === currentUser.uid;
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.setAttribute('data-message-id', message.id);
    div.setAttribute('data-sender-id', message.senderId);
    
    var content = '';
    
    if (message.type === 'image') {
        content = '<div class="message-image" onclick="openLightbox(\''+message.imageUrl+'\')"><img src="'+message.imageUrl+'" class="lazy-message" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;"></div>';
        if (message.caption && message.caption.trim()) {
            content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
        }
    } else if (message.type === 'gif') {
        content = '<div class="gif-message" onclick="openLightbox(\''+message.gifUrl+'\')"><img src="'+message.gifUrl+'" alt="GIF" class="gif-image lazy-message" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;"><span class="gif-badge">GIF</span></div>';
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
        
        // Показываем ответ, если есть
        var replyHtml = '';
        if (message.replyTo) {
            replyHtml = '<div style="background:rgba(0,0,0,0.05); border-left:3px solid #228B22; padding:5px 10px; margin-bottom:6px; border-radius:8px; font-size:12px;">' +
                '<span style="color:#228B22; font-weight:600;">↩️ Ответ для ' + escapeHtml(message.replyTo.senderName) + '</span><br>' +
                '<span style="color:#666;">' + escapeHtml(message.replyTo.text) + '</span>' +
            '</div>';
        }
        
        content = replyHtml + '<div class="message-text" style="word-break:break-word; white-space:normal;">' + textContent + '</div>';
    }
    
    div.innerHTML = '<div class="message-content" style="flex:1;">'+content+'<div class="message-time">'+formatTime(message.timestamp)+'</div></div>';
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
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

function formatMessageText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #228B22; text-decoration: none;">$1</a>');
    text = text.replace(/@(\w+)/g, '<span style="color:#228B22; cursor:pointer;" onclick="openUserProfileByUsername(\'$1\')">@$1</span>');
    return text;
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
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
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
        showNotification('Ошибка отправки', 'error'); 
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

function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + '_' + userId2 : userId2 + '_' + userId1;
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

function openChannelOrGroupProfile() {
    if (!currentChatId || !currentChatUser) {
        showNotification('Чат не выбран', 'error');
        return;
    }
    
    if (currentChatUser.type === 'private' && currentChatUser.otherUserId) {
        if (typeof window.openUserProfile === 'function') {
            window.openUserProfile(currentChatUser.otherUserId);
        } else {
            showNotification('Профиль в разработке', 'info');
        }
        return;
    }
    
    if (currentChatUser.type === 'channel') {
        showNotification('Профиль канала в разработке', 'info');
        return;
    }
    
    if (currentChatUser.type === 'group') {
        showNotification('Профиль группы в разработке', 'info');
        return;
    }
}

// ========== ПОИСК И НОВЫЕ ЧАТЫ ==========
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
        loadChats();
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

// Экспорт функций
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
console.log('chat.js полностью загружен');
// ========== КОНТЕКСТНОЕ МЕНЮ ДЛЯ СООБЩЕНИЙ ==========
var replyToMessage = null;

function showMessageMenu(messageId, message, isSent) {
    var oldMenu = document.getElementById('message-context-menu');
    if (oldMenu) oldMenu.remove();
    
    var menu = document.createElement('div');
    menu.id = 'message-context-menu';
    menu.style.cssText = 'position:fixed; z-index:10001; background:white; border-radius:16px; box-shadow:0 5px 25px rgba(0,0,0,0.2); min-width:200px; overflow:hidden; backdrop-filter:blur(10px);';
    
    var menuHtml = '';
    
    if (isSent) {
        menuHtml += '<div class="context-menu-item" onclick="editMessage(\'' + messageId + '\', \'' + escapeHtml(message.text || '').replace(/'/g, "\\'") + '\')">✏️ Редактировать</div>';
        menuHtml += '<div class="context-menu-item" onclick="deleteForMe(\'' + messageId + '\')">🗑️ Удалить у меня</div>';
        menuHtml += '<div class="context-menu-item" onclick="deleteForEveryone(\'' + messageId + '\')">⚠️ Удалить у всех</div>';
        menuHtml += '<div style="height:1px; background:#eee; margin:5px 0;"></div>';
    }
    
    menuHtml += '<div class="context-menu-item" onclick="copyMessageText(\'' + escapeHtml(message.text || '').replace(/'/g, "\\'") + '\')">📋 Копировать текст</div>';
    menuHtml += '<div class="context-menu-item" onclick="forwardMessage(\'' + messageId + '\')">📤 Переслать</div>';
    menuHtml += '<div class="context-menu-item" onclick="replyToMessageFunc(\'' + messageId + '\', \'' + escapeHtml(message.text || '').replace(/'/g, "\\'") + '\', \'' + (message.senderId === currentUser.uid ? 'Вы' : (message.senderName || 'Пользователь')) + '\')">💬 Ответить</div>';
    
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    // Позиционирование
    var rect = document.querySelector('.message[data-message-id="' + messageId + '"]')?.getBoundingClientRect();
    if (rect) {
        var x = rect.left + 10;
        var y = rect.top - 10;
        var menuRect = menu.getBoundingClientRect();
        if (y + menuRect.height > window.innerHeight) {
            y = rect.bottom + 10;
        }
        if (x + menuRect.width > window.innerWidth) {
            x = window.innerWidth - menuRect.width - 10;
        }
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }
    
    setTimeout(function() {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

function editMessage(messageId, oldText) {
    var newText = prompt('Редактировать сообщение:', oldText);
    if (newText && newText.trim() && newText !== oldText) {
        database.ref('messages/' + currentChatId + '/' + messageId).update({
            text: newText.trim(),
            edited: true,
            editedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(function() {
            showNotification('Сообщение отредактировано', 'success');
        });
    }
    closeMessageMenu();
}

function deleteForMe(messageId) {
    if (confirm('Удалить сообщение только у себя?')) {
        database.ref('messages/' + currentChatId + '/' + messageId).remove();
        showNotification('Сообщение удалено', 'info');
    }
    closeMessageMenu();
}

function deleteForEveryone(messageId) {
    if (confirm('Удалить сообщение у всех? Это действие необратимо.')) {
        database.ref('messages/' + currentChatId + '/' + messageId).remove();
        showNotification('Сообщение удалено у всех', 'success');
    }
    closeMessageMenu();
}

function copyMessageText(text) {
    navigator.clipboard.writeText(text).then(function() {
        showNotification('Текст скопирован', 'success');
    });
    closeMessageMenu();
}

function forwardMessage(messageId) {
    showNotification('Пересылка сообщений будет в следующем обновлении', 'info');
    closeMessageMenu();
}

function closeMessageMenu() {
    var menu = document.getElementById('message-context-menu');
    if (menu) menu.remove();
}

// ========== ОТВЕТ НА СООБЩЕНИЕ ==========
function replyToMessageFunc(messageId, messageText, senderName) {
    replyToMessage = {
        id: messageId,
        text: messageText.length > 50 ? messageText.substring(0, 47) + '...' : messageText,
        senderName: senderName
    };
    showReplyBar();
    closeMessageMenu();
}

function showReplyBar() {
    var oldBar = document.getElementById('reply-bar');
    if (oldBar) oldBar.remove();
    
    var bar = document.createElement('div');
    bar.id = 'reply-bar';
    bar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:#e8f5e9; padding:8px 15px; border-left:4px solid var(--forest); margin:0 10px 5px 10px; border-radius:12px;';
    bar.innerHTML = `
        <div style="flex:1; overflow:hidden;">
            <div style="font-size:12px; color:var(--forest); font-weight:600;">Ответ для ${escapeHtml(replyToMessage.senderName)}</div>
            <div style="font-size:13px; color:#555; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(replyToMessage.text)}</div>
        </div>
        <button onclick="cancelReply()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#999;">✕</button>
    `;
    
    var messageInputArea = document.querySelector('.message-input-area');
    if (messageInputArea) {
        messageInputArea.parentNode.insertBefore(bar, messageInputArea);
    }
}

function cancelReply() {
    replyToMessage = null;
    var bar = document.getElementById('reply-bar');
    if (bar) bar.remove();
}

function sendMessageWithReply() {
    var input = document.getElementById('message-input');
    if (!input) return;
    
    var text = input.value.trim();
    if (!text || !currentChatId) return;
    
    var message = { 
        type: 'text', 
        text: text, 
        senderId: currentUser.uid,
        senderName: currentUserData?.username || 'Вы',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    if (replyToMessage) {
        message.replyTo = replyToMessage;
        message.text = text;
    }
    
    input.value = '';
    
    database.ref('messages/' + currentChatId).push(message).then(function() {
        var lastMsg = text.length > 50 ? text.substring(0,47)+'...' : text;
        database.ref('chats/' + currentChatId).update({ 
            lastMessage: lastMsg, 
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP 
        });
        cancelReply();
        if (typeof playSendSound === 'function') playSendSound();
    }).catch(function() { 
        showNotification('Ошибка отправки', 'error'); 
        input.value = text; 
    });
}

// Переопределяем sendMessage
var originalSendMessage = window.sendMessage;
window.sendMessage = sendMessageWithReply;

// Добавляем обработчики для открытия меню
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('messages-container')?.addEventListener('contextmenu', function(e) {
        var messageDiv = e.target.closest('.message');
        if (messageDiv) {
            e.preventDefault();
            var messageId = messageDiv.getAttribute('data-message-id');
            var senderId = messageDiv.getAttribute('data-sender-id');
            if (messageId) {
                database.ref('messages/' + currentChatId + '/' + messageId).once('value').then(function(snap) {
                    var msg = snap.val();
                    if (msg) {
                        showMessageMenu(messageId, msg, senderId === currentUser?.uid);
                    }
                });
            }
        }
    });
    
    // Для телефона - долгое нажатие
    document.getElementById('messages-container')?.addEventListener('touchstart', function(e) {
        var messageDiv = e.target.closest('.message');
        if (!messageDiv) return;
        var timer;
        timer = setTimeout(function() {
            var messageId = messageDiv.getAttribute('data-message-id');
            var senderId = messageDiv.getAttribute('data-sender-id');
            if (messageId) {
                database.ref('messages/' + currentChatId + '/' + messageId).once('value').then(function(snap) {
                    var msg = snap.val();
                    if (msg) {
                        showMessageMenu(messageId, msg, senderId === currentUser?.uid);
                    }
                });
            }
        }, 500);
        messageDiv.addEventListener('touchend', function() { clearTimeout(timer); }, { once: true });
        messageDiv.addEventListener('touchmove', function() { clearTimeout(timer); }, { once: true });
    });
});

// Добавляем CSS для меню
var style = document.createElement('style');
style.textContent = `
    .context-menu-item {
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.1s;
        font-size: 14px;
        color: #333;
    }
    .context-menu-item:hover {
        background: #f5f5f5;
    }
    body.night-mode .context-menu-item {
        color: #eee;
    }
    body.night-mode .context-menu-item:hover {
        background: #2a2a2a;
    }
    #message-context-menu {
        animation: menuFadeIn 0.1s ease;
    }
    @keyframes menuFadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
`;
document.head.appendChild(style);
// ========== ФИКС ДЛЯ ПК: ОТКРЫТИЕ ЧАТОВ (ИСПРАВЛЕННЫЙ) ==========
function fixPCChats() {
    var chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(function(item) {
        if (item.hasAttribute('data-fixed')) return;
        
        // Ищем chatId внутри onclick атрибута
        var onclickAttr = item.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes('openChat')) {
            item.setAttribute('data-fixed', 'true');
            return;
        }
        
        // Пытаемся найти chatId в данных
        var match = item.innerHTML.match(/openChat\('([^']+)'/);
        if (match && match[1]) {
            var chatId = match[1];
            item.style.cursor = 'pointer';
            item.setAttribute('data-fixed', 'true');
            item.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                database.ref('chats/' + chatId).once('value').then(function(snapshot) {
                    var chatData = snapshot.val();
                    if (chatData) {
                        openChat(chatId, chatData);
                    }
                });
            };
        }
    });
}

// Наблюдатель за изменениями
var chatObserver = new MutationObserver(function() {
    fixPCChats();
});

// Запуск
if (document.getElementById('chats-list')) {
    chatObserver.observe(document.getElementById('chats-list'), { childList: true, subtree: true });
}
setTimeout(fixPCChats, 1000);
// Фикс для ПК - принудительное обновление кликов
function fixChatClickListeners() {
    var chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(function(item) {
        // Если у элемента нет onclick или он неправильный
        if (!item.onclick && !item.hasAttribute('data-fixed')) {
            var match = item.innerHTML.match(/openChat\('([^']+)'/);
            if (match && match[1]) {
                var chatId = match[1];
                item.setAttribute('data-fixed', 'true');
                item.style.cursor = 'pointer';
                (function(cId) {
                    item.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        database.ref('chats/' + cId).once('value').then(function(snapshot) {
                            var chatData = snapshot.val();
                            if (chatData) {
                                openChat(cId, chatData);
                            } else {
                                showNotification('Чат не найден', 'error');
                            }
                        });
                    };
                })(chatId);
            }
        }
    });
}

// Запускаем фикс после загрузки чатов
var originalRenderChats = window.renderChats;
window.renderChats = function(chats) {
    originalRenderChats(chats);
    setTimeout(fixChatClickListeners, 100);
};

// Наблюдатель за изменениями в списке чатов
if (document.getElementById('chats-list')) {
    var chatObserver = new MutationObserver(function() {
        fixChatClickListeners();
    });
    chatObserver.observe(document.getElementById('chats-list'), { 
        childList: true, 
        subtree: true 
    });
}
// Функция для прямого открытия чата по ID (для onclick атрибутов)
window.openChatById = function(chatId) {
    console.log('openChatById вызван для:', chatId);
    database.ref('chats/' + chatId).once('value').then(function(snapshot) {
        var chatData = snapshot.val();
        if (chatData) {
            openChat(chatId, chatData);
        } else {
            showNotification('Чат не найден', 'error');
        }
    }).catch(function(err) {
        console.error('Ошибка загрузки чата:', err);
        showNotification('Ошибка загрузки чата', 'error');
    });
};

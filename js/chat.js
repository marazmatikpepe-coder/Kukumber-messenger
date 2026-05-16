// KUKUMBER MESSENGER - CHAT.JS (ФИНАЛЬНАЯ ВЕРСИЯ - РАБОТАЕТ И НА ПК, И НА ТЕЛЕФОНЕ)

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
var chatsListener = null;

var CONTACTS_CACHE_TTL = 30000;
var STATUS_CACHE_TTL = 15000;
var CHATS_LIMIT = 50;

var isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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

function closeSidebarAfterChatOpen() {
    if (isMobileDevice) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
        var menuBtn = document.querySelector('.mobile-menu-btn');
        if (menuBtn) menuBtn.style.opacity = '1';
    }
}

// ========== ПРИНУДИТЕЛЬНАЯ ПРИВЯЗКА КЛИКОВ ДЛЯ ПК ==========
function bindChatClickListeners() {
    console.log('Привязка обработчиков кликов к чатам...');
    var chatItems = document.querySelectorAll('.chat-item');
    console.log('Найдено чатов для привязки:', chatItems.length);
    
    chatItems.forEach(function(item) {
        // Проверяем, есть ли уже привязанный обработчик
        if (item.hasAttribute('data-listener-bound')) {
            return;
        }
        
        var chatId = item.getAttribute('data-chat-id');
        if (!chatId) {
            // Пытаемся найти chatId другим способом
            var onclickAttr = item.getAttribute('onclick');
            if (onclickAttr) {
                var match = onclickAttr.match(/openChat\('([^']+)'/);
                if (match) chatId = match[1];
            }
        }
        
        if (chatId) {
            console.log('Привязываю клик для чата:', chatId);
            // Удаляем старый onclick, если есть
            item.removeAttribute('onclick');
            // Добавляем новый обработчик
            item.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Клик по чату (принудительный обработчик):', chatId);
                // Загружаем свежие данные чата
                database.ref('chats/' + chatId).once('value').then(function(snapshot) {
                    var chatData = snapshot.val();
                    if (chatData) {
                        openChat(chatId, chatData);
                    } else {
                        console.error('Чат не найден:', chatId);
                        showNotification('Чат не найден', 'error');
                    }
                }).catch(function(err) {
                    console.error('Ошибка загрузки чата:', err);
                    showNotification('Ошибка загрузки чата', 'error');
                });
                return false;
            };
            item.setAttribute('data-listener-bound', 'true');
            item.style.cursor = 'pointer';
        }
    });
}

// Наблюдатель за изменениями в списке чатов
function initChatListObserver() {
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) return;
    
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Задержка для гарантии, что DOM обновился
                setTimeout(function() {
                    bindChatClickListeners();
                }, 100);
            }
        });
    });
    
    observer.observe(chatsList, { childList: true, subtree: true });
    console.log('Наблюдатель за списком чатов запущен');
    
    // Первоначальная привязка
    setTimeout(bindChatClickListeners, 500);
}

// ========== ЗАГРУЗКА ЧАТОВ ==========
function loadChats() {
    console.log('=== loadChats вызвана ===');
    if (!currentUser) {
        console.log('Нет currentUser');
        return;
    }
    
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) {
        console.error('chats-list не найден');
        return;
    }
    
    chatsList.innerHTML = '<div class="empty-chats">🔄 Загрузка чатов...</div>';
    
    if (chatsListener) {
        chatsListener.off();
    }
    
    chatsListener = database.ref('userChats/' + currentUser.uid);
    chatsListener.on('value', function(snapshot) {
        var chatsData = snapshot.val();
        console.log('userChats данные:', chatsData ? Object.keys(chatsData).length : 0, 'чатов');
        
        if (!chatsData) {
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов. Начните диалог!</div>';
            return;
        }
        
        var chatIds = Object.keys(chatsData);
        if (chatIds.length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов</div>';
            return;
        }
        
        var tempChats = {};
        var pendingCount = chatIds.length;
        
        chatIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value').then(function(chatSnap) {
                var chatData = chatSnap.val();
                if (chatData) {
                    tempChats[chatId] = chatData;
                }
                pendingCount--;
                if (pendingCount === 0) {
                    renderChatsList(tempChats);
                    // После рендера привязываем клики
                    setTimeout(bindChatClickListeners, 200);
                }
            }).catch(function(err) {
                console.error('Ошибка загрузки чата', chatId, err);
                pendingCount--;
                if (pendingCount === 0) {
                    renderChatsList(tempChats);
                    setTimeout(bindChatClickListeners, 200);
                }
            });
        });
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
            chatId: chatId,
            data: chatsData[chatId]
        });
    }
    
    chatsArray.sort(function(a, b) {
        return (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0);
    });
    
    chatsList.innerHTML = '';
    
    chatsArray.forEach(function(chat) {
        createChatItemElement(chat.chatId, chat.data, chatsList);
    });
}

function createChatItemElement(chatId, chatData, container) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    div.setAttribute('data-chat-id', chatId);
    
    if (currentChatId === chatId) {
        div.classList.add('active');
    }
    
    var name = '';
    var avatarUrl = '';
    var badge = '';
    var isOnline = false;
    var avatarContent = '';
    var avatarStyle = '';
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatarUrl = chatData.avatar || '';
        badge = '<span class="chat-type-badge">👥</span>';
        finishCreate();
    } 
    else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatarUrl = chatData.avatar || '';
        badge = '<span class="chat-type-badge">📢</span>';
        finishCreate();
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
            chatData.otherUserId = otherUserId;
            
            Promise.all([getUsername(otherUserId), getUserAvatar(otherUserId), getUserStatus(otherUserId)]).then(function(results) {
                name = results[0];
                avatarUrl = results[1];
                isOnline = results[2].online === true;
                
                if (!chatData.otherUser) chatData.otherUser = {};
                chatData.otherUser.username = name;
                chatData.otherUser.avatar = avatarUrl;
                chatData.otherUser.uid = otherUserId;
                
                finishCreateWithData(name, avatarUrl, isOnline);
            });
            return;
        } else {
            name = 'Пользователь';
            finishCreate();
        }
        return;
    }
    
    function finishCreate() {
        if (avatarUrl && avatarUrl.indexOf('http') === 0) {
            avatarStyle = 'background-image: url(' + avatarUrl + '); background-size: cover; background-position: center;';
            avatarContent = '';
        } else {
            avatarStyle = '';
            if (chatData.type === 'group') avatarContent = '👥';
            else if (chatData.type === 'channel') avatarContent = '📢';
            else avatarContent = '👤';
        }
        
        var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
        var preview = chatData.lastMessage || 'Нет сообщений';
        if (preview.length > 50) preview = preview.substring(0, 47) + '...';
        
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
        
        // Сохраняем chatId в атрибут для последующей привязки
        div.setAttribute('data-chat-id', chatId);
        
        container.appendChild(div);
    }
    
    function finishCreateWithData(userName, userAvatar, userOnline) {
        name = userName;
        avatarUrl = userAvatar;
        isOnline = userOnline;
        
        if (avatarUrl && avatarUrl.indexOf('http') === 0) {
            avatarStyle = 'background-image: url(' + avatarUrl + '); background-size: cover; background-position: center;';
            avatarContent = '';
        } else {
            avatarStyle = '';
            avatarContent = '👤';
        }
        
        var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
        var preview = chatData.lastMessage || 'Нет сообщений';
        if (preview.length > 50) preview = preview.substring(0, 47) + '...';
        
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
        
        div.setAttribute('data-chat-id', chatId);
        container.appendChild(div);
    }
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(chatId, chatData) {
    console.log('=== ОТКРЫТИЕ ЧАТА ===', chatId);
    
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
    
    // Закрываем боковую панель на мобильных
    closeSidebarAfterChatOpen();
    
    if (!chatData || !chatData.type) {
        console.log('Нет данных чата, загружаем из БД...');
        database.ref('chats/' + chatId).once('value').then(function(snapshot) {
            var freshData = snapshot.val();
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
    
    openChatWithData(chatId, chatData);
}

function openChatWithData(chatId, chatData) {
    console.log('=== openChatWithData ===', chatId);
    
    if (!chatData) {
        console.error('Нет данных чата');
        return;
    }
    
    currentChatId = chatId;
    currentChatUser = chatData;
    currentChatUser.chatId = chatId;
    
    // Обновляем активный класс
    document.querySelectorAll('.chat-item').forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('data-chat-id') === chatId) {
            item.classList.add('active');
        }
    });
    
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    
    if (noChatElement) noChatElement.classList.add('hidden');
    if (activeChatElement) activeChatElement.classList.remove('hidden');
    
    var chatUsername = document.getElementById('chat-username');
    var chatStatus = document.getElementById('chat-status');
    var chatAvatar = document.getElementById('chat-avatar');
    
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
    
    if (chatAvatar) {
        chatAvatar.style.backgroundImage = '';
        chatAvatar.textContent = '👤';
    }
    
    loadMessages(chatId);
    setupTypingListener(chatId);
    
    if (chatData.type === 'private' && chatData.participants) {
        var otherUserId = null;
        for (var i = 0; i < chatData.participants.length; i++) {
            if (chatData.participants[i] !== currentUser.uid) {
                otherUserId = chatData.participants[i];
                break;
            }
        }
        
        if (otherUserId) {
            chatData.otherUserId = otherUserId;
            
            Promise.all([getUsername(otherUserId), getUserAvatar(otherUserId), getUserStatus(otherUserId)]).then(function(results) {
                var userName = results[0];
                var userAvatar = results[1];
                var userStatusData = results[2];
                
                var chatUsernameEl = document.getElementById('chat-username');
                if (chatUsernameEl) chatUsernameEl.textContent = userName;
                
                var chatAvatarEl = document.getElementById('chat-avatar');
                if (chatAvatarEl) {
                    if (userAvatar && userAvatar.indexOf('http') === 0) {
                        chatAvatarEl.style.backgroundImage = 'url(' + userAvatar + ')';
                        chatAvatarEl.style.backgroundSize = 'cover';
                        chatAvatarEl.textContent = '';
                    } else {
                        chatAvatarEl.style.backgroundImage = '';
                        chatAvatarEl.textContent = '👤';
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
    
    messagesListener = database.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(50);
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
        var msgElement = document.querySelector('.message[data-message-id="' + removedId + '"]');
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
        content = '<div class="message-image" onclick="openLightbox(\'' + message.imageUrl + '\')"><img src="' + message.imageUrl + '" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;"></div>';
        if (message.caption && message.caption.trim()) {
            content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
        }
    } else if (message.type === 'gif') {
        content = '<div class="gif-message" onclick="openLightbox(\'' + message.gifUrl + '\')"><img src="' + message.gifUrl + '" alt="GIF" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;"><span class="gif-badge">GIF</span></div>';
        if (message.caption && message.caption.trim()) {
            content += '<div class="message-caption">' + formatMessageText(message.caption) + '</div>';
        }
    } else if (message.type === 'audio') {
        content = '<div class="audio-message"><button onclick="playAudio(\'' + message.audioUrl + '\')">▶️</button><span>Голосовое сообщение</span></div>';
    } else if (message.type === 'video') {
        content = '<div class="video-message"><video src="' + message.videoUrl + '" controls preload="metadata" style="max-width:250px; max-height:300px; border-radius:12px;"></video><div class="message-text">' + escapeHtml(message.fileName || 'Видео') + '</div></div>';
    } else if (message.type === 'file') {
        var fileIcon = '📎';
        content = '<div class="file-message"><span style="font-size:24px;">' + fileIcon + '</span><a href="' + message.fileUrl + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(message.fileName) + '</a></div>';
    } else {
        var textContent = formatMessageText(message.text || '');
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        
        var replyHtml = '';
        if (message.replyTo) {
            replyHtml = '<div style="background:rgba(0,0,0,0.05); border-left:3px solid #228B22; padding:5px 10px; margin-bottom:6px; border-radius:8px; font-size:12px;">' +
                '<span style="color:#228B22; font-weight:600;">↩️ Ответ для ' + escapeHtml(message.replyTo.senderName) + '</span><br>' +
                '<span style="color:#666;">' + escapeHtml(message.replyTo.text) + '</span>' +
                '</div>';
        }
        
        content = replyHtml + '<div class="message-text" style="word-break:break-word; white-space:normal;">' + textContent + '</div>';
    }
    
    div.innerHTML = '<div class="message-content" style="flex:1;">' + content + '<div class="message-time">' + formatTime(message.timestamp) + '</div></div>';
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function updateMessageElement(message) {
    var existingDiv = document.querySelector('.message[data-message-id="' + message.id + '"]');
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
    
    database.ref('messages/' + currentChatId).push(message).then(function() {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        database.ref('chats/' + currentChatId).update({ 
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

// ========== ОБЩИЕ ФУНКЦИИ ==========
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

// ========== ПОИСК И НОВЫЕ ЧАТЫ (сокращенно, основные функции) ==========
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
        div.onclick = function() { createNewChatAndOpen(user.uid, user); };
        
        var avatarDiv = document.createElement('div');
        avatarDiv.style.cssText = 'width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--sage); font-size: 24px; flex-shrink: 0;';
        
        if (user.avatar && user.avatar.startsWith('http')) {
            avatarDiv.style.backgroundImage = 'url(' + user.avatar + ')';
            avatarDiv.style.backgroundSize = 'cover';
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

// ========== ИНИЦИАЛИЗАЦИЯ ==========
initChatSounds();
initChatListObserver();

// Экспорт в глобальную область
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
window.hideCallButtons = hideCallButtons;
window.showCallButtons = showCallButtons;
window.bindChatClickListeners = bindChatClickListeners;

console.log('chat.js полностью загружен (финальная версия с принудительной привязкой кликов)');

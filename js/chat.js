// KUKUMBER MESSENGER - CHAT.JS (ПОЛНОСТЬЮ ПЕРЕПИСАН, ИСПРАВЛЕНА ЗАГРУЗКА ЧАТОВ)

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

// ========== ЗАГРУЗКА СПИСКА ЧАТОВ (ГЛАВНАЯ ФУНКЦИЯ) ==========
function loadChats() {
    console.log('loadChats() вызвана');
    
    if (!window.currentUser || !window.currentUser.uid) {
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
    
    // ПОЛУЧАЕМ СПИСОК ID ЧАТОВ ПОЛЬЗОВАТЕЛЯ
    database.ref('userChats/' + window.currentUser.uid).once('value', function(snapshot) {
        var userChats = snapshot.val();
        
        if (!userChats || Object.keys(userChats).length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов. Начните диалог!</div>';
            return;
        }
        
        var chatIds = Object.keys(userChats);
        console.log('Найдено чатов:', chatIds.length);
        
        // ЗАГРУЖАЕМ ДАННЫЕ КАЖДОГО ЧАТА
        var chatsData = {};
        var loadedCount = 0;
        
        if (chatIds.length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов</div>';
            return;
        }
        
        chatsList.innerHTML = '<div class="empty-chats">🔄 Загрузка чатов...</div>';
        
        chatIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value', function(chatSnap) {
                var chat = chatSnap.val();
                if (chat) {
                    chatsData[chatId] = chat;
                }
                loadedCount++;
                
                // Когда все чаты загружены - рендерим
                if (loadedCount === chatIds.length) {
                    renderChatsList(chatsData);
                }
            });
        });
    });
}

// ========== ОТРИСОВКА СПИСКА ЧАТОВ ==========
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
    
    // Рендерим каждый чат
    var pendingRenders = chatsArray.length;
    var renderedCount = 0;
    
    chatsArray.forEach(function(chat) {
        createChatItem(chat.id, chat.data, chatsList).then(function() {
            renderedCount++;
            if (renderedCount === pendingRenders) {
                // ВСЕ ЧАТЫ ОТРИСОВАНЫ - ПРИВЯЗЫВАЕМ ОБРАБОТЧИКИ
                setTimeout(function() {
                    attachChatClickHandlers();
                    console.log('Обработчики кликов привязаны');
                }, 100);
            }
        });
    });
}

// ========== СОЗДАНИЕ ЭЛЕМЕНТА ЧАТА (ИСПРАВЛЕНАЯ ВЕРСИЯ) ==========
async function createChatItem(chatId, chatData, container) {
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
    
    if (preview && preview.length > 50) {
        preview = preview.substring(0, 47) + '...';
    }
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatarUrl = chatData.avatar || '';
        badge = '<span class="chat-type-badge">👥</span>';
        render();
    } 
    else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatarUrl = chatData.avatar || '';
        badge = '<span class="chat-type-badge">📢</span>';
        render();
    } 
    else {
        // Личный чат
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== window.currentUser.uid) {
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
            render();
        } else {
            name = 'Пользователь';
            render();
        }
    }
    
    function render() {
        // ВАЖНО: если есть avatarUrl - НЕ показываем эмодзи, только фон
        var hasAvatar = avatarUrl && avatarUrl !== '';
        
        // Стиль для фона
        var avatarStyle = hasAvatar ? 'background-image: url(' + avatarUrl + '); background-size: cover; background-position: center;' : '';
        
        // Определяем класс для дефолтной аватарки (если нет картинки)
        var defaultClass = '';
        if (!hasAvatar) {
            if (chatData.type === 'group') {
                defaultClass = 'default-avatar-group';
                avatarContent = '';
            } else if (chatData.type === 'channel') {
                defaultClass = 'default-avatar-channel';
                avatarContent = '';
            } else {
                defaultClass = 'default-avatar-user';
                avatarContent = '';
            }
        } else {
            avatarContent = ''; // Если есть картинка - текст пустой
        }
        
        div.innerHTML = `
            <div class="chat-item-avatar">
                <div class="avatar ${defaultClass}" style="${avatarStyle}">${avatarContent}</div>
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
    
    return Promise.resolve();
}
// ========== ПРИВЯЗКА ОБРАБОТЧИКОВ КЛИКОВ ==========
function attachChatClickHandlers() {
    var chatItems = document.querySelectorAll('.chat-item');
    console.log('Привязка обработчиков к чатам, найдено:', chatItems.length);
    
    chatItems.forEach(function(item) {
        // Убираем старые обработчики
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

// ========== ОТКРЫТИЕ ЧАТА ПО ID ==========
async function openChatById(chatId) {
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
            showNotification('Чат не найден', 'error');
            return;
        }
        
        openChatWithData(chatId, chatData);
    } catch (err) {
        console.error('Ошибка открытия чата:', err);
        showNotification('Ошибка открытия чата', 'error');
    }
}

// ========== ОТКРЫТИЕ ЧАТА С ДАННЫМИ (ИСПРАВЛЕННАЯ ВЕРСИЯ) ==========
async function openChatWithData(chatId, chatData) {
    console.log('openChatWithData:', chatId, chatData.type);
    
    window.currentChatId = chatId;
    window.currentChatData = chatData;
    window.currentChatData.chatId = chatId;
    
    // Устанавливаем otherUserId для личных чатов
    if (chatData.type === 'private' && chatData.participants) {
        for (var i = 0; i < chatData.participants.length; i++) {
            if (chatData.participants[i] !== window.currentUser.uid) {
                window.currentChatData.otherUserId = chatData.participants[i];
                break;
            }
        }
    }
    
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
    
    // ОБНОВЛЯЕМ ШАПКУ (с полным сбросом)
    await updateChatHeader(chatId, chatData);
    
    // НАСТРАИВАЕМ КЛИК ПО ШАПКЕ
    setTimeout(function() {
        setupChatHeaderClick();
    }, 100);
    
    // Загружаем сообщения
    loadMessages(chatId);
    
    // Настраиваем слушатель печати
    setupTypingListener(chatId);
}

// ========== ОБНОВЛЕНИЕ ШАПКИ ЧАТА (ИСПРАВЛЕННАЯ ВЕРСИЯ) ==========
async function updateChatHeader(chatId, chatData) {
    var chatUsername = document.getElementById('chat-username');
    var chatStatus = document.getElementById('chat-status');
    var chatAvatar = document.getElementById('chat-avatar');
    
    if (!chatUsername) return;
    
    // СБРАСЫВАЕМ АВАТАРКУ ПЕРЕД УСТАНОВКОЙ НОВОЙ (ВАЖНО!)
    if (chatAvatar) {
        chatAvatar.style.backgroundImage = '';
        chatAvatar.style.background = '';
        chatAvatar.textContent = '';
        // Удаляем все классы дефолтных аватарок
        chatAvatar.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
    }
    
    if (chatData.type === 'group') {
        chatUsername.textContent = chatData.name || 'Группа';
        if (chatStatus) {
            var membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
            chatStatus.textContent = membersCount + ' участников';
        }
        if (chatAvatar) {
            if (chatData.avatar && chatData.avatar !== '') {
                // Есть картинка - показываем её, без эмодзи
                chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
                chatAvatar.style.backgroundSize = 'cover';
                chatAvatar.style.backgroundPosition = 'center';
                chatAvatar.textContent = '';
            } else {
                // Нет картинки - показываем эмодзи и дефолтный класс
                chatAvatar.style.backgroundImage = '';
                chatAvatar.textContent = '👥';
                chatAvatar.classList.add('default-avatar-group');
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
            if (chatData.avatar && chatData.avatar !== '') {
                chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
                chatAvatar.style.backgroundSize = 'cover';
                chatAvatar.style.backgroundPosition = 'center';
                chatAvatar.textContent = '';
            } else {
                chatAvatar.style.backgroundImage = '';
                chatAvatar.textContent = '📢';
                chatAvatar.classList.add('default-avatar-channel');
            }
        }
    } 
    else {
        // Личный чат
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== window.currentUser.uid) {
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
                if (userData.avatar && userData.avatar !== '') {
                    // Есть картинка - показываем её, без эмодзи
                    chatAvatar.style.backgroundImage = 'url(' + userData.avatar + ')';
                    chatAvatar.style.backgroundSize = 'cover';
                    chatAvatar.style.backgroundPosition = 'center';
                    chatAvatar.textContent = '';
                } else {
                    // Нет картинки - показываем эмодзи и дефолтный класс
                    chatAvatar.style.backgroundImage = '';
                    chatAvatar.textContent = '👤';
                    chatAvatar.classList.add('default-avatar-user');
                }
            }
        } else {
            chatUsername.textContent = 'Пользователь';
            if (chatStatus) chatStatus.textContent = 'неизвестно';
            if (chatAvatar) {
                chatAvatar.style.backgroundImage = '';
                chatAvatar.textContent = '👤';
                chatAvatar.classList.add('default-avatar-user');
            }
        }
    }
    
    console.log('Шапка чата обновлена для типа:', chatData.type);
}
// ========== НАСТРОЙКА КЛИКА ПО ШАПКЕ ==========
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

// ========== ОТКРЫТИЕ ПРОФИЛЯ ПРИ КЛИКЕ НА ШАПКУ ЧАТА (ИСПРАВЛЕННАЯ) ==========
function openChatProfile() {
    console.log('=== openChatProfile ВЫЗВАНА ===');
    console.log('currentChatData:', window.currentChatData);
    
    if (!window.currentChatData) {
        showNotification('Сначала откройте чат', 'error');
        return;
    }
    
    var chatType = window.currentChatData.type;
    console.log('Тип чата:', chatType);
    
    if (chatType === 'private') {
        // Личный чат - открываем профиль пользователя
        var otherUserId = window.currentChatData.otherUserId;
        
        if (!otherUserId && window.currentChatData.participants) {
            for (var i = 0; i < window.currentChatData.participants.length; i++) {
                if (window.currentChatData.participants[i] !== window.currentUser.uid) {
                    otherUserId = window.currentChatData.participants[i];
                    break;
                }
            }
        }
        
        console.log('otherUserId:', otherUserId);
        
        if (otherUserId) {
            // ВЫЗЫВАЕМ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
            if (typeof window.openUserProfile === 'function') {
                window.openUserProfile(otherUserId);
            } else {
                console.error('openUserProfile не найдена');
                showNotification('Профиль пользователя временно недоступен', 'error');
            }
        } else {
            showNotification('Не удалось определить пользователя', 'error');
        }
    } 
    else if (chatType === 'group') {
        console.log('Открываем профиль группы:', window.currentChatId);
        if (typeof window.openGroupProfile === 'function') {
            window.openGroupProfile(window.currentChatId);
        } else {
            console.error('openGroupProfile не найдена');
            showNotification('Профиль группы временно недоступен', 'error');
        }
    } 
    else if (chatType === 'channel') {
        console.log('Открываем профиль канала:', window.currentChatId);
        if (typeof window.openChannelProfile === 'function') {
            window.openChannelProfile(window.currentChatId);
        } else {
            showNotification('Профиль канала временно недоступен', 'error');
        }
    }
}
// ========== НАСТРОЙКА КЛИКА ПО ШАПКЕ (УСИЛЕННАЯ) ==========
function setupChatHeaderClick() {
    console.log('setupChatHeaderClick: ищем элемент шапки');
    
    // Ищем элемент разными способами
    var chatUserInfo = document.querySelector('.chat-user-info');
    if (!chatUserInfo) {
        chatUserInfo = document.querySelector('#active-chat .chat-user-info');
    }
    if (!chatUserInfo) {
        chatUserInfo = document.querySelector('.chat-header .chat-user-info');
    }
    if (!chatUserInfo) {
        // Ищем по классу внутри активного чата
        var activeChat = document.getElementById('active-chat');
        if (activeChat) {
            chatUserInfo = activeChat.querySelector('[style*="cursor: pointer"]');
        }
    }
    
    if (!chatUserInfo) {
        console.log('Элемент .chat-user-info не найден, повторная попытка через 500ms');
        setTimeout(setupChatHeaderClick, 500);
        return;
    }
    
    console.log('Элемент шапки найден, устанавливаем обработчик');
    
    // Убираем старые обработчики
    var newElement = chatUserInfo.cloneNode(true);
    chatUserInfo.parentNode.replaceChild(newElement, chatUserInfo);
    
    newElement.style.cursor = 'pointer';
    
    newElement.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('КЛИК ПО ШАПКЕ! Тип чата:', window.currentChatData?.type);
        openChatProfile();
    };
    
    console.log('Обработчик шапки успешно установлен');
}
// ========== НАСТРОЙКА КЛИКА ПО ШАПКЕ (УСИЛЕННАЯ ВЕРСИЯ) ==========
function setupChatHeaderClick() {
    console.log('setupChatHeaderClick: настройка обработчика');
    
    // Ищем элемент шапки разными селекторами
    var chatUserInfo = document.querySelector('.chat-user-info');
    if (!chatUserInfo) {
        chatUserInfo = document.querySelector('#active-chat .chat-user-info');
    }
    if (!chatUserInfo) {
        chatUserInfo = document.querySelector('.chat-header .chat-user-info');
    }
    
    if (!chatUserInfo) {
        console.log('Элемент .chat-user-info не найден');
        return;
    }
    
    console.log('Элемент шапки найден, устанавливаем обработчик');
    
    // Клонируем чтобы убрать старые обработчики
    var newElement = chatUserInfo.cloneNode(true);
    chatUserInfo.parentNode.replaceChild(newElement, chatUserInfo);
    
    // Устанавливаем стиль курсора
    newElement.style.cursor = 'pointer';
    
    // Привязываем обработчик
    newElement.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('КЛИК ПО ШАПКЕ ЧАТА!');
        openChatProfile();
    };
    
    console.log('Обработчик шапки успешно установлен');
}

// ========== ОБНОВЛЕННАЯ ФУНКЦИЯ ОТКРЫТИЯ ЧАТА ==========
async function openChatWithData(chatId, chatData) {
    console.log('openChatWithData:', chatId, chatData.type);
    
    window.currentChatId = chatId;
    window.currentChatData = chatData;
    window.currentChatData.chatId = chatId;
    
    // Устанавливаем otherUserId для личных чатов
    if (chatData.type === 'private' && chatData.participants) {
        for (var i = 0; i < chatData.participants.length; i++) {
            if (chatData.participants[i] !== window.currentUser.uid) {
                window.currentChatData.otherUserId = chatData.participants[i];
                console.log('Установлен otherUserId:', window.currentChatData.otherUserId);
                break;
            }
        }
    }
    
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
    
    // НАСТРАИВАЕМ КЛИК ПО ШАПКЕ (ВАЖНО!)
    setTimeout(function() {
        setupChatHeaderClick();
    }, 100);
    
    // Загружаем сообщения
    loadMessages(chatId);
    
    // Настраиваем слушатель печати
    setupTypingListener(chatId);
}

// ========== ЗАКРЫТИЕ ЧАТА ==========
function closeChat() {
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

// ========== ДОБАВЛЕНИЕ СООБЩЕНИЯ ==========
function appendMessage(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var isSent = message.senderId === window.currentUser.uid;
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
    if (window.currentChatData && window.currentChatData.type !== 'private' && !isSent && message.senderId) {
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
    if (!text || !window.currentChatId) return;
    
    var message = {
        type: 'text',
        text: text,
        senderId: window.currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    input.value = '';
    
    database.ref('messages/' + window.currentChatId).push(message).then(function() {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        database.ref('chats/' + window.currentChatId).update({
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
    if (!window.currentChatId) return;
    database.ref('typing/' + window.currentChatId + '/' + window.currentUser.uid).set(true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() {
        database.ref('typing/' + window.currentChatId + '/' + window.currentUser.uid).remove();
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
            if (uid !== window.currentUser.uid && data[uid] === true) {
                typingUsers.push(uid);
            }
        }
        
        if (typingUsers.length > 0) {
            statusEl.innerHTML = 'печатает...';
        } else {
            // Восстанавливаем обычный статус
            if (window.currentChatData) {
                updateChatHeader(window.currentChatId, window.currentChatData);
            }
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
        if (uid === window.currentUser.uid) continue;
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
    }
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
    
    var chatId = generateChatId(window.currentUser.uid, otherUserId);
    var chatSnapshot = await database.ref('chats/' + chatId).once('value');
    
    if (!chatSnapshot.exists()) {
        await database.ref('chats/' + chatId).set({
            type: 'private',
            participants: [window.currentUser.uid, otherUserId],
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Чат создан',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        await Promise.all([
            database.ref('userChats/' + window.currentUser.uid + '/' + chatId).set(true),
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

function openCreateGroupWizard() {
    closeCreateMenu();
    showNotification('Создание группы скоро будет доступно', 'info');
}

function openCreateChannelWizard() {
    closeCreateMenu();
    showNotification('Создание канала скоро будет доступно', 'info');
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
    window.openCreateGroupWizard = openCreateGroupWizard;
    window.openCreateChannelWizard = openCreateChannelWizard;
    
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
        if (window.currentUser && window.currentUser.uid) {
            loadChats();
        }
    }, 1000);
}

// Запускаем инициализацию
setTimeout(function() {
    initChat();
}, 1000);

// Глобальный обработчик кликов по чатам
document.addEventListener('click', function(e) {
    var chatItem = e.target.closest('.chat-item');
    if (!chatItem) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    var chatId = chatItem.getAttribute('data-chat-id');
    if (!chatId) return;
    
    console.log('Глобальный клик по чату:', chatId);
    
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
    }
    
    return false;
}, true);

console.log('chat.js полностью загружен и готов к работе');
// Проверяем, что функции из chat-profile.js загрузились
setTimeout(function() {
    if (typeof window.openGroupProfile === 'function') {
        console.log('✅ openGroupProfile загружена из chat-profile.js');
    } else {
        console.error('❌ openGroupProfile НЕ загружена! Проверьте порядок подключения скриптов');
    }
}, 2000);

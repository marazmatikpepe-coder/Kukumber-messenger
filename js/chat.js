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
    // Показываем информацию об ответе (добавить ПОСЛЕ let content = '')
// Показываем информацию об ответе (ДОЛЖНО БЫТЬ ВНУТРИ messageDiv)
if (message.replyTo) {
    var replyText = '';
    if (message.replyTo.type === 'image') replyText = '📷 Фото';
    else if (message.replyTo.type === 'gif') replyText = '🎬 GIF';
    else if (message.replyTo.type === 'audio') replyText = '🎤 Голосовое';
    else if (message.replyTo.type === 'video') replyText = '🎬 Видео';
    else if (message.replyTo.type === 'file') replyText = '📎 Файл';
    else replyText = message.replyTo.text;
    
    var displayReplyText = replyText.length > 50 ? replyText.substring(0, 47) + '...' : replyText;
    
    content += `
        <div class="message-reply" onclick="scrollToMessage('${message.replyTo.messageId}')" style="background: rgba(0,0,0,0.05); border-left: 3px solid var(--forest); padding: 6px 10px; border-radius: 10px; margin-bottom: 6px; cursor: pointer; font-size: 12px;">
            <div style="font-weight: 600; color: var(--forest);">↩️ ${escapeHtml(message.replyTo.senderName)}</div>
            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayReplyText)}</div>
        </div>
    `;
}
    
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
// ========== ОТПРАВКА СООБЩЕНИЙ ==========
function sendMessage() {
    var input = document.getElementById('message-input');
    if (!input) return;
    
    var text = input.value.trim();
    if (!text && !replyToMessageData) return;
    if (!text && replyToMessageData) {
        showNotification('Введите текст ответа', 'error');
        return;
    }
    if (!currentChatId) return;
    
    var message = {
        type: 'text',
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Добавляем информацию об ответе
    if (replyToMessageData) {
        message.replyTo = {
            messageId: replyToMessageData.id,
            text: replyToMessageData.text,
            senderName: replyToMessageData.senderName,
            type: replyToMessageData.type
        };
    }
    
    input.value = '';
    
    database.ref('messages/' + currentChatId).push(message).then(function() {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        if (replyToMessageData) {
            lastMsg = '↩️ Ответ: ' + lastMsg;
        }
        database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Очищаем ответ
        cancelReply();
        
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
// ========== СОЗДАНИЕ ГРУППЫ ==========
window.openCreateGroupWizard = function() {
    closeCreateMenu();
    
    var oldModal = document.getElementById('create-group-modal');
    if (oldModal) oldModal.remove();
    
    var modal = document.createElement('div');
    modal.id = 'create-group-modal';
    modal.className = 'modal';
    modal.style.zIndex = '10002';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    modal.innerHTML = `
        <div style="background: white; width: 90%; max-width: 380px; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="padding: 16px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 18px;">👥 Создать группу</h3>
                <button onclick="closeGroupModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            </div>
            <div style="padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div id="group-avatar-preview" style="width: 80px; height: 80px; margin: 0 auto; border-radius: 50%; background: #e8f5e8; display: flex; align-items: center; justify-content: center; font-size: 40px; cursor: pointer; background-size: cover; background-position: center;">👥</div>
                    <input type="file" id="group-avatar-input" accept="image/*" style="display: none;">
                    <button onclick="document.getElementById('group-avatar-input').click()" style="margin-top: 8px; background: none; border: none; color: #228B22; font-size: 13px; cursor: pointer;">Загрузить фото</button>
                </div>
                
                <input type="text" id="group-name-input" placeholder="Название группы" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 14px; font-size: 15px; box-sizing: border-box;">
                
                <textarea id="group-desc-input" placeholder="Описание" rows="2" style="width: 100%; padding: 12px; margin-bottom: 16px; border: 1px solid #ddd; border-radius: 14px; font-size: 14px; resize: none; box-sizing: border-box;"></textarea>
                
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <label style="flex: 1; text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 14px; cursor: pointer; background: #f9f9f9;">
                        <input type="radio" name="group-type" value="public" checked> 🌍 Публичная
                    </label>
                    <label style="flex: 1; text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 14px; cursor: pointer; background: #f9f9f9;">
                        <input type="radio" name="group-type" value="private"> 🔒 Приватная
                    </label>
                </div>
                
                <button onclick="createGroup()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #228B22, #32CD32); color: white; border: none; border-radius: 30px; font-size: 16px; font-weight: 600; cursor: pointer;">Создать группу</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    var avatarInput = document.getElementById('group-avatar-input');
    if (avatarInput) {
        avatarInput.onchange = function(e) {
            var file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var preview = document.getElementById('group-avatar-preview');
                    preview.style.backgroundImage = 'url(' + ev.target.result + ')';
                    preview.style.backgroundSize = 'cover';
                    preview.innerHTML = '';
                    window.groupAvatarFile = file;
                };
                reader.readAsDataURL(file);
            }
        };
    }
};

window.closeGroupModal = function() {
    var modal = document.getElementById('create-group-modal');
    if (modal) modal.remove();
    window.groupAvatarFile = null;
};

window.createGroup = async function() {
    var groupName = document.getElementById('group-name-input').value.trim();
    if (!groupName) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    var groupDesc = document.getElementById('group-desc-input').value.trim();
    var groupType = document.querySelector('input[name="group-type"]:checked').value;
    
    showNotification('Создание группы...', 'info');
    
    try {
        var avatarUrl = '';
        if (window.groupAvatarFile && typeof uploadToImgBB === 'function') {
            avatarUrl = await uploadToImgBB(window.groupAvatarFile);
        }
        
        var groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await database.ref('chats/' + groupId).set({
            type: 'group',
            name: groupName,
            description: groupDesc,
            avatar: avatarUrl,
            privacy: groupType,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            createdBy: currentUser.uid,
            lastMessage: 'Группа создана',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
            members: { [currentUser.uid]: true },
            admins: { [currentUser.uid]: true }
        });
        
        await database.ref('userChats/' + currentUser.uid + '/' + groupId).set(true);
        
        showNotification('Группа создана!', 'success');
        closeGroupModal();
        window.groupAvatarFile = null;
        
        if (typeof loadChats === 'function') loadChats();
        
        setTimeout(async function() {
            var chatData = await database.ref('chats/' + groupId).once('value');
            if (typeof openChatWithData === 'function') {
                openChatWithData(groupId, chatData.val());
            }
        }, 500);
        
    } catch (err) {
        console.error(err);
        showNotification('Ошибка создания группы', 'error');
    }
};

// ========== СОЗДАНИЕ КАНАЛА ==========
window.openCreateChannelWizard = function() {
    closeCreateMenu();
    
    var oldModal = document.getElementById('create-channel-modal');
    if (oldModal) oldModal.remove();
    
    var modal = document.createElement('div');
    modal.id = 'create-channel-modal';
    modal.className = 'modal';
    modal.style.zIndex = '10002';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    modal.innerHTML = `
        <div style="background: white; width: 90%; max-width: 380px; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="padding: 16px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 18px;">📢 Создать канал</h3>
                <button onclick="closeChannelModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            </div>
            <div style="padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div id="channel-avatar-preview" style="width: 80px; height: 80px; margin: 0 auto; border-radius: 50%; background: #e8f5e8; display: flex; align-items: center; justify-content: center; font-size: 40px; cursor: pointer; background-size: cover; background-position: center;">📢</div>
                    <input type="file" id="channel-avatar-input" accept="image/*" style="display: none;">
                    <button onclick="document.getElementById('channel-avatar-input').click()" style="margin-top: 8px; background: none; border: none; color: #228B22; font-size: 13px; cursor: pointer;">Загрузить фото</button>
                </div>
                
                <input type="text" id="channel-name-input" placeholder="Название канала" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 14px; font-size: 15px; box-sizing: border-box;">
                
                <div style="display: flex; align-items: center; border: 1px solid #ddd; border-radius: 14px; margin-bottom: 12px;">
                    <span style="padding: 0 12px; color: #228B22;">@</span>
                    <input type="text" id="channel-kname-input" placeholder="k-name" style="flex: 1; padding: 12px 12px 12px 0; border: none; font-size: 15px; outline: none;">
                </div>
                <small style="display: block; margin-top: -8px; margin-bottom: 12px; color: #999; font-size: 11px;">Латиница, цифры, _ (необязательно)</small>
                
                <textarea id="channel-desc-input" placeholder="Описание" rows="2" style="width: 100%; padding: 12px; margin-bottom: 16px; border: 1px solid #ddd; border-radius: 14px; font-size: 14px; resize: none; box-sizing: border-box;"></textarea>
                
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <label style="flex: 1; text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 14px; cursor: pointer; background: #f9f9f9;">
                        <input type="radio" name="channel-type" value="public" checked> 🌍 Публичный
                    </label>
                    <label style="flex: 1; text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 14px; cursor: pointer; background: #f9f9f9;">
                        <input type="radio" name="channel-type" value="private"> 🔒 Приватный
                    </label>
                </div>
                
                <button onclick="createChannel()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #228B22, #32CD32); color: white; border: none; border-radius: 30px; font-size: 16px; font-weight: 600; cursor: pointer;">Создать канал</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    var avatarInput = document.getElementById('channel-avatar-input');
    if (avatarInput) {
        avatarInput.onchange = function(e) {
            var file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var preview = document.getElementById('channel-avatar-preview');
                    preview.style.backgroundImage = 'url(' + ev.target.result + ')';
                    preview.style.backgroundSize = 'cover';
                    preview.innerHTML = '';
                    window.channelAvatarFile = file;
                };
                reader.readAsDataURL(file);
            }
        };
    }
};

window.closeChannelModal = function() {
    var modal = document.getElementById('create-channel-modal');
    if (modal) modal.remove();
    window.channelAvatarFile = null;
};

window.createChannel = async function() {
    var channelName = document.getElementById('channel-name-input').value.trim();
    if (!channelName) {
        showNotification('Введите название канала', 'error');
        return;
    }
    
    var channelKname = document.getElementById('channel-kname-input').value.trim().toLowerCase();
    var channelDesc = document.getElementById('channel-desc-input').value.trim();
    var channelType = document.querySelector('input[name="channel-type"]:checked').value;
    
    if (channelKname) {
        var knamePattern = /^[a-z0-9_]+$/;
        if (!knamePattern.test(channelKname)) {
            showNotification('K-name: только латиница, цифры и _', 'error');
            return;
        }
        
        var existing = await database.ref('channelKnames/' + channelKname).once('value');
        if (existing.exists()) {
            showNotification('K-name уже занят', 'error');
            return;
        }
    }
    
    showNotification('Создание канала...', 'info');
    
    try {
        var avatarUrl = '';
        if (window.channelAvatarFile && typeof uploadToImgBB === 'function') {
            avatarUrl = await uploadToImgBB(window.channelAvatarFile);
        }
        
        var channelId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await database.ref('chats/' + channelId).set({
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
            subscribers: { [currentUser.uid]: true },
            admins: { [currentUser.uid]: true }
        });
        
        await database.ref('userChats/' + currentUser.uid + '/' + channelId).set(true);
        
        if (channelKname) {
            await database.ref('channelKnames/' + channelKname).set(channelId);
        }
        
        showNotification('Канал создан!', 'success');
        closeChannelModal();
        window.channelAvatarFile = null;
        
        if (typeof loadChats === 'function') loadChats();
        
        setTimeout(async function() {
            var chatData = await database.ref('chats/' + channelId).once('value');
            if (typeof openChatWithData === 'function') {
                openChatWithData(channelId, chatData.val());
            }
        }, 500);
        
    } catch (err) {
        console.error(err);
        showNotification('Ошибка создания канала', 'error');
    }
};
// ========== КОНТЕКСТНОЕ МЕНЮ ДЛЯ СООБЩЕНИЙ ==========

var replyToMessageData = null; // Данные сообщения, на которое отвечаем

// Показ контекстного меню для сообщения
function showMessageContextMenu(event, messageId, messageData) {
    event.preventDefault();
    event.stopPropagation();
    
    var oldMenu = document.getElementById('message-context-menu');
    if (oldMenu) oldMenu.remove();
    
    var isOwnMessage = messageData.senderId === currentUser.uid;
    var isAdmin = window.isSuperAdmin === true;
    var isGroupAdmin = false;
    
    if (currentChatData && currentChatData.type === 'group') {
        isGroupAdmin = currentChatData.admins && currentChatData.admins[currentUser.uid];
    }
    
    var menuHtml = '<div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); min-width: 200px;">';
    
    if (messageData.text) {
        menuHtml += '<div class="context-menu-item" onclick="copyMessageText(\'' + messageId + '\')" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #eee;">';
        menuHtml += '<span style="font-size: 18px;">📋</span><span>Копировать текст</span></div>';
    }
    
    menuHtml += '<div class="context-menu-item" onclick="replyToMessage(\'' + messageId + '\')" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #eee;">';
    menuHtml += '<span style="font-size: 18px;">↩️</span><span>Ответить</span></div>';
    
    menuHtml += '<div class="context-menu-item" onclick="forwardMessage(\'' + messageId + '\')" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #eee;">';
    menuHtml += '<span style="font-size: 18px;">📤</span><span>Переслать</span></div>';
    
    menuHtml += '<div class="context-menu-item" onclick="showReactionPicker(\'' + messageId + '\')" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #eee;">';
    menuHtml += '<span style="font-size: 18px;">😊</span><span>Поставить реакцию</span></div>';
    
    if (isOwnMessage && messageData.type === 'text') {
        menuHtml += '<div class="context-menu-item" onclick="editMessage(\'' + messageId + '\', \'' + escapeHtml(messageData.text || '') + '\')" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #eee;">';
        menuHtml += '<span style="font-size: 18px;">✏️</span><span>Редактировать</span></div>';
    }
    
    if (isOwnMessage) {
        menuHtml += '<div class="context-menu-item" onclick="deleteForMe(\'' + messageId + '\')" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #eee;">';
        menuHtml += '<span style="font-size: 18px;">🗑️</span><span>Удалить у себя</span></div>';
    }
    
    if (isOwnMessage || isAdmin || isGroupAdmin) {
        menuHtml += '<div class="context-menu-item" onclick="deleteForEveryone(\'' + messageId + '\')" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; color: #dc3545;">';
        menuHtml += '<span style="font-size: 18px;">⚠️</span><span>Удалить у всех</span></div>';
    }
    
    menuHtml += '</div>';
    
    var menu = document.createElement('div');
    menu.id = 'message-context-menu';
    menu.style.cssText = 'position: fixed; z-index: 10001; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); min-width: 200px; overflow: hidden;';
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    var x = event.clientX;
    var y = event.clientY;
    
    if (event.touches) {
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
    }
    
    var menuRect = menu.getBoundingClientRect();
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    
    if (x + menuRect.width > windowWidth) x = windowWidth - menuRect.width - 10;
    if (y + menuRect.height > windowHeight) y = windowHeight - menuRect.height - 10;
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    setTimeout(function() {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
        document.addEventListener('touchstart', function closeMenuTouch(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('touchstart', closeMenuTouch);
            }
        });
    }, 10);
}

// Копировать текст сообщения
function copyMessageText(messageId) {
    var messageElement = document.querySelector('.message[data-message-id="' + messageId + '"]');
    if (messageElement) {
        var textElement = messageElement.querySelector('.message-text');
        if (textElement) {
            var text = textElement.innerText;
            navigator.clipboard.writeText(text);
            showNotification('Текст скопирован', 'success');
        }
    }
    closeMessageContextMenu();
}

// ========== ОТВЕТ НА СООБЩЕНИЕ (РАБОЧАЯ ВЕРСИЯ) ==========

var replyToMessageData = null; // ГЛОБАЛЬНАЯ ПЕРЕМЕННАЯ

function replyToMessage(messageId) {
    // Получаем полные данные сообщения
    database.ref('messages/' + currentChatId + '/' + messageId).once('value').then(function(snapshot) {
        var messageData = snapshot.val();
        if (!messageData) return;
        
        // Получаем имя отправителя
        var senderName = 'Пользователь';
        if (messageData.senderId !== currentUser.uid) {
            database.ref('users/' + messageData.senderId + '/username').once('value').then(function(nameSnap) {
                senderName = nameSnap.val() || 'Пользователь';
                showReplyIndicator(messageId, messageData, senderName);
            });
        } else {
            senderName = 'Вы';
            showReplyIndicator(messageId, messageData, senderName);
        }
    });
    
    closeMessageContextMenu();
}

function showReplyIndicator(messageId, messageData, senderName) {
    replyToMessageData = {
        id: messageId,
        text: messageData.text || 'Медиа',
        senderName: senderName,
        type: messageData.type || 'text'
    };
    
    // Удаляем старый индикатор, если есть
    var oldIndicator = document.getElementById('reply-indicator');
    if (oldIndicator) oldIndicator.remove();
    
    var replyIndicator = document.createElement('div');
    replyIndicator.id = 'reply-indicator';
    replyIndicator.style.cssText = 'background: var(--background); border-left: 4px solid var(--forest); padding: 8px 12px; border-radius: 12px; margin: 0 12px 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; cursor: pointer;';
    
    var replyText = replyToMessageData.text;
    if (replyToMessageData.type === 'image') replyText = '📷 Фото';
    else if (replyToMessageData.type === 'gif') replyText = '🎬 GIF';
    else if (replyToMessageData.type === 'audio') replyText = '🎤 Голосовое';
    else if (replyToMessageData.type === 'video') replyText = '🎬 Видео';
    else if (replyToMessageData.type === 'file') replyText = '📎 Файл';
    
    var displayText = replyText.length > 50 ? replyText.substring(0, 47) + '...' : replyText;
    
    replyIndicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
            <span>↩️</span>
            <div style="overflow: hidden;">
                <div style="font-weight: 600; font-size: 12px; color: var(--forest);">${escapeHtml(replyToMessageData.senderName)}</div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayText)}</div>
            </div>
        </div>
        <button onclick="cancelReply()" style="background: none; border: none; font-size: 18px; cursor: pointer;">×</button>
    `;
    
    replyIndicator.onclick = function(e) {
        if (e.target.tagName !== 'BUTTON') {
            scrollToMessage(replyToMessageData.id);
        }
    };
    
    var inputArea = document.querySelector('.message-input-area');
    if (inputArea) {
        inputArea.parentNode.insertBefore(replyIndicator, inputArea);
    }
    
    var messageInput = document.getElementById('message-input');
    if (messageInput) messageInput.focus();
}

function cancelReply() {
    replyToMessageData = null;
    var replyIndicator = document.getElementById('reply-indicator');
    if (replyIndicator) {
        replyIndicator.remove();
    }
}

function scrollToMessage(messageId) {
    var messageElement = document.querySelector('.message[data-message-id="' + messageId + '"]');
    if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        messageElement.style.transition = 'background-color 0.3s';
        messageElement.style.backgroundColor = 'rgba(34, 139, 34, 0.3)';
        
        setTimeout(function() {
            messageElement.style.backgroundColor = '';
        }, 1000);
    } else {
        showNotification('Сообщение не найдено', 'error');
    }
}

// Переслать сообщение
function forwardMessage(messageId) {
    closeMessageContextMenu();
    
    database.ref('messages/' + currentChatId + '/' + messageId).once('value').then(function(snapshot) {
        var message = snapshot.val();
        if (!message) return;
        showForwardDialog(message);
    });
}

function showForwardDialog(message) {
    var modalHtml = `
        <div id="forward-modal" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 400px; border-radius: 20px;">
                <div class="modal-header">
                    <h3>📤 Переслать</h3>
                    <button onclick="closeForwardModal()" class="btn-close">×</button>
                </div>
                <div style="padding: 15px; max-height: 400px; overflow-y: auto;">
                    <div id="forward-chats-list" style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="text-align: center; padding: 20px;">Загрузка чатов...</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('forward-modal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    database.ref('userChats/' + currentUser.uid).once('value').then(function(snapshot) {
        var userChats = snapshot.val();
        if (!userChats) {
            document.getElementById('forward-chats-list').innerHTML = '<div style="text-align: center; padding: 20px;">Нет чатов для пересылки</div>';
            return;
        }
        
        var chatIds = Object.keys(userChats);
        var chatsHtml = '';
        var processed = 0;
        
        chatIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value').then(function(chatSnap) {
                var chat = chatSnap.val();
                if (chat && chatId !== currentChatId) {
                    var chatName = '';
                    var chatIcon = '👤';
                    
                    if (chat.type === 'group') {
                        chatName = chat.name || 'Группа';
                        chatIcon = '👥';
                    } else if (chat.type === 'channel') {
                        chatName = chat.name || 'Канал';
                        chatIcon = '📢';
                    } else {
                        var otherId = chat.participants.find(id => id !== currentUser.uid);
                        if (otherId) {
                            database.ref('users/' + otherId + '/username').once('value').then(function(nameSnap) {
                                var name = nameSnap.val() || 'Пользователь';
                                chatsHtml += '<div class="forward-chat-item" data-chat-id="' + chatId + '" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;">';
                                chatsHtml += '<div style="width: 45px; height: 45px; background: #e8f5e8; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 22px;">' + chatIcon + '</div>';
                                chatsHtml += '<div><strong>' + escapeHtml(name) + '</strong><br><small style="color: #999;">Личный чат</small></div>';
                                chatsHtml += '</div>';
                                document.getElementById('forward-chats-list').innerHTML = chatsHtml;
                                attachForwardClicks(message);
                            });
                            return;
                        }
                    }
                    
                    chatsHtml += '<div class="forward-chat-item" data-chat-id="' + chatId + '" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;">';
                    chatsHtml += '<div style="width: 45px; height: 45px; background: #e8f5e8; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 22px;">' + chatIcon + '</div>';
                    chatsHtml += '<div><strong>' + escapeHtml(chatName) + '</strong><br><small style="color: #999;">' + (chat.type === 'group' ? 'Группа' : (chat.type === 'channel' ? 'Канал' : 'Личный чат')) + '</small></div>';
                    chatsHtml += '</div>';
                }
                processed++;
                
                if (processed === chatIds.length) {
                    if (chatsHtml === '') {
                        document.getElementById('forward-chats-list').innerHTML = '<div style="text-align: center; padding: 20px;">Нет других чатов</div>';
                    } else {
                        document.getElementById('forward-chats-list').innerHTML = chatsHtml;
                        attachForwardClicks(message);
                    }
                }
            });
        });
    });
}

function attachForwardClicks(message) {
    document.querySelectorAll('.forward-chat-item').forEach(function(item) {
        item.onclick = function() {
            var targetChatId = this.getAttribute('data-chat-id');
            forwardMessageToChat(message, targetChatId);
        };
    });
}

function forwardMessageToChat(message, targetChatId) {
    var forwardData = {
        type: message.type,
        text: message.text || '',
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        forwarded: true
    };
    
    if (message.imageUrl) forwardData.imageUrl = message.imageUrl;
    if (message.gifUrl) forwardData.gifUrl = message.gifUrl;
    if (message.videoUrl) forwardData.videoUrl = message.videoUrl;
    if (message.audioUrl) forwardData.audioUrl = message.audioUrl;
    if (message.fileUrl) {
        forwardData.fileUrl = message.fileUrl;
        forwardData.fileName = message.fileName;
    }
    
    database.ref('messages/' + targetChatId).push(forwardData).then(function() {
        var shortText = message.text ? (message.text.length > 50 ? message.text.substring(0, 47) + '...' : message.text) : 'Медиа';
        database.ref('chats/' + targetChatId).update({
            lastMessage: '📨 Переслано: ' + shortText,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification('Сообщение переслано', 'success');
        closeForwardModal();
    }).catch(function() {
        showNotification('Ошибка пересылки', 'error');
    });
}

function closeForwardModal() {
    var modal = document.getElementById('forward-modal');
    if (modal) modal.remove();
}

// Редактировать сообщение
function editMessage(messageId, currentText) {
    closeMessageContextMenu();
    
    var newText = prompt('Редактировать сообщение:', currentText);
    if (newText && newText.trim() && newText !== currentText) {
        database.ref('messages/' + currentChatId + '/' + messageId).update({
            text: newText.trim(),
            edited: true,
            editedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(function() {
            showNotification('Сообщение отредактировано', 'success');
        }).catch(function() {
            showNotification('Ошибка редактирования', 'error');
        });
    }
}

// Удалить у себя
function deleteForMe(messageId) {
    closeMessageContextMenu();
    
    if (confirm('Удалить это сообщение только у себя?')) {
        database.ref('messages/' + currentChatId + '/' + messageId).remove().then(function() {
            showNotification('Сообщение удалено', 'success');
        }).catch(function() {
            showNotification('Ошибка удаления', 'error');
        });
    }
}

// Удалить у всех
function deleteForEveryone(messageId) {
    closeMessageContextMenu();
    
    if (confirm('Удалить это сообщение у всех участников? Это действие необратимо!')) {
        database.ref('messages/' + currentChatId + '/' + messageId).remove().then(function() {
            showNotification('Сообщение удалено у всех', 'success');
        }).catch(function() {
            showNotification('Ошибка удаления', 'error');
        });
    }
}

// Реакции
function showReactionPicker(messageId) {
    closeMessageContextMenu();
    
    var reactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];
    
    var picker = document.createElement('div');
    picker.id = 'reaction-picker';
    picker.style.cssText = 'position: fixed; z-index: 10002; background: white; border-radius: 40px; padding: 8px 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; gap: 8px; left: 50%; transform: translateX(-50%); bottom: 100px;';
    
    reactions.forEach(function(r) {
        var span = document.createElement('span');
        span.textContent = r;
        span.style.cssText = 'font-size: 28px; cursor: pointer; padding: 5px; transition: transform 0.1s;';
        span.onclick = function() { addReaction(messageId, r); };
        picker.appendChild(span);
    });
    
    var closeSpan = document.createElement('span');
    closeSpan.textContent = '✕';
    closeSpan.style.cssText = 'font-size: 24px; cursor: pointer; padding: 5px; color: #999;';
    closeSpan.onclick = closeReactionPicker;
    picker.appendChild(closeSpan);
    
    document.body.appendChild(picker);
}

function closeReactionPicker() {
    var picker = document.getElementById('reaction-picker');
    if (picker) picker.remove();
}

function addReaction(messageId, reaction) {
    var reactionRef = database.ref('messageReactions/' + messageId + '/' + currentUser.uid);
    reactionRef.set(reaction);
    showNotification('Реакция добавлена', 'success');
    closeReactionPicker();
}

function closeMessageContextMenu() {
    var menu = document.getElementById('message-context-menu');
    if (menu) menu.remove();
}

// Добавляем обработчики для сообщений
function addContextMenuToMessages() {
    var messages = document.querySelectorAll('.message');
    messages.forEach(function(msg) {
        if (msg.hasAttribute('data-context-attached')) return;
        
        msg.setAttribute('data-context-attached', 'true');
        
        msg.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            var messageId = this.getAttribute('data-message-id');
            var messageData = window.tempMessageData ? window.tempMessageData[messageId] : null;
            
            if (!messageData) {
                database.ref('messages/' + currentChatId + '/' + messageId).once('value').then(function(snap) {
                    var data = snap.val();
                    if (data) {
                        if (!window.tempMessageData) window.tempMessageData = {};
                        window.tempMessageData[messageId] = data;
                        showMessageContextMenu(e, messageId, data);
                    }
                });
            } else {
                showMessageContextMenu(e, messageId, messageData);
            }
        });
        
        var touchTimer = null;
        msg.addEventListener('touchstart', function(e) {
            touchTimer = setTimeout(function() {
                var messageId = msg.getAttribute('data-message-id');
                database.ref('messages/' + currentChatId + '/' + messageId).once('value').then(function(snap) {
                    var data = snap.val();
                    if (data) {
                        showMessageContextMenu(e, messageId, data);
                    }
                });
            }, 500);
        });
        
        msg.addEventListener('touchend', function() {
            if (touchTimer) clearTimeout(touchTimer);
        });
        
        msg.addEventListener('touchmove', function() {
            if (touchTimer) clearTimeout(touchTimer);
        });
    });
}

// Наблюдатель за новыми сообщениями
var messagesObserver = new MutationObserver(function() {
    addContextMenuToMessages();
});

setTimeout(function() {
    var messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesObserver.observe(messagesContainer, { childList: true, subtree: true });
        addContextMenuToMessages();
    }
}, 1000);
// ========== СИСТЕМА ОТВЕТОВ НА СООБЩЕНИЯ (ДОБАВЛЕНА В КОНЕЦ) ==========

// Глобальная переменная для хранения данных ответа
window.ReplyToData = null;

// Функция ответа на сообщение
window.ReplyToMessage = function(messageId) {
    console.log('ReplyToMessage вызван для:', messageId);
    
    database.ref('messages/' + currentChatId + '/' + messageId).once('value').then(function(snapshot) {
        var msg = snapshot.val();
        if (!msg) return;
        
        // Получаем имя отправителя
        if (msg.senderId === currentUser.uid) {
            window.showReplyBar(messageId, msg, 'Вы');
        } else {
            database.ref('users/' + msg.senderId + '/username').once('value').then(function(nameSnap) {
                var senderName = nameSnap.val() || 'Пользователь';
                window.showReplyBar(messageId, msg, senderName);
            });
        }
    });
};

// Показать панель ответа
window.showReplyBar = function(messageId, msg, senderName) {
    // Сохраняем данные
    window.ReplyToData = {
        id: messageId,
        text: msg.text || 'Медиа',
        senderName: senderName,
        type: msg.type || 'text'
    };
    
    // Удаляем старую панель
    var oldBar = document.getElementById('replyBar');
    if (oldBar) oldBar.remove();
    
    // Создаём панель
    var bar = document.createElement('div');
    bar.id = 'replyBar';
    bar.style.cssText = 'background: #e8f5e8; border-left: 4px solid #228B22; padding: 10px 12px; border-radius: 12px; margin: 0 12px 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; cursor: pointer;';
    
    var replyText = window.ReplyToData.text;
    if (window.ReplyToData.type === 'image') replyText = '📷 Фото';
    else if (window.ReplyToData.type === 'gif') replyText = '🎬 GIF';
    else if (window.ReplyToData.type === 'audio') replyText = '🎤 Голосовое';
    else if (window.ReplyToData.type === 'video') replyText = '🎬 Видео';
    else if (window.ReplyToData.type === 'file') replyText = '📎 Файл';
    
    var displayText = replyText.length > 50 ? replyText.substring(0, 47) + '...' : replyText;
    
    bar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
            <span style="font-size: 16px;">↩️</span>
            <div style="overflow: hidden;">
                <div style="font-weight: 600; font-size: 12px; color: #228B22;">${escapeHtml(window.ReplyToData.senderName)}</div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayText)}</div>
            </div>
        </div>
        <button id="cancelReplyBtn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
    `;
    
    // Клик по панели - скролл к сообщению
    bar.onclick = function(e) {
        if (e.target.id !== 'cancelReplyBtn') {
            window.scrollToRepliedMessage(window.ReplyToData.id);
        }
    };
    
    // Кнопка отмены
    var cancelBtn = bar.querySelector('#cancelReplyBtn');
    if (cancelBtn) {
        cancelBtn.onclick = function(e) {
            e.stopPropagation();
            window.cancelReplyBar();
        };
    }
    
    var inputArea = document.querySelector('.message-input-area');
    if (inputArea) {
        inputArea.parentNode.insertBefore(bar, inputArea);
    }
    
    document.getElementById('message-input').focus();
};

// Отмена ответа
window.cancelReplyBar = function() {
    window.ReplyToData = null;
    var bar = document.getElementById('replyBar');
    if (bar) bar.remove();
};

// Скролл к сообщению и подсветка
window.scrollToRepliedMessage = function(messageId) {
    var msgElement = document.querySelector('.message[data-message-id="' + messageId + '"]');
    if (msgElement) {
        msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Подсветка
        var originalBg = msgElement.style.backgroundColor;
        msgElement.style.transition = 'background-color 0.3s';
        msgElement.style.backgroundColor = 'rgba(34, 139, 34, 0.3)';
        
        setTimeout(function() {
            msgElement.style.backgroundColor = '';
            setTimeout(function() {
                msgElement.style.transition = '';
            }, 300);
        }, 1000);
    }
};

// ПЕРЕОПРЕДЕЛЯЕМ ФУНКЦИЮ sendMessage ДЛЯ ПОДДЕРЖКИ ОТВЕТОВ
var originalSendMessage = window.sendMessage;
window.sendMessage = function() {
    var input = document.getElementById('message-input');
    if (!input) return;
    
    var text = input.value.trim();
    if (!text && !window.ReplyToData) return;
    if (!text && window.ReplyToData) {
        showNotification('Введите текст ответа', 'error');
        return;
    }
    if (!window.currentChatId) return;
    
    var message = {
        type: 'text',
        text: text,
        senderId: window.currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Добавляем информацию об ответе
    if (window.ReplyToData) {
        message.replyTo = {
            messageId: window.ReplyToData.id,
            text: window.ReplyToData.text,
            senderName: window.ReplyToData.senderName,
            type: window.ReplyToData.type
        };
    }
    
    input.value = '';
    
    database.ref('messages/' + window.currentChatId).push(message).then(function() {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        if (window.ReplyToData) {
            lastMsg = '↩️ Ответ: ' + lastMsg;
        }
        database.ref('chats/' + window.currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Очищаем панель ответа
        window.cancelReplyBar();
        
        if (typeof KukumberSounds !== 'undefined') {
            KukumberSounds.playSend();
        }
    }).catch(function(err) {
        console.error('Ошибка отправки:', err);
        showNotification('Ошибка отправки', 'error');
        input.value = text;
    });
};

// Добавляем отображение ответа в сообщениях (переопределяем appendMessage)
var originalAppendMessage = window.appendMessage;
window.appendMessage = function(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var isSent = message.senderId === window.currentUser.uid;
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
    messageDiv.setAttribute('data-message-id', message.id);
    
    var content = '';
    
    // ОТОБРАЖАЕМ БЛОК С ОТВЕТОМ
    if (message.replyTo) {
        var replyText = '';
        if (message.replyTo.type === 'image') replyText = '📷 Фото';
        else if (message.replyTo.type === 'gif') replyText = '🎬 GIF';
        else if (message.replyTo.type === 'audio') replyText = '🎤 Голосовое';
        else if (message.replyTo.type === 'video') replyText = '🎬 Видео';
        else if (message.replyTo.type === 'file') replyText = '📎 Файл';
        else replyText = message.replyTo.text;
        
        var displayReplyText = replyText.length > 50 ? replyText.substring(0, 47) + '...' : replyText;
        
        content += `
            <div class="message-reply" onclick="window.scrollToRepliedMessage('${message.replyTo.messageId}')" style="background: rgba(0,0,0,0.05); border-left: 3px solid #228B22; padding: 6px 10px; border-radius: 10px; margin-bottom: 6px; cursor: pointer; font-size: 12px;">
                <div style="font-weight: 600; color: #228B22;">↩️ ${escapeHtml(message.replyTo.senderName)}</div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayReplyText)}</div>
            </div>
        `;
    }
    
    // Текст сообщения
    if (message.type === 'text') {
        var textContent = message.text || '';
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content += '<div class="message-text" style="word-break:break-word; white-space:normal;">' + escapeHtml(textContent) + '</div>';
    } else if (message.type === 'image') {
        content += '<div class="message-image" onclick="openLightbox(\'' + message.imageUrl + '\')"><img src="' + message.imageUrl + '" style="max-width:200px; max-height:200px; border-radius:12px;"></div>';
        if (message.caption) content += '<div class="message-text">' + escapeHtml(message.caption) + '</div>';
    } else if (message.type === 'gif') {
        content += '<div class="gif-message"><img src="' + message.gifUrl + '" style="max-width:200px; border-radius:12px;"><span class="gif-badge">GIF</span></div>';
    } else if (message.type === 'audio') {
        content += '<div class="audio-message">🎤 Голосовое сообщение</div>';
    } else {
        content += '<div class="message-text">' + escapeHtml(message.text || 'Медиа') + '</div>';
    }
    
    messageDiv.innerHTML = `
        <div class="message-content">
            ${content}
            <div class="message-time">${formatTime(message.timestamp)}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    // Сохраняем данные для контекстного меню
    if (!window.tempMessageData) window.tempMessageData = {};
    window.tempMessageData[message.id] = message;
};

// Подключаем обработчик для пункта "Ответить" в контекстном меню
// Перехватываем создание контекстного меню
if (typeof showMessageContextMenu === 'function') {
    var originalShowMessageContextMenu = window.showMessageContextMenu;
    window.showMessageContextMenu = function(event, messageId, messageData) {
        // Вызываем оригинальную функцию
        if (originalShowMessageContextMenu) {
            originalShowMessageContextMenu(event, messageId, messageData);
        }
        
        // Добавляем свой обработчик через небольшую задержку
        setTimeout(function() {
            var menuItems = document.querySelectorAll('#message-context-menu .context-menu-item');
            for (var i = 0; i < menuItems.length; i++) {
                var item = menuItems[i];
                if (item.innerText.includes('Ответить') || item.innerText.includes('Reply')) {
                    var oldOnclick = item.onclick;
                    item.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.ReplyToMessage(messageId);
                        var menu = document.getElementById('message-context-menu');
                        if (menu) menu.remove();
                    };
                }
            }
        }, 10);
    };
}

console.log('✅ Система ответов на сообщения успешно добавлена!');
// ========== ЭФФЕКТ ВИБРАЦИИ И ПОДСВЕТКА ПРИ ПЕРЕХОДЕ К СООБЩЕНИЮ ==========

// Переопределяем функцию scrollToRepliedMessage с эффектами
window.scrollToRepliedMessage = function(messageId) {
    var msgElement = document.querySelector('.message[data-message-id="' + messageId + '"]');
    if (msgElement) {
        // Плавная прокрутка
        msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Получаем цвет темы
        var themeColor = getComputedStyle(document.documentElement).getPropertyValue('--forest').trim() || '#228B22';
        
        // Создаём эффект "вибрации" (пульсации)
        msgElement.style.transition = 'all 0.2s ease';
        msgElement.style.transform = 'scale(1.02)';
        msgElement.style.boxShadow = '0 0 0 3px ' + themeColor;
        msgElement.style.zIndex = '100';
        
        // Подсветка фона
        var originalBg = msgElement.style.backgroundColor;
        msgElement.style.backgroundColor = themeColor + '40'; // 40 = 25% прозрачности
        
        setTimeout(function() {
            msgElement.style.transform = 'scale(1)';
            msgElement.style.boxShadow = '';
            
            setTimeout(function() {
                msgElement.style.backgroundColor = '';
                msgElement.style.transition = '';
                msgElement.style.zIndex = '';
            }, 500);
        }, 300);
        
        // Дополнительная вибрация на мобильных устройствах
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }
        
        // Добавляем анимацию пульсации через CSS класс
        msgElement.classList.add('message-highlight');
        setTimeout(function() {
            msgElement.classList.remove('message-highlight');
        }, 1000);
    } else {
        showNotification('Сообщение не найдено', 'error');
    }
};

// Добавляем CSS для эффекта подсветки
var highlightStyle = document.createElement('style');
highlightStyle.textContent = `
    @keyframes messageGlow {
        0% {
            box-shadow: 0 0 0 0 var(--forest);
            transform: scale(1);
        }
        50% {
            box-shadow: 0 0 0 8px var(--forest);
            transform: scale(1.02);
        }
        100% {
            box-shadow: 0 0 0 0 var(--forest);
            transform: scale(1);
        }
    }
    
    .message-highlight {
        animation: messageGlow 0.8s ease-out !important;
    }
    
    .message-reply {
        transition: background 0.2s;
    }
    
    .message-reply:hover {
        background: rgba(34, 139, 34, 0.15) !important;
    }
    
    body.night-mode .message-reply {
        background: rgba(50, 205, 50, 0.15) !important;
    }
    
    body.night-mode .message-reply:hover {
        background: rgba(50, 205, 50, 0.25) !important;
    }
`;
document.head.appendChild(highlightStyle);

// Также обновляем стиль панели ответа под тему
var replyBarStyle = document.createElement('style');
replyBarStyle.textContent = `
    #replyBar {
        background: var(--background) !important;
        border-left-color: var(--forest) !important;
    }
    #replyBar div[style*="font-weight: 600"] {
        color: var(--forest) !important;
    }
    body.night-mode #replyBar {
        background: #2a2a2a !important;
    }
`;
document.head.appendChild(replyBarStyle);

console.log('✅ Эффект вибрации и подсветка добавлены!');
// ========== ПЕРЕСЫЛКА СООБЩЕНИЙ (РАСШИРЕННАЯ ВЕРСИЯ) - ДОБАВЛЕНО В КОНЕЦ ==========

var selectedForwardUsers = [];
var forwardMessageData = null;

// Функция пересылки (вызывается из контекстного меню)
window.forwardMessage = function(messageId) {
    if (typeof closeMessageContextMenu === 'function') closeMessageContextMenu();
    
    database.ref('messages/' + currentChatId + '/' + messageId).once('value').then(function(snapshot) {
        var message = snapshot.val();
        if (!message) return;
        
        forwardMessageData = message;
        showForwardDialog();
    });
};

function showForwardDialog() {
    selectedForwardUsers = [];
    
    var modalHtml = `
        <div id="forward-modal" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 450px; width: 90%; border-radius: 24px; background: white; overflow: hidden; display: flex; flex-direction: column; max-height: 85vh;">
                <div class="modal-header" style="padding: 15px 20px; border-bottom: 1px solid #eee; flex-shrink: 0;">
                    <h3 style="margin: 0; font-size: 18px;">📤 Переслать</h3>
                    <button onclick="closeForwardModal()" class="btn-close">×</button>
                </div>
                
                <!-- Поиск -->
                <div style="padding: 12px 20px; border-bottom: 1px solid #eee;">
                    <div style="display: flex; align-items: center; background: #f5f5f5; border-radius: 30px; padding: 0 15px;">
                        <span style="font-size: 16px;">🔍</span>
                        <input type="text" id="forward-search-input" placeholder="Поиск по чатам..." style="flex: 1; padding: 12px 10px; border: none; background: transparent; outline: none; font-size: 14px;">
                    </div>
                </div>
                
                <!-- Список чатов -->
                <div id="forward-chats-list" style="flex: 1; overflow-y: auto; padding: 10px 0; max-height: 350px;">
                    <div style="text-align: center; padding: 30px;">Загрузка чатов...</div>
                </div>
                
                <!-- Выбранные пользователи -->
                <div id="selected-users-container" style="padding: 10px 20px; border-top: 1px solid #eee; background: #f9f9f9; display: none;">
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;" id="selected-users-list"></div>
                </div>
                
                <!-- Подпись и отправка -->
                <div style="padding: 15px 20px; border-top: 1px solid #eee; background: white;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="text" id="forward-caption" placeholder="Добавить подпись..." style="flex: 1; padding: 12px 15px; border: 1px solid #ddd; border-radius: 30px; font-size: 14px; outline: none;">
                        <button id="forward-settings-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 8px;">💡</button>
                        <button id="send-forward-btn" style="background: linear-gradient(135deg, #228B22, #32CD32); color: white; border: none; width: 44px; height: 44px; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">➤</button>
                    </div>
                    <div id="forward-error" style="color: #dc3545; font-size: 12px; margin-top: 8px; display: none;">Выберите хотя бы одного получателя</div>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('forward-modal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    loadForwardChats();
    
    var searchInput = document.getElementById('forward-search-input');
    if (searchInput) {
        searchInput.oninput = function() {
            filterForwardChats(this.value.toLowerCase());
        };
    }
    
    var settingsBtn = document.getElementById('forward-settings-btn');
    if (settingsBtn) {
        settingsBtn.onclick = showForwardSettings;
    }
    
    var sendBtn = document.getElementById('send-forward-btn');
    if (sendBtn) {
        sendBtn.onclick = sendForwardMessages;
    }
}

function loadForwardChats() {
    var container = document.getElementById('forward-chats-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 30px;">Загрузка чатов...</div>';
    
    database.ref('userChats/' + currentUser.uid).once('value').then(function(snapshot) {
        var userChats = snapshot.val();
        if (!userChats) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; color: #999;">Нет чатов для пересылки</div>';
            return;
        }
        
        var chatIds = Object.keys(userChats);
        var chatsArray = [];
        var processed = 0;
        
        if (chatIds.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; color: #999;">Нет чатов для пересылки</div>';
            return;
        }
        
        chatIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value').then(function(chatSnap) {
                var chat = chatSnap.val();
                if (chat && chatId !== currentChatId) {
                    var chatInfo = {
                        id: chatId,
                        type: chat.type,
                        name: '',
                        avatar: '',
                        participants: chat.participants
                    };
                    
                    if (chat.type === 'group') {
                        chatInfo.name = chat.name || 'Группа';
                        chatInfo.avatar = chat.avatar || '';
                        chatInfo.icon = '👥';
                        chatsArray.push(chatInfo);
                        processed++;
                        checkComplete();
                    } else if (chat.type === 'channel') {
                        chatInfo.name = chat.name || 'Канал';
                        chatInfo.avatar = chat.avatar || '';
                        chatInfo.icon = '📢';
                        chatsArray.push(chatInfo);
                        processed++;
                        checkComplete();
                    } else {
                        var otherId = chat.participants.find(function(id) { return id !== currentUser.uid; });
                        if (otherId) {
                            database.ref('users/' + otherId).once('value').then(function(userSnap) {
                                var userData = userSnap.val();
                                if (userData) {
                                    chatInfo.name = userData.username || 'Пользователь';
                                    chatInfo.avatar = userData.avatar || '';
                                    chatInfo.userId = otherId;
                                    chatInfo.icon = '';
                                    chatsArray.push(chatInfo);
                                }
                                processed++;
                                checkComplete();
                            });
                            return;
                        }
                        processed++;
                        checkComplete();
                    }
                } else {
                    processed++;
                    checkComplete();
                }
                
                function checkComplete() {
                    if (processed === chatIds.length) {
                        renderForwardChats(chatsArray);
                    }
                }
            });
        });
    });
}

function renderForwardChats(chatsArray) {
    var container = document.getElementById('forward-chats-list');
    if (!container) return;
    
    if (chatsArray.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #999;">Нет чатов для пересылки</div>';
        return;
    }
    
    container.innerHTML = '';
    window.forwardChatsData = chatsArray;
    
    chatsArray.forEach(function(chat) {
        var isSelected = selectedForwardUsers.some(function(u) { return u.id === chat.id; });
        
        var avatarStyle = chat.avatar ? 'background-image: url(' + chat.avatar + '); background-size: cover; background-position: center;' : '';
        var avatarContent = '';
        var avatarClass = '';
        
        if (!chat.avatar) {
            if (chat.type === 'group') {
                avatarContent = '👥';
                avatarClass = 'default-avatar-group';
            } else if (chat.type === 'channel') {
                avatarContent = '📢';
                avatarClass = 'default-avatar-channel';
            } else {
                avatarContent = '👤';
                avatarClass = 'default-avatar-user';
            }
        }
        
        var div = document.createElement('div');
        div.className = 'forward-chat-item';
        div.setAttribute('data-chat-id', chat.id);
        div.setAttribute('data-chat-type', chat.type);
        div.setAttribute('data-chat-name', chat.name);
        div.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;';
        
        div.innerHTML = `
            <div class="avatar ${avatarClass}" style="width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; ${avatarStyle}">${avatarContent}</div>
            <div style="flex: 1;">
                <div style="font-weight: 500;">${escapeHtml(chat.name)}</div>
                <div style="font-size: 11px; color: #999;">${chat.type === 'group' ? 'Группа' : (chat.type === 'channel' ? 'Канал' : 'Личный чат')}</div>
            </div>
            <div class="forward-checkbox" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ddd; background: white; display: flex; align-items: center; justify-content: center; transition: 0.2s;">
                ${isSelected ? '<span style="color: #228B22; font-size: 14px;">✓</span>' : ''}
            </div>
        `;
        
        div.onclick = (function(chatId) {
            return function() { toggleForwardUser(chatId); };
        })(chat.id);
        
        container.appendChild(div);
    });
}

function filterForwardChats(query) {
    if (!window.forwardChatsData) return;
    
    var filtered = window.forwardChatsData.filter(function(chat) {
        return chat.name.toLowerCase().includes(query);
    });
    
    var container = document.getElementById('forward-chats-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    filtered.forEach(function(chat) {
        var isSelected = selectedForwardUsers.some(function(u) { return u.id === chat.id; });
        
        var avatarStyle = chat.avatar ? 'background-image: url(' + chat.avatar + '); background-size: cover; background-position: center;' : '';
        var avatarContent = '';
        var avatarClass = '';
        
        if (!chat.avatar) {
            if (chat.type === 'group') {
                avatarContent = '👥';
                avatarClass = 'default-avatar-group';
            } else if (chat.type === 'channel') {
                avatarContent = '📢';
                avatarClass = 'default-avatar-channel';
            } else {
                avatarContent = '👤';
                avatarClass = 'default-avatar-user';
            }
        }
        
        var div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid #eee; cursor: pointer;';
        
        div.innerHTML = `
            <div class="avatar ${avatarClass}" style="width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; ${avatarStyle}">${avatarContent}</div>
            <div style="flex: 1;">
                <div style="font-weight: 500;">${escapeHtml(chat.name)}</div>
                <div style="font-size: 11px; color: #999;">${chat.type === 'group' ? 'Группа' : (chat.type === 'channel' ? 'Канал' : 'Личный чат')}</div>
            </div>
            <div class="forward-checkbox" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ddd; background: white; display: flex; align-items: center; justify-content: center;">
                ${isSelected ? '<span style="color: #228B22; font-size: 14px;">✓</span>' : ''}
            </div>
        `;
        
        div.onclick = (function(chatId) {
            return function() { toggleForwardUser(chatId); };
        })(chat.id);
        
        container.appendChild(div);
    });
}

function toggleForwardUser(chatId) {
    var index = -1;
    for (var i = 0; i < selectedForwardUsers.length; i++) {
        if (selectedForwardUsers[i].id === chatId) {
            index = i;
            break;
        }
    }
    
    // Находим данные чата
    var chatData = null;
    if (window.forwardChatsData) {
        for (var j = 0; j < window.forwardChatsData.length; j++) {
            if (window.forwardChatsData[j].id === chatId) {
                chatData = window.forwardChatsData[j];
                break;
            }
        }
    }
    
    if (index === -1) {
        if (selectedForwardUsers.length >= 10) {
            showNotification('Можно выбрать не более 10 получателей', 'error');
            return;
        }
        if (chatData) {
            selectedForwardUsers.push({ id: chatId, name: chatData.name, type: chatData.type });
        }
    } else {
        selectedForwardUsers.splice(index, 1);
    }
    
    // Обновляем чекбоксы
    var items = document.querySelectorAll('.forward-chat-item');
    for (var k = 0; k < items.length; k++) {
        var item = items[k];
        var itemChatId = item.getAttribute('data-chat-id');
        var isSelected = false;
        for (var s = 0; s < selectedForwardUsers.length; s++) {
            if (selectedForwardUsers[s].id === itemChatId) {
                isSelected = true;
                break;
            }
        }
        var checkbox = item.querySelector('.forward-checkbox');
        if (checkbox) {
            checkbox.innerHTML = isSelected ? '<span style="color: #228B22; font-size: 14px;">✓</span>' : '';
        }
    }
    
    updateSelectedUsersDisplay();
    
    var errorDiv = document.getElementById('forward-error');
    if (errorDiv) {
        errorDiv.style.display = selectedForwardUsers.length === 0 ? 'block' : 'none';
    }
}

function updateSelectedUsersDisplay() {
    var container = document.getElementById('selected-users-container');
    var list = document.getElementById('selected-users-list');
    
    if (!container || !list) return;
    
    if (selectedForwardUsers.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    list.innerHTML = '';
    
    for (var i = 0; i < selectedForwardUsers.length; i++) {
        var user = selectedForwardUsers[i];
        var chip = document.createElement('div');
        chip.style.cssText = 'display: flex; align-items: center; gap: 6px; background: #e8f5e8; padding: 5px 10px; border-radius: 20px; font-size: 13px;';
        chip.innerHTML = `
            <span>${user.type === 'group' ? '👥' : (user.type === 'channel' ? '📢' : '👤')}</span>
            <span>${escapeHtml(user.name)}</span>
            <button onclick="removeForwardUser('${user.id}')" style="background: none; border: none; font-size: 16px; cursor: pointer; color: #999;">×</button>
        `;
        list.appendChild(chip);
    }
}

window.removeForwardUser = function(chatId) {
    var index = -1;
    for (var i = 0; i < selectedForwardUsers.length; i++) {
        if (selectedForwardUsers[i].id === chatId) {
            index = i;
            break;
        }
    }
    if (index !== -1) {
        selectedForwardUsers.splice(index, 1);
        updateSelectedUsersDisplay();
        
        var items = document.querySelectorAll('.forward-chat-item');
        for (var k = 0; k < items.length; k++) {
            if (items[k].getAttribute('data-chat-id') === chatId) {
                var checkbox = items[k].querySelector('.forward-checkbox');
                if (checkbox) checkbox.innerHTML = '';
                break;
            }
        }
        
        var errorDiv = document.getElementById('forward-error');
        if (errorDiv) {
            errorDiv.style.display = selectedForwardUsers.length === 0 ? 'block' : 'none';
        }
    }
};

var forwardSettings = {
    showSenderName: false,
    showCaption: true,
    allowFurtherForward: true
};

function showForwardSettings() {
    var modalHtml = `
        <div id="forward-settings-modal" class="modal" style="z-index: 10003;">
            <div class="modal-content" style="max-width: 350px; width: 85%; border-radius: 24px; background: white;">
                <div class="modal-header" style="padding: 15px 20px;">
                    <h3 style="margin: 0;">⚙️ Настройки пересылки</h3>
                    <button onclick="closeForwardSettingsModal()" class="btn-close">×</button>
                </div>
                <div style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <div style="font-weight: 500;">👤 Показывать имя отправителя</div>
                            <div style="font-size: 11px; color: #999;">Будет видно, кто отправил оригинал</div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" id="forward-show-sender" ${forwardSettings.showSenderName ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <div style="font-weight: 500;">📝 Показывать подпись</div>
                            <div style="font-size: 11px; color: #999;">Подпись к фото/GIF</div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" id="forward-show-caption" ${forwardSettings.showCaption ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 500;">🔄 Разрешить дальнейшую пересылку</div>
                            <div style="font-size: 11px; color: #999;">Получатели смогут переслать это сообщение</div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" id="forward-allow-forward" ${forwardSettings.allowFurtherForward ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div style="padding: 15px 20px; border-top: 1px solid #eee;">
                    <button onclick="saveForwardSettings()" class="btn-primary" style="width: 100%;">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('forward-settings-modal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeForwardSettingsModal() {
    var modal = document.getElementById('forward-settings-modal');
    if (modal) modal.remove();
}

function saveForwardSettings() {
    var showSender = document.getElementById('forward-show-sender');
    var showCaption = document.getElementById('forward-show-caption');
    var allowForward = document.getElementById('forward-allow-forward');
    
    if (showSender) forwardSettings.showSenderName = showSender.checked;
    if (showCaption) forwardSettings.showCaption = showCaption.checked;
    if (allowForward) forwardSettings.allowFurtherForward = allowForward.checked;
    
    closeForwardSettingsModal();
    showNotification('Настройки сохранены', 'success');
}

function sendForwardMessages() {
    if (selectedForwardUsers.length === 0) {
        var errorDiv = document.getElementById('forward-error');
        if (errorDiv) errorDiv.style.display = 'block';
        return;
    }
    
    var caption = document.getElementById('forward-caption');
    var captionText = caption ? caption.value.trim() : '';
    
    showNotification('📤 Отправка ' + selectedForwardUsers.length + ' получателям...', 'info');
    
    var promises = [];
    
    for (var i = 0; i < selectedForwardUsers.length; i++) {
        var user = selectedForwardUsers[i];
        
        var forwardData = {
            type: forwardMessageData.type,
            text: forwardMessageData.text || '',
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            forwarded: true
        };
        
        // Добавляем информацию об отправителе
        if (forwardSettings.showSenderName && forwardMessageData.senderId !== currentUser.uid) {
            forwardData.originalSender = forwardMessageData.senderId;
        }
        
        // Запрет дальнейшей пересылки
        if (!forwardSettings.allowFurtherForward) {
            forwardData.noForward = true;
        }
        
        // Копируем медиа данные
        if (forwardMessageData.imageUrl) {
            forwardData.imageUrl = forwardMessageData.imageUrl;
            if (forwardSettings.showCaption && forwardMessageData.caption) {
                forwardData.caption = captionText ? captionText + '\n\n' + forwardMessageData.caption : forwardMessageData.caption;
            } else if (captionText) {
                forwardData.caption = captionText;
            }
        } else if (forwardMessageData.gifUrl) {
            forwardData.gifUrl = forwardMessageData.gifUrl;
            if (captionText) forwardData.caption = captionText;
        } else if (forwardMessageData.videoUrl) {
            forwardData.videoUrl = forwardMessageData.videoUrl;
            if (captionText) forwardData.caption = captionText;
        } else if (forwardMessageData.audioUrl) {
            forwardData.audioUrl = forwardMessageData.audioUrl;
            if (captionText) forwardData.caption = captionText;
        } else if (forwardMessageData.fileUrl) {
            forwardData.fileUrl = forwardMessageData.fileUrl;
            forwardData.fileName = forwardMessageData.fileName;
            if (captionText) forwardData.caption = captionText;
        } else if (captionText) {
            forwardData.text = captionText + '\n\n' + (forwardData.text || '');
        }
        
        var promise = database.ref('messages/' + user.id).push(forwardData).then(function() {
            var previewText = forwardMessageData.text || 'Медиа';
            if (previewText.length > 50) previewText = previewText.substring(0, 47) + '...';
            
            var lastMsg = '📨 Переслано: ' + previewText;
            if (captionText) lastMsg = '📨 ' + captionText.substring(0, 30) + (captionText.length > 30 ? '...' : '');
            
            return database.ref('chats/' + user.id).update({
                lastMessage: lastMsg,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        });
        
        promises.push(promise);
    }
    
    Promise.all(promises).then(function() {
        showNotification('✅ Отправлено ' + selectedForwardUsers.length + ' получателям!', 'success');
        closeForwardModal();
    }).catch(function() {
        showNotification('❌ Ошибка при отправке', 'error');
    });
}

window.closeForwardModal = function() {
    var modal = document.getElementById('forward-modal');
    if (modal) modal.remove();
    selectedForwardUsers = [];
    forwardMessageData = null;
};

console.log('✅ Расширенная пересылка сообщений добавлена!');

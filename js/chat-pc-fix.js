// ========== ФИКС ДЛЯ ПК - ОТКРЫТИЕ ЧАТОВ ==========
// Этот файл подключается после chat.js и исправляет открытие чатов на ПК

(function() {
    console.log('PC FIX: загрузка исправления для чатов');
    
    // Перехватываем клики по чатам через делегирование
    document.addEventListener('click', function(e) {
        // Ищем элемент чата
        var chatItem = e.target.closest('.chat-item');
        if (!chatItem) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        var chatId = chatItem.getAttribute('data-chat-id');
        if (!chatId) return;
        
        console.log('PC FIX: клик по чату', chatId);
        
        // Получаем данные чата из Firebase
        database.ref('chats/' + chatId).once('value').then(function(snapshot) {
            var chatData = snapshot.val();
            if (!chatData) {
                showNotification('Чат не найден', 'error');
                return;
            }
            
            // Открываем чат напрямую
            forceOpenChat(chatId, chatData);
        }).catch(function(err) {
            console.error('PC FIX ошибка:', err);
        });
    });
    
    // Функция принудительного открытия чата
    function forceOpenChat(chatId, chatData) {
        console.log('PC FIX: открываю чат', chatId);
        
        // Сохраняем глобальные переменные
        window.currentChatId = chatId;
        window.currentChatData = chatData;
        currentChatId = chatId;
        currentChatData = chatData;
        
        // 1. Обновляем активный класс
        document.querySelectorAll('.chat-item').forEach(function(item) {
            item.classList.remove('active');
            if (item.getAttribute('data-chat-id') === chatId) {
                item.classList.add('active');
            }
        });
        
        // 2. ПОКАЗЫВАЕМ ОБЛАСТЬ ЧАТА (САМОЕ ВАЖНОЕ!)
        var noChatElement = document.getElementById('no-chat-selected');
        var activeChatElement = document.getElementById('active-chat');
        
        if (noChatElement) noChatElement.classList.add('hidden');
        if (activeChatElement) activeChatElement.classList.remove('hidden');
        
        // 3. Очищаем сообщения
        var messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) messagesContainer.innerHTML = '';
        
        // 4. Заполняем шапку чата
        fillChatHeader(chatId, chatData);
        
        // 5. Загружаем сообщения
        loadChatMessages(chatId);
    }
    
    // Заполнение шапки чата
    async function fillChatHeader(chatId, chatData) {
        var chatUsername = document.getElementById('chat-username');
        var chatStatus = document.getElementById('chat-status');
        var chatAvatar = document.getElementById('chat-avatar');
        
        if (!chatUsername) return;
        
        if (chatData.type === 'group') {
            chatUsername.textContent = chatData.name || 'Группа';
            if (chatStatus) {
                var membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
                chatStatus.textContent = membersCount + ' участников';
            }
            if (chatAvatar) {
                if (chatData.avatar) {
                    chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
                    chatAvatar.style.backgroundSize = 'cover';
                    chatAvatar.textContent = '';
                } else {
                    chatAvatar.style.backgroundImage = '';
                    chatAvatar.textContent = '👥';
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
                if (chatData.avatar) {
                    chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
                    chatAvatar.style.backgroundSize = 'cover';
                    chatAvatar.textContent = '';
                } else {
                    chatAvatar.style.backgroundImage = '';
                    chatAvatar.textContent = '📢';
                }
            }
        }
        else {
            // Личный чат - ищем собеседника
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
                try {
                    var userSnap = await database.ref('users/' + otherUserId).once('value');
                    var userData = userSnap.val();
                    
                    if (userData) {
                        chatUsername.textContent = userData.username || 'Пользователь';
                        if (chatStatus) {
                            var status = userData.status || {};
                            if (status.online) {
                                chatStatus.innerHTML = 'в сети';
                            } else {
                                chatStatus.innerHTML = formatLastSeen(status.lastSeen);
                            }
                        }
                        if (chatAvatar) {
                            if (userData.avatar) {
                                chatAvatar.style.backgroundImage = 'url(' + userData.avatar + ')';
                                chatAvatar.style.backgroundSize = 'cover';
                                chatAvatar.textContent = '';
                            } else {
                                chatAvatar.style.backgroundImage = '';
                                chatAvatar.textContent = '👤';
                            }
                        }
                    }
                } catch(e) {
                    chatUsername.textContent = 'Пользователь';
                }
            } else {
                chatUsername.textContent = 'Пользователь';
            }
        }
    }
    
    // Загрузка сообщений
    function loadChatMessages(chatId) {
        var container = document.getElementById('messages-container');
        if (!container) return;
        
        // Отписываемся от старых
        if (window.messagesListener) {
            window.messagesListener.off();
        }
        
        // Подписываемся на новые
        window.messagesListener = database.ref('messages/' + chatId)
            .orderByChild('timestamp')
            .limitToLast(50);
        
        window.messagesListener.on('child_added', function(snapshot) {
            var message = snapshot.val();
            message.id = snapshot.key;
            
            var isSent = message.senderId === currentUser?.uid;
            var messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
            messageDiv.setAttribute('data-message-id', message.id);
            
            var content = '';
            if (message.type === 'text') {
                content = '<div class="message-text">' + escapeHtml(message.text || '') + '</div>';
            } else if (message.type === 'image') {
                content = '<div class="message-image"><img src="' + message.imageUrl + '" style="max-width:250px; border-radius:12px;"></div>';
            } else if (message.type === 'gif') {
                content = '<div class="gif-message"><img src="' + message.gifUrl + '" style="max-width:250px; border-radius:12px;"><span class="gif-badge">GIF</span></div>';
            } else {
                content = '<div class="message-text">📎 Вложение</div>';
            }
            
            messageDiv.innerHTML = '<div class="message-content">' + content + '<div class="message-time">' + formatTime(message.timestamp) + '</div></div>';
            container.appendChild(messageDiv);
            container.scrollTop = container.scrollHeight;
        });
    }
    
    // Перехватываем кнопку закрытия чата
    var backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            var noChat = document.getElementById('no-chat-selected');
            var activeChat = document.getElementById('active-chat');
            if (noChat) noChat.classList.remove('hidden');
            if (activeChat) activeChat.classList.add('hidden');
            window.currentChatId = null;
            if (window.messagesListener) window.messagesListener.off();
        });
    }
    
    console.log('PC FIX: готово');
})();

// ========== ФИКС ДЛЯ ПК - ОТКРЫТИЕ ЧАТОВ ==========
// Полностью рабочий код - копируйте целиком

(function() {
    console.log('PC FIX: загрузка исправления для чатов');
    
    // Функция принудительного показа чата
    function showChatArea() {
        var noChat = document.getElementById('no-chat-selected');
        var activeChat = document.getElementById('active-chat');
        
        if (noChat) {
            noChat.style.display = 'none';
            noChat.classList.add('hidden');
        }
        
        if (activeChat) {
            activeChat.style.display = 'flex';
            activeChat.classList.remove('hidden');
            console.log('PC FIX: область чата показана');
        }
    }
    
    // Загрузка сообщений в чат
    function loadMessagesToChat(chatId) {
        var container = document.getElementById('messages-container');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align:center;padding:20px;">📥 Загрузка сообщений...</div>';
        
        database.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(50).once('value').then(function(snapshot) {
            var messages = snapshot.val();
            container.innerHTML = '';
            
            if (!messages) {
                container.innerHTML = '<div style="text-align:center;padding:20px;">💬 Нет сообщений. Напишите первым!</div>';
                return;
            }
            
            var messagesArray = [];
            for (var id in messages) {
                messagesArray.push({id: id, data: messages[id]});
            }
            messagesArray.sort(function(a, b) {
                return (a.data.timestamp || 0) - (b.data.timestamp || 0);
            });
            
            messagesArray.forEach(function(msg) {
                var message = msg.data;
                var isSent = message.senderId === currentUser.uid;
                var messageDiv = document.createElement('div');
                messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
                
                var content = '';
                if (message.type === 'text') {
                    content = '<div class="message-text">' + escapeHtml(message.text || '') + '</div>';
                } else if (message.type === 'image') {
                    content = '<div class="message-image"><img src="' + message.imageUrl + '" style="max-width:200px; border-radius:10px;"></div>';
                } else if (message.type === 'gif') {
                    content = '<div class="gif-message"><img src="' + message.gifUrl + '" style="max-width:200px; border-radius:10px;"><span class="gif-badge">GIF</span></div>';
                } else if (message.type === 'audio') {
                    content = '<div class="audio-message">🎤 Голосовое сообщение</div>';
                } else {
                    content = '<div class="message-text">📎 Вложение</div>';
                }
                
                var time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
                messageDiv.innerHTML = '<div class="message-content">' + content + '<div class="message-time">' + time + '</div></div>';
                container.appendChild(messageDiv);
            });
            
            container.scrollTop = container.scrollHeight;
        }).catch(function(err) {
            console.error('Ошибка загрузки сообщений:', err);
            container.innerHTML = '<div style="text-align:center;padding:20px;">❌ Ошибка загрузки сообщений</div>';
        });
    }
    
    // Обновление шапки чата
    function updateChatHeader(chatId, chatData) {
        var chatUsername = document.getElementById('chat-username');
        var chatStatus = document.getElementById('chat-status');
        var chatAvatar = document.getElementById('chat-avatar');
        
        if (!chatUsername) return;
        
        if (chatData.type === 'group') {
            chatUsername.textContent = chatData.name || 'Группа';
            if (chatStatus) chatStatus.textContent = 'групповой чат';
        } 
        else if (chatData.type === 'channel') {
            chatUsername.textContent = chatData.name || 'Канал';
            if (chatStatus) chatStatus.textContent = 'канал';
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
                database.ref('users/' + otherUserId).once('value').then(function(snap) {
                    var user = snap.val();
                    if (user) {
                        chatUsername.textContent = user.username || 'Пользователь';
                        if (chatStatus) {
                            var status = user.status || {};
                            chatStatus.innerHTML = status.online ? '🟢 в сети' : '⚫ не в сети';
                        }
                        if (chatAvatar && user.avatar) {
                            chatAvatar.style.backgroundImage = 'url(' + user.avatar + ')';
                            chatAvatar.style.backgroundSize = 'cover';
                            chatAvatar.textContent = '';
                        }
                    }
                });
            } else {
                chatUsername.textContent = 'Пользователь';
            }
        }
    }
    
    // Главная функция открытия чата
    function openChat(chatId, chatData) {
        console.log('PC FIX: открываю чат', chatId);
        
        // Сохраняем текущий чат
        window.currentChatId = chatId;
        window.currentChatData = chatData;
        
        // Показываем область чата
        showChatArea();
        
        // Обновляем шапку
        updateChatHeader(chatId, chatData);
        
        // Загружаем сообщения
        loadMessagesToChat(chatId);
    }
    
    // Перехват кликов по чатам
    document.addEventListener('click', function(e) {
        var chatItem = e.target.closest('.chat-item');
        if (!chatItem) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        var chatId = chatItem.getAttribute('data-chat-id');
        if (!chatId) {
            console.log('PC FIX: нет data-chat-id');
            return;
        }
        
        console.log('PC FIX: клик по чату', chatId);
        
        // Получаем данные чата из Firebase
        database.ref('chats/' + chatId).once('value').then(function(snapshot) {
            var chatData = snapshot.val();
            if (chatData) {
                openChat(chatId, chatData);
            } else {
                console.error('PC FIX: чат не найден');
                alert('Чат не найден');
            }
        }).catch(function(err) {
            console.error('PC FIX: ошибка', err);
        });
    }, true);
    
    // Обработчик кнопки "Назад" для закрытия чата
    setTimeout(function() {
        var backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                var noChat = document.getElementById('no-chat-selected');
                var activeChat = document.getElementById('active-chat');
                if (noChat) noChat.style.display = 'flex';
                if (activeChat) activeChat.style.display = 'none';
                window.currentChatId = null;
            });
        }
        
        // Тестовая синяя кнопка
        var testBtn = document.getElementById('test-chat-btn');
        if (testBtn) {
            testBtn.onclick = function() {
                showChatArea();
                var container = document.getElementById('messages-container');
                if (container) {
                    container.innerHTML = '<div style="text-align:center;padding:50px;color:green;">✅ Чат работает!<br>Кликните на чат слева для загрузки сообщений</div>';
                }
            };
        }
    }, 500);
    
    console.log('PC FIX: готов, кликайте на чаты');
})();

// ========== ФИКС ДЛЯ ПК - ПОЛНАЯ ЗАМЕНА ОБРАБОТЧИКА ЧАТОВ ==========
(function() {
    console.log('PC FIX: полная замена обработчика чатов');
    
    // Функция для отладки
    function showMsg(msg) {
        console.log(msg);
        var div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = 'position:fixed; bottom:10px; left:10px; background:green; color:white; padding:8px; z-index:99999; font-size:12px; border-radius:5px;';
        document.body.appendChild(div);
        setTimeout(function() { div.remove(); }, 2000);
    }
    
    // Функция принудительного открытия чата
    window.forceOpenChat = function(chatId, chatData) {
        showMsg('Открываю чат: ' + chatId);
        
        // Сохраняем глобально
        window.currentChatId = chatId;
        window.currentChatData = chatData;
        
        // Показываем область чата
        var noChat = document.getElementById('no-chat-selected');
        var activeChat = document.getElementById('active-chat');
        
        if (noChat) {
            noChat.style.display = 'none';
            noChat.classList.add('hidden');
        }
        if (activeChat) {
            activeChat.style.display = 'flex';
            activeChat.classList.remove('hidden');
        }
        
        // Заполняем шапку чата
        var chatName = document.getElementById('chat-username');
        if (chatName) {
            if (chatData.type === 'private') {
                chatName.textContent = 'Загрузка...';
                // Загружаем имя пользователя
                var otherUserId = null;
                if (chatData.participants) {
                    for (var i = 0; i < chatData.participants.length; i++) {
                        if (chatData.participants[i] !== window.currentUser?.uid) {
                            otherUserId = chatData.participants[i];
                            break;
                        }
                    }
                }
                if (otherUserId) {
                    database.ref('users/' + otherUserId + '/username').once('value').then(function(snap) {
                        if (chatName) chatName.textContent = snap.val() || 'Пользователь';
                    });
                }
            } else if (chatData.type === 'group') {
                chatName.textContent = chatData.name || 'Группа';
            } else if (chatData.type === 'channel') {
                chatName.textContent = chatData.name || 'Канал';
            }
        }
        
        // Загружаем сообщения
        if (typeof loadMessages === 'function') {
            loadMessages(chatId);
        } else {
            showMsg('loadMessages не найдена, загружаем вручную');
            // Ручная загрузка сообщений
            var container = document.getElementById('messages-container');
            if (container) {
                container.innerHTML = '<div style="text-align:center;padding:20px;">Загрузка сообщений...</div>';
                database.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(50).once('value').then(function(snap) {
                    container.innerHTML = '';
                    var messages = snap.val();
                    if (messages) {
                        var msgs = Object.values(messages);
                        msgs.reverse();
                        msgs.forEach(function(msg) {
                            var isSent = msg.senderId === window.currentUser?.uid;
                            var div = document.createElement('div');
                            div.className = 'message ' + (isSent ? 'sent' : 'received');
                            div.innerHTML = '<div class="message-text">' + (msg.text || 'Вложение') + '</div><div class="message-time">' + new Date(msg.timestamp).toLocaleTimeString() + '</div>';
                            container.appendChild(div);
                        });
                    }
                    container.scrollTop = container.scrollHeight;
                });
            }
        }
        
        showMsg('Чат открыт!');
    };
    
    // Удаляем ВСЕ старые обработчики со всех чатов
    function removeAllHandlers() {
        var chatItems = document.querySelectorAll('.chat-item');
        for (var i = 0; i < chatItems.length; i++) {
            chatItems[i].onclick = null;
            chatItems[i].removeAttribute('onclick');
            chatItems[i].style.cursor = 'pointer';
        }
        console.log('Удалены все старые обработчики с', chatItems.length, 'чатов');
    }
    
    // Добавляем НОВЫЙ обработчик на все чаты
    function addNewHandlers() {
        var chatItems = document.querySelectorAll('.chat-item');
        console.log('Добавляю новые обработчики на', chatItems.length, 'чатов');
        
        for (var i = 0; i < chatItems.length; i++) {
            (function(item) {
                var chatId = item.getAttribute('data-chat-id');
                if (!chatId) return;
                
                item.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    showMsg('Кликнули по чату: ' + chatId);
                    
                    // Загружаем данные чата
                    database.ref('chats/' + chatId).once('value').then(function(snapshot) {
                        var chatData = snapshot.val();
                        if (chatData) {
                            window.forceOpenChat(chatId, chatData);
                        } else {
                            showMsg('Ошибка: чат не найден');
                        }
                    }).catch(function(err) {
                        showMsg('Ошибка: ' + err.message);
                    });
                    
                    return false;
                };
            })(chatItems[i]);
        }
    }
    
    // Наблюдатель за новыми чатами (когда они добавляются)
    var observer = new MutationObserver(function() {
        removeAllHandlers();
        addNewHandlers();
    });
    
    var chatsList = document.getElementById('chats-list');
    if (chatsList) {
        observer.observe(chatsList, { childList: true, subtree: true });
    }
    
    // Запускаем очистку и добавление обработчиков
    setTimeout(function() {
        removeAllHandlers();
        addNewHandlers();
        showMsg('Обработчики чатов обновлены!');
    }, 500);
    
    // Также периодически обновляем (на всякий случай)
    setInterval(function() {
        removeAllHandlers();
        addNewHandlers();
    }, 3000);
    
    showMsg('PC FIX: готов к работе! Кликайте по чатам');
})();

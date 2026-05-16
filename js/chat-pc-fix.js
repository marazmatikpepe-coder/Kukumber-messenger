// ========== ФИКС ДЛЯ ПК - ПРИНУДИТЕЛЬНОЕ ОТКРЫТИЕ ЧАТА ==========
(function() {
    console.log('PC FIX: загрузка...');
    
    // Функция показа уведомления
    function showDebugMsg(msg) {
        console.log(msg);
        // Создаём красное уведомление на экране
        var div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = 'position:fixed; bottom:10px; left:10px; background:red; color:white; padding:10px; z-index:99999; font-size:14px; border-radius:5px;';
        document.body.appendChild(div);
        setTimeout(function() { div.remove(); }, 3000);
    }
    
    // Принудительное открытие чата
    window.forceOpenChat = function(chatId, chatData) {
        showDebugMsg('Открываю чат: ' + chatId);
        
        // 1. Прячем "нет чата"
        var noChat = document.getElementById('no-chat-selected');
        if (noChat) {
            noChat.style.display = 'none';
            noChat.classList.add('hidden');
            showDebugMsg('Скрыл no-chat-selected');
        } else {
            showDebugMsg('ОШИБКА: no-chat-selected не найден');
        }
        
        // 2. Показываем активный чат
        var activeChat = document.getElementById('active-chat');
        if (activeChat) {
            activeChat.style.display = 'flex';
            activeChat.classList.remove('hidden');
            showDebugMsg('Показал active-chat');
        } else {
            showDebugMsg('ОШИБКА: active-chat не найден');
        }
        
        // 3. Обновляем шапку чата (просто для теста)
        var chatName = document.getElementById('chat-username');
        if (chatName) {
            if (chatData.type === 'private') {
                chatName.textContent = 'Личный чат';
            } else if (chatData.type === 'group') {
                chatName.textContent = chatData.name || 'Группа';
            } else if (chatData.type === 'channel') {
                chatName.textContent = chatData.name || 'Канал';
            }
            showDebugMsg('Шапка обновлена: ' + chatName.textContent);
        }
        
        // Сохраняем глобально
        window.currentChatId = chatId;
        window.currentChatData = chatData;
    };
    
    // Перехват кликов по чатам
    document.addEventListener('click', function(e) {
        var chatItem = e.target.closest('.chat-item');
        if (!chatItem) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        var chatId = chatItem.getAttribute('data-chat-id');
        showDebugMsg('Клик по чату: ' + chatId);
        
        if (!chatId) return;
        
        // Загружаем данные чата
        database.ref('chats/' + chatId).once('value').then(function(snapshot) {
            var chatData = snapshot.val();
            if (chatData) {
                window.forceOpenChat(chatId, chatData);
            } else {
                showDebugMsg('ОШИБКА: чат не найден в БД');
            }
        }).catch(function(err) {
            showDebugMsg('Ошибка БД: ' + err.message);
        });
    });
    
    // Проверяем наличие элементов при загрузке
    setTimeout(function() {
        var noChat = document.getElementById('no-chat-selected');
        var activeChat = document.getElementById('active-chat');
        
        if (noChat) showDebugMsg('✓ no-chat-selected найден');
        else showDebugMsg('✗ no-chat-selected НЕ найден');
        
        if (activeChat) showDebugMsg('✓ active-chat найден');
        else showDebugMsg('✗ active-chat НЕ найден');
    }, 1000);
    
    showDebugMsg('PC FIX загружен и работает');
})();
// ТЕСТОВАЯ КНОПКА - ПРИНУДИТЕЛЬНО ПОКАЗЫВАЕМ ЧАТ
setTimeout(function() {
    var testBtn = document.getElementById('test-chat-btn');
    if (testBtn) {
        testBtn.onclick = function() {
            var noChat = document.getElementById('no-chat-selected');
            var activeChat = document.getElementById('active-chat');
            
            if (noChat) noChat.style.display = 'none';
            if (activeChat) activeChat.style.display = 'flex';
            
            // Меняем текст в шапке для теста
            var chatName = document.getElementById('chat-username');
            if (chatName) chatName.textContent = 'ТЕСТОВЫЙ ЧАТ';
            
            alert('Кнопка сработала! Если вы видите область чата - проблема в обработчике кликов');
        };
    }
}, 1000);

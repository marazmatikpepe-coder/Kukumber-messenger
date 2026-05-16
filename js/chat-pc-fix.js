// ========== ПРОСТЕЙШИЙ ФИКС - ПРЯМОЕ УПРАВЛЕНИЕ CSS ==========
(function() {
    console.log('ULTRA SIMPLE FIX: загрузка');
    
    // Сразу показываем активный чат и скрываем заглушку ПРИНУДИТЕЛЬНО
    function showChatDirectly() {
        var noChat = document.getElementById('no-chat-selected');
        var activeChat = document.getElementById('active-chat');
        
        if (noChat) {
            noChat.style.display = 'none';
            noChat.classList.add('hidden');
        }
        
        if (activeChat) {
            activeChat.style.display = 'flex';
            activeChat.classList.remove('hidden');
            console.log('Чат принудительно показан через CSS');
        }
        
        // Меняем текст в шапке для наглядности
        var chatName = document.getElementById('chat-username');
        if (chatName) {
            chatName.textContent = 'ТЕСТОВЫЙ ЧАТ - РАБОТАЕТ';
            chatName.style.color = 'green';
        }
        
        var chatStatus = document.getElementById('chat-status');
        if (chatStatus) {
            chatStatus.textContent = 'Режим тестирования';
        }
    }
    
    // Вешаем на ВСЕ клики по документу
    document.addEventListener('click', function(e) {
        // Проверяем, кликнули ли по чату
        var chatItem = e.target.closest('.chat-item');
        if (chatItem) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Клик по чату - показываем область');
            showChatDirectly();
            
            // Получаем ID чата и сохраняем
            var chatId = chatItem.getAttribute('data-chat-id');
            if (chatId) {
                window.currentChatId = chatId;
                console.log('ID чата:', chatId);
            }
            
            return false;
        }
    }, true);
    
    // Также вешаем на синюю кнопку
    setTimeout(function() {
        var testBtn = document.getElementById('test-chat-btn');
        if (testBtn) {
            testBtn.onclick = function() {
                console.log('Клик по синей кнопке');
                showChatDirectly();
                alert('Область чата должна появиться! Если нет - проблема в CSS');
            };
        }
    }, 500);
    
    // Проверяем каждую секунду - нет ли чата, который нужно показать
    setInterval(function() {
        if (window.currentChatId && window.currentChatId !== 'shown') {
            console.log('Авто-показ чата для:', window.currentChatId);
            showChatDirectly();
            window.currentChatId = 'shown';
        }
    }, 1000);
    
    console.log('ULTRA SIMPLE FIX: готов');
})();

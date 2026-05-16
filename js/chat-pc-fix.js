// ПРОСТЕЙШИЙ ТЕСТ - ПРЯМОЕ УПРАВЛЕНИЕ
console.log('Тестовый скрипт загружен');

// Функция показа чата
function pokazatChat() {
    var noChat = document.getElementById('no-chat-selected');
    var activeChat = document.getElementById('active-chat');
    
    if (noChat) {
        noChat.style.display = 'none';
    }
    
    if (activeChat) {
        activeChat.style.display = 'flex';
        document.getElementById('chat-username').innerHTML = 'ТЕСТОВЫЙ ЧАТ';
        document.getElementById('messages-container').innerHTML = '<div style="padding:20px;text-align:center;">✅ ЧАТ РАБОТАЕТ</div>';
    }
}

// Ждем загрузки страницы
window.addEventListener('load', function() {
    console.log('Страница загружена');
    
    // Добавляем красную кнопку в правый верхний угол
    var btn = document.createElement('button');
    btn.innerHTML = 'ТЕСТ - ПОКАЗАТЬ ЧАТ';
    btn.style.cssText = 'position:fixed; top:10px; right:10px; z-index:99999; background:red; color:white; padding:15px; font-size:16px; border-radius:10px; cursor:pointer;';
    btn.onclick = function() {
        pokazatChat();
        alert('Кнопка сработала! Чат должен появиться');
    };
    document.body.appendChild(btn);
    
    // Также вешаем на все чаты
    var chatItems = document.querySelectorAll('.chat-item');
    console.log('Найдено чатов:', chatItems.length);
    
    for (var i = 0; i < chatItems.length; i++) {
        chatItems[i].style.border = '2px solid red';
        chatItems[i].onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Кликнули по чату');
            pokazatChat();
            alert('Клик по чату сработал!');
            return false;
        };
    }
});

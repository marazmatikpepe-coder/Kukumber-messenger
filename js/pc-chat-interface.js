// ========== ПОЛНОСТЬЮ НОВЫЙ ИНТЕРФЕЙС ЧАТОВ ДЛЯ ПК ==========
(function() {
    console.log('PC Interface: загрузка');
    
    let pcInterfaceActive = false;
    
    // Функция перестройки интерфейса для ПК
    function buildPCInterface() {
        if (pcInterfaceActive) return;
        pcInterfaceActive = true;
        
        // Находим контейнер чатов
        const chatsTab = document.getElementById('chats-tab');
        if (!chatsTab) return;
        
        // Очищаем существующее содержимое
        chatsTab.innerHTML = '';
        
        // Создаем новую структуру
        chatsTab.innerHTML = `
            <div class="pc-chats-layout">
                <!-- Левая панель -->
                <div class="pc-sidebar">
                    <div class="pc-sidebar-header">
                        <div class="pc-user-info" id="pc-user-info">
                            <div class="pc-avatar" id="pc-avatar">🥒</div>
                            <div class="pc-user-details">
                                <h3 id="pc-username">Загрузка...</h3>
                                <span class="pc-status">В сети</span>
                            </div>
                        </div>
                        <div class="pc-search-area">
                            <input type="text" id="pc-search-input" placeholder="🔍 Поиск..." class="pc-search-input">
                            <button id="pc-plus-btn" class="pc-plus-btn">+</button>
                        </div>
                    </div>
                    
                    <div class="pc-create-menu" id="pc-create-menu" style="display:none;">
                        <div class="pc-create-item" data-type="chat">💬 Новый чат</div>
                        <div class="pc-create-item" data-type="group">👥 Создать группу</div>
                        <div class="pc-create-item" data-type="channel">📢 Создать канал</div>
                    </div>
                    
                    <div class="pc-chats-list" id="pc-chats-list">
                        <div class="pc-loading">Загрузка чатов...</div>
                    </div>
                </div>
                
                <!-- Правая панель - область чата -->
                <div class="pc-chat-area">
                    <div id="pc-no-chat" class="pc-no-chat">
                        <div class="pc-no-chat-icon">💬</div>
                        <h3>Выберите чат</h3>
                        <p>Нажмите на чат слева, чтобы начать общение</p>
                    </div>
                    
                    <div id="pc-active-chat" class="pc-active-chat" style="display:none;">
                        <div class="pc-chat-header">
                            <div class="pc-chat-user-info" id="pc-chat-user-info" style="cursor:pointer;">
                                <div class="pc-chat-avatar" id="pc-chat-avatar">👤</div>
                                <div>
                                    <h3 id="pc-chat-name">Пользователь</h3>
                                    <span id="pc-chat-status">онлайн</span>
                                </div>
                            </div>
                            <div class="pc-chat-actions">
                                <button class="pc-call-btn" data-type="voice">📞</button>
                                <button class="pc-call-btn" data-type="video">📹</button>
                            </div>
                        </div>
                        
                        <div class="pc-messages-container" id="pc-messages-container"></div>
                        
                        <div class="pc-message-input-area">
                            <button id="pc-attach-btn" class="pc-attach-btn">📎</button>
                            <input type="text" id="pc-message-input" placeholder="Сообщение..." class="pc-message-input">
                            <button id="pc-emoji-btn" class="pc-emoji-btn">😊</button>
                            <button id="pc-send-btn" class="pc-send-btn">➤</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Добавляем стили
        addPCStyles();
        
        // Инициализируем функционал
        initPCFunctions();
        
        // Загружаем чаты
        loadPCChats();
    }
    
    // Добавление стилей
    function addPCStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .pc-chats-layout {
                display: flex;
                height: 100%;
                width: 100%;
                background: var(--background, #f5f7f5);
            }
            
            .pc-sidebar {
                width: 320px;
                min-width: 320px;
                background: white;
                border-right: 1px solid var(--border, #d4e4d4);
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            
            .pc-sidebar-header {
                padding: 15px;
                background: linear-gradient(135deg, var(--forest, #228B22), var(--olive, #556B2F));
                color: white;
            }
            
            .pc-user-info {
                display: flex;
                gap: 12px;
                align-items: center;
                cursor: pointer;
                margin-bottom: 15px;
            }
            
            .pc-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: var(--sage, #9DC183);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                background-size: cover;
                background-position: center;
            }
            
            .pc-user-details h3 {
                font-size: 16px;
                margin: 0;
                color: white;
            }
            
            .pc-status {
                font-size: 12px;
                opacity: 0.8;
            }
            
            .pc-search-area {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            
            .pc-search-input {
                flex: 1;
                padding: 10px 15px;
                border: none;
                border-radius: 25px;
                font-size: 14px;
                outline: none;
            }
            
            .pc-plus-btn {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .pc-plus-btn:hover {
                background: rgba(255,255,255,0.3);
            }
            
            .pc-create-menu {
                background: white;
                border-radius: 12px;
                margin: 10px 15px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                overflow: hidden;
            }
            
            .pc-create-item {
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                color: #333;
            }
            
            .pc-create-item:hover {
                background: var(--background, #f5f7f5);
            }
            
            .pc-chats-list {
                flex: 1;
                overflow-y: auto;
            }
            
            .pc-chat-item {
                padding: 12px 15px;
                display: flex;
                gap: 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--border, #d4e4d4);
                transition: background 0.2s;
            }
            
            .pc-chat-item:hover {
                background: var(--background, #f5f7f5);
            }
            
            .pc-chat-item.active {
                background: var(--sage, #9DC183);
            }
            
            .pc-chat-avatar-small {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: var(--sage, #9DC183);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                background-size: cover;
                background-position: center;
                position: relative;
            }
            
            .pc-online-dot {
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 12px;
                height: 12px;
                background: #32CD32;
                border-radius: 50%;
                border: 2px solid white;
            }
            
            .pc-chat-info {
                flex: 1;
                min-width: 0;
            }
            
            .pc-chat-name {
                font-weight: 600;
                font-size: 15px;
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .pc-chat-preview {
                font-size: 13px;
                color: #666;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .pc-chat-time {
                font-size: 11px;
                color: #999;
            }
            
            /* Правая область */
            .pc-chat-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--background, #f5f7f5);
            }
            
            .pc-no-chat {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                color: #999;
            }
            
            .pc-no-chat-icon {
                font-size: 80px;
                margin-bottom: 20px;
                opacity: 0.5;
            }
            
            .pc-active-chat {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            
            .pc-chat-header {
                padding: 12px 20px;
                background: white;
                border-bottom: 1px solid var(--border, #d4e4d4);
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .pc-chat-user-info {
                display: flex;
                gap: 12px;
                align-items: center;
                cursor: pointer;
            }
            
            .pc-chat-avatar {
                width: 45px;
                height: 45px;
                border-radius: 50%;
                background: var(--sage, #9DC183);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                background-size: cover;
                background-position: center;
            }
            
            .pc-chat-user-info h3 {
                font-size: 16px;
                margin: 0;
            }
            
            .pc-chat-user-info span {
                font-size: 12px;
                color: #666;
            }
            
            .pc-chat-actions {
                display: flex;
                gap: 8px;
            }
            
            .pc-call-btn {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: var(--forest, #228B22);
                border: none;
                cursor: pointer;
                font-size: 18px;
                color: white;
            }
            
            .pc-messages-container {
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .pc-message {
                max-width: 70%;
                padding: 8px 12px;
                border-radius: 16px;
                animation: fadeIn 0.2s;
            }
            
            .pc-message.sent {
                align-self: flex-end;
                background: linear-gradient(135deg, var(--forest, #228B22), var(--lime, #32CD32));
                color: white;
                border-bottom-right-radius: 4px;
            }
            
            .pc-message.received {
                align-self: flex-start;
                background: white;
                color: #333;
                border-bottom-left-radius: 4px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            
            .pc-message-text {
                font-size: 14px;
                word-break: break-word;
            }
            
            .pc-message-time {
                font-size: 10px;
                opacity: 0.7;
                margin-top: 4px;
                text-align: right;
            }
            
            .pc-message-input-area {
                padding: 10px 15px;
                background: white;
                border-top: 1px solid var(--border, #d4e4d4);
                display: flex;
                gap: 8px;
                align-items: center;
            }
            
            .pc-attach-btn, .pc-emoji-btn {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
            }
            
            .pc-message-input {
                flex: 1;
                padding: 10px 15px;
                border: 2px solid var(--border, #d4e4d4);
                border-radius: 25px;
                font-size: 14px;
                outline: none;
            }
            
            .pc-message-input:focus {
                border-color: var(--forest, #228B22);
            }
            
            .pc-send-btn {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--forest, #228B22), var(--lime, #32CD32));
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
            }
            
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .pc-loading {
                text-align: center;
                padding: 40px;
                color: #999;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Инициализация функций
    function initPCFunctions() {
        // Плюс кнопка - показать меню создания
        const plusBtn = document.getElementById('pc-plus-btn');
        const createMenu = document.getElementById('pc-create-menu');
        
        if (plusBtn) {
            plusBtn.onclick = function(e) {
                e.stopPropagation();
                const isVisible = createMenu.style.display === 'block';
                createMenu.style.display = isVisible ? 'none' : 'block';
            };
        }
        
        // Закрыть меню при клике вне
        document.addEventListener('click', function(e) {
            if (createMenu && !createMenu.contains(e.target) && !plusBtn?.contains(e.target)) {
                createMenu.style.display = 'none';
            }
        });
        
        // Обработчики создания
        document.querySelectorAll('.pc-create-item').forEach(item => {
            item.onclick = function() {
                const type = this.dataset.type;
                createMenu.style.display = 'none';
                
                if (type === 'chat') {
                    showNewChatDialogPC();
                } else if (type === 'group') {
                    showNotification('Создание группы в разработке', 'info');
                } else if (type === 'channel') {
                    showNotification('Создание канала в разработке', 'info');
                }
            };
        });
        
        // Отправка сообщения
        const sendBtn = document.getElementById('pc-send-btn');
        const messageInput = document.getElementById('pc-message-input');
        
        if (sendBtn) {
            sendBtn.onclick = sendPCMessage;
        }
        if (messageInput) {
            messageInput.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    sendPCMessage();
                }
            };
        }
        
        // Клик по профилю
        const userInfo = document.getElementById('pc-user-info');
        if (userInfo) {
            userInfo.onclick = function() {
                if (typeof switchToTab === 'function') {
                    switchToTab('settings');
                }
            };
        }
        
        // Поиск
        const searchInput = document.getElementById('pc-search-input');
        if (searchInput) {
            searchInput.oninput = function() {
                const query = this.value.toLowerCase();
                filterPCChats(query);
            };
        }
    }
    
    // Загрузка чатов
    async function loadPCChats() {
        const container = document.getElementById('pc-chats-list');
        if (!container) return;
        
        if (!window.currentUser) {
            container.innerHTML = '<div class="pc-loading">Авторизуйтесь для просмотра чатов</div>';
            return;
        }
        
        container.innerHTML = '<div class="pc-loading">Загрузка чатов...</div>';
        
        try {
            const userChatsSnap = await database.ref('userChats/' + currentUser.uid).once('value');
            const userChats = userChatsSnap.val();
            
            if (!userChats) {
                container.innerHTML = '<div class="pc-loading">Нет чатов. Начните диалог!</div>';
                return;
            }
            
            const chatIds = Object.keys(userChats);
            const chatsData = [];
            
            for (const chatId of chatIds) {
                const chatSnap = await database.ref('chats/' + chatId).once('value');
                const chat = chatSnap.val();
                if (chat) {
                    chatsData.push({ id: chatId, data: chat });
                }
            }
            
            chatsData.sort((a, b) => (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0));
            
            container.innerHTML = '';
            
            for (const chat of chatsData) {
                const chatElement = await createPCChatItem(chat.id, chat.data);
                container.appendChild(chatElement);
            }
            
        } catch (err) {
            console.error('Ошибка загрузки чатов:', err);
            container.innerHTML = '<div class="pc-loading">Ошибка загрузки чатов</div>';
        }
    }
    
    // Создание элемента чата
    async function createPCChatItem(chatId, chatData) {
        const div = document.createElement('div');
        div.className = 'pc-chat-item';
        div.setAttribute('data-chat-id', chatId);
        
        let name = '';
        let avatarContent = '👤';
        let avatarStyle = '';
        let isOnline = false;
        let preview = chatData.lastMessage || 'Нет сообщений';
        
        if (preview.length > 50) preview = preview.substring(0, 47) + '...';
        
        if (chatData.type === 'group') {
            name = chatData.name || 'Группа';
            avatarContent = '👥';
            if (chatData.avatar) avatarStyle = `background-image: url(${chatData.avatar}); background-size: cover;`;
        } 
        else if (chatData.type === 'channel') {
            name = chatData.name || 'Канал';
            avatarContent = '📢';
            if (chatData.avatar) avatarStyle = `background-image: url(${chatData.avatar}); background-size: cover;`;
        }
        else {
            // Личный чат
            let otherUserId = null;
            if (chatData.participants) {
                for (const uid of chatData.participants) {
                    if (uid !== currentUser.uid) {
                        otherUserId = uid;
                        break;
                    }
                }
            }
            
            if (otherUserId) {
                const userData = await getUserData(otherUserId);
                name = userData.username;
                if (userData.avatar) {
                    avatarStyle = `background-image: url(${userData.avatar}); background-size: cover;`;
                    avatarContent = '';
                }
                isOnline = userData.status.online === true;
            } else {
                name = 'Пользователь';
            }
        }
        
        div.innerHTML = `
            <div class="pc-chat-avatar-small" style="${avatarStyle}">
                ${avatarContent || '👤'}
                ${isOnline ? '<span class="pc-online-dot"></span>' : ''}
            </div>
            <div class="pc-chat-info">
                <div class="pc-chat-name">${escapeHtml(name)}</div>
                <div class="pc-chat-preview">${escapeHtml(preview)}</div>
            </div>
            <div class="pc-chat-time">${formatTime(chatData.lastMessageTime)}</div>
        `;
        
        div.onclick = () => openPCChat(chatId, chatData);
        
        return div;
    }
    
    // Фильтрация чатов
    function filterPCChats(query) {
        const items = document.querySelectorAll('.pc-chat-item');
        items.forEach(item => {
            const name = item.querySelector('.pc-chat-name')?.textContent.toLowerCase() || '';
            item.style.display = name.includes(query) ? 'flex' : 'none';
        });
    }
    
    // Открытие чата
    async function openPCChat(chatId, chatData) {
        console.log('PC: открываю чат', chatId);
        
        window.currentChatId = chatId;
        window.currentChatData = chatData;
        
        // Обновляем активный класс
        document.querySelectorAll('.pc-chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-chat-id') === chatId) {
                item.classList.add('active');
            }
        });
        
        // Показываем область чата
        const noChat = document.getElementById('pc-no-chat');
        const activeChat = document.getElementById('pc-active-chat');
        
        if (noChat) noChat.style.display = 'none';
        if (activeChat) activeChat.style.display = 'flex';
        
        // Обновляем шапку
        await updatePCHeader(chatId, chatData);
        
        // Загружаем сообщения
        loadPCMessages(chatId);
    }
    
    // Обновление шапки чата
    async function updatePCHeader(chatId, chatData) {
        const nameEl = document.getElementById('pc-chat-name');
        const statusEl = document.getElementById('pc-chat-status');
        const avatarEl = document.getElementById('pc-chat-avatar');
        const userInfoDiv = document.getElementById('pc-chat-user-info');
        
        if (!nameEl) return;
        
        if (chatData.type === 'group') {
            nameEl.textContent = chatData.name || 'Группа';
            statusEl.textContent = 'групповой чат';
            if (chatData.avatar) {
                avatarEl.style.backgroundImage = `url(${chatData.avatar})`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.textContent = '';
            } else {
                avatarEl.textContent = '👥';
            }
        } 
        else if (chatData.type === 'channel') {
            nameEl.textContent = chatData.name || 'Канал';
            statusEl.textContent = 'канал';
            if (chatData.avatar) {
                avatarEl.style.backgroundImage = `url(${chatData.avatar})`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.textContent = '';
            } else {
                avatarEl.textContent = '📢';
            }
        }
        else {
            // Личный чат
            let otherUserId = null;
            if (chatData.participants) {
                for (const uid of chatData.participants) {
                    if (uid !== currentUser.uid) {
                        otherUserId = uid;
                        break;
                    }
                }
            }
            
            if (otherUserId) {
                const userData = await getUserData(otherUserId);
                nameEl.textContent = userData.username;
                if (userData.status.online) {
                    statusEl.textContent = 'в сети';
                } else {
                    statusEl.textContent = formatLastSeen(userData.status.lastSeen);
                }
                if (userData.avatar) {
                    avatarEl.style.backgroundImage = `url(${userData.avatar})`;
                    avatarEl.style.backgroundSize = 'cover';
                    avatarEl.textContent = '';
                } else {
                    avatarEl.textContent = '👤';
                }
                
                // Клик по шапке - открыть профиль
                if (userInfoDiv) {
                    userInfoDiv.onclick = () => {
                        if (typeof window.openUserProfile === 'function') {
                            window.openUserProfile(otherUserId);
                        } else {
                            showNotification('Профиль пользователя', 'info');
                        }
                    };
                }
            }
        }
    }
    
    // Загрузка сообщений
    function loadPCMessages(chatId) {
        const container = document.getElementById('pc-messages-container');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align:center;padding:20px;">Загрузка сообщений...</div>';
        
        if (window.pcMessagesListener) {
            window.pcMessagesListener.off();
        }
        
        window.pcMessagesListener = database.ref('messages/' + chatId)
            .orderByChild('timestamp')
            .limitToLast(50);
        
        window.pcMessagesListener.on('child_added', function(snapshot) {
            const message = snapshot.val();
            message.id = snapshot.key;
            appendPCMessage(message);
        });
    }
    
    // Добавление сообщения
    function appendPCMessage(message) {
        const container = document.getElementById('pc-messages-container');
        if (!container) return;
        
        // При первом сообщении очищаем заглушку
        if (container.innerHTML === '<div style="text-align:center;padding:20px;">Загрузка сообщений...</div>' ||
            container.innerHTML === '<div style="text-align:center;padding:20px;">Нет сообщений. Напишите первым!</div>') {
            container.innerHTML = '';
        }
        
        const isSent = message.senderId === currentUser?.uid;
        const messageDiv = document.createElement('div');
        messageDiv.className = `pc-message ${isSent ? 'sent' : 'received'}`;
        
        let content = '';
        if (message.type === 'text') {
            content = `<div class="pc-message-text">${escapeHtml(message.text || '')}</div>`;
        } else if (message.type === 'image') {
            content = `<img src="${message.imageUrl}" style="max-width:200px; border-radius:10px;">`;
        } else {
            content = `<div class="pc-message-text">📎 Вложение</div>`;
        }
        
        const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
        
        messageDiv.innerHTML = `
            ${content}
            <div class="pc-message-time">${time}</div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }
    
    // Отправка сообщения
    function sendPCMessage() {
        const input = document.getElementById('pc-message-input');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text || !window.currentChatId) return;
        
        const message = {
            type: 'text',
            text: text,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        input.value = '';
        
        database.ref('messages/' + window.currentChatId).push(message).then(() => {
            database.ref('chats/' + window.currentChatId).update({
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        });
    }
    
    // Диалог создания нового чата
    function showNewChatDialogPC() {
        const modalHtml = `
            <div id="pc-new-chat-modal" class="pc-modal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10001;">
                <div style="background:white; border-radius:20px; width:400px; max-width:90%; overflow:hidden;">
                    <div style="padding:15px 20px; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0;">💬 Новый чат</h3>
                        <button onclick="document.getElementById('pc-new-chat-modal').remove()" style="background:none; border:none; font-size:24px; cursor:pointer;">×</button>
                    </div>
                    <div style="padding:20px;">
                        <input type="text" id="pc-new-chat-search" placeholder="🔍 Поиск пользователей..." style="width:100%; padding:12px; border:2px solid #ddd; border-radius:30px; font-size:14px;">
                        <div id="pc-search-users-list" style="margin-top:15px; max-height:300px; overflow-y:auto;"></div>
                    </div>
                </div>
            </div>
        `;
        
        const oldModal = document.getElementById('pc-new-chat-modal');
        if (oldModal) oldModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const searchInput = document.getElementById('pc-new-chat-search');
        if (searchInput) {
            searchInput.oninput = function() {
                searchPCUsers(this.value);
            };
            searchInput.focus();
        }
    }
    
    // Поиск пользователей для нового чата
    async function searchPCUsers(query) {
        const container = document.getElementById('pc-search-users-list');
        if (!container) return;
        
        if (!query || query.length < 2) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">Введите минимум 2 символа</div>';
            return;
        }
        
        container.innerHTML = '<div style="text-align:center;padding:20px;">Поиск...</div>';
        
        const snapshot = await database.ref('users').once('value');
        const users = snapshot.val();
        const results = [];
        const searchQuery = query.toLowerCase().replace('@', '');
        
        for (const uid in users) {
            if (uid === currentUser.uid) continue;
            const user = users[uid];
            const username = (user.username || '').toLowerCase();
            const userTag = (user.userTag || '').toLowerCase().replace('@', '');
            
            if (username.includes(searchQuery) || userTag.includes(searchQuery)) {
                results.push({ uid, ...user });
            }
            if (results.length >= 20) break;
        }
        
        container.innerHTML = '';
        
        if (results.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;">Пользователи не найдены</div>';
            return;
        }
        
        for (const user of results) {
            const avatarStyle = user.avatar ? `background-image: url(${user.avatar}); background-size: cover;` : '';
            const avatarContent = user.avatar ? '' : '👤';
            
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid #eee; cursor:pointer;';
            div.onclick = () => createPCNewChat(user.uid, user);
            div.innerHTML = `
                <div class="pc-chat-avatar-small" style="${avatarStyle}">${avatarContent}</div>
                <div style="flex:1;">
                    <div style="font-weight:600;">${escapeHtml(user.username)}</div>
                    <div style="font-size:12px; color:#999;">${user.userTag ? '@' + user.userTag : '@' + user.username.toLowerCase().replace(/\s/g, '')}</div>
                </div>
                <div style="color:var(--forest);">→</div>
            `;
            container.appendChild(div);
        }
    }
    
    // Создание нового чата
    async function createPCNewChat(otherUserId, otherUser) {
        showNotification('Создание чата...', 'info');
        
        const chatId = currentUser.uid < otherUserId ? currentUser.uid + '_' + otherUserId : otherUserId + '_' + currentUser.uid;
        const chatSnapshot = await database.ref('chats/' + chatId).once('value');
        
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
            
            showNotification('Чат создан!', 'success');
        } else {
            showNotification('Чат уже существует', 'info');
        }
        
        // Закрываем модалку
        const modal = document.getElementById('pc-new-chat-modal');
        if (modal) modal.remove();
        
        // Перезагружаем чаты и открываем новый
        loadPCChats();
        
        const chatData = await database.ref('chats/' + chatId).once('value');
        openPCChat(chatId, chatData.val());
    }
    
    // Обновление аватара и имени пользователя в боковой панели
    function updatePCUserInfo() {
        const usernameEl = document.getElementById('pc-username');
        const avatarEl = document.getElementById('pc-avatar');
        
        if (usernameEl && window.currentUserData) {
            usernameEl.textContent = window.currentUserData.username || 'Пользователь';
        }
        
        if (avatarEl && window.currentUserData) {
            if (window.currentUserData.avatar) {
                avatarEl.style.backgroundImage = `url(${window.currentUserData.avatar})`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.textContent = '';
            } else {
                avatarEl.textContent = '🥒';
            }
        }
    }
    
    // Функция уведомлений
    function showNotification(message, type) {
        const container = document.getElementById('notifications-container');
        if (!container) {
            alert(message);
            return;
        }
        const notif = document.createElement('div');
        notif.className = 'notification ' + type;
        notif.textContent = message;
        container.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
    
    // Экспорт в глобальную область
    window.pcRebuildChats = buildPCInterface;
    window.pcUpdateUserInfo = updatePCUserInfo;
    
    // Автоматический запуск при переключении на вкладку чатов
    const originalSwitchToTab = window.switchToTab;
    window.switchToTab = function(tabName) {
        if (tabName === 'chats' && !pcInterfaceActive) {
            setTimeout(() => buildPCInterface(), 100);
        }
        if (originalSwitchToTab) originalSwitchToTab(tabName);
    };
    
    // Если уже на вкладке чатов
    setTimeout(() => {
        const chatsTab = document.getElementById('chats-tab');
        if (chatsTab && !chatsTab.classList.contains('hidden')) {
            buildPCInterface();
        }
    }, 1500);
    
    // Следим за обновлением данных пользователя
    const originalUpdateUserDisplay = window.updateUserDisplay;
    window.updateUserDisplay = function() {
        if (originalUpdateUserDisplay) originalUpdateUserDisplay();
        updatePCUserInfo();
    };
    
    console.log('PC Interface: готов');
})();

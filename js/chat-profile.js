// KUKUMBER MESSENGER - CHAT-PROFILE.JS (ПРОСТАЯ РАБОЧАЯ ВЕРСИЯ)

// ========== ГЛОБАЛЬНАЯ ФУНКЦИЯ ОТКРЫТИЯ ПРОФИЛЯ ГРУППЫ ==========
window.openGroupProfile = async function(chatId) {
    console.log('=== openGroupProfile ВЫЗВАНА ===', chatId);
    
    if (!chatId) {
        showNotification('ID группы не указан', 'error');
        return;
    }
    
    try {
        // Получаем данные группы
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        const chatData = chatSnap.val();
        
        if (!chatData || chatData.type !== 'group') {
            showNotification('Группа не найдена', 'error');
            return;
        }
        
        // Удаляем старое окно, если есть
        const oldModal = document.getElementById('group-profile-modal');
        if (oldModal) oldModal.remove();
        
        // Получаем данные создателя
        let creatorName = 'Неизвестно';
        if (chatData.createdBy) {
            try {
                const creatorSnap = await database.ref('users/' + chatData.createdBy).once('value');
                const creatorData = creatorSnap.val();
                if (creatorData) creatorName = creatorData.username;
            } catch(e) {}
        }
        
        const membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
        const isMember = chatData.members && chatData.members[currentUser?.uid];
        const isAdmin = chatData.admins && chatData.admins[currentUser?.uid];
        const isCreator = chatData.createdBy === currentUser?.uid;
        
        // Баннер
        const bannerStyle = chatData.banner ? 
            `background-image: url(${chatData.banner}); background-size: cover; background-position: center;` : 
            'background: linear-gradient(135deg, #228B22, #556B2F);';
        
        // Формируем HTML
        const modal = document.createElement('div');
        modal.id = 'group-profile-modal';
        modal.className = 'modal';
        modal.style.zIndex = '10003';
        modal.innerHTML = `
            <div style="max-width: 450px; width: 90%; background: white; border-radius: 28px; overflow: hidden; max-height: 80vh; display: flex; flex-direction: column; margin: auto;">
                <!-- Шапка -->
                <div style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; background: white; flex-shrink: 0;">
                    <h3 style="margin: 0; flex: 1; text-align: center;">👥 Информация</h3>
                    <button onclick="closeGroupProfileModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                </div>
                
                <!-- Контент -->
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    <!-- Баннер -->
                    <div style="height: 120px; border-radius: 16px; ${bannerStyle}"></div>
                    
                    <!-- Аватар -->
                    <div style="display: flex; justify-content: center; margin-top: -50px;">
                        <div style="width: 90px; height: 90px; border-radius: 50%; background: var(--sage); border: 4px solid white; display: flex; align-items: center; justify-content: center; font-size: 45px; ${chatData.avatar ? 'background-image: url(' + chatData.avatar + '); background-size: cover;' : ''}">
                            ${chatData.avatar ? '' : '👥'}
                        </div>
                    </div>
                    
                    <!-- Имя -->
                    <h2 style="text-align: center; margin: 15px 0 5px;">${escapeHtml(chatData.name || 'Группа')}</h2>
                    
                    <!-- K-name -->
                    ${chatData.kname ? `<p style="text-align: center; color: var(--forest); margin: 0 0 10px;">🔗 @${escapeHtml(chatData.kname)}</p>` : ''}
                    
                    <!-- Кнопка действия -->
                    <button id="group-action-btn" style="display: block; width: 80%; margin: 10px auto; padding: 10px; border-radius: 30px; border: none; font-weight: 600; cursor: pointer; background: ${isMember ? '#dc3545' : '#228B22'}; color: white;">
                        ${isMember ? '🚪 Выйти из группы' : '➕ Вступить в группу'}
                    </button>
                    
                    <!-- Описание -->
                    <div style="background: #f5f5f5; border-radius: 16px; padding: 12px; margin-top: 15px;">
                        <p style="margin: 0; color: #666;">${escapeHtml(chatData.description || 'Нет описания')}</p>
                    </div>
                    
                    <!-- Статистика -->
                    <div style="margin-top: 15px;">
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                            <span>👥 Участников</span>
                            <span>${membersCount}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                            <span>👑 Создатель</span>
                            <span style="color: gold;">${escapeHtml(creatorName)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                            <span>📅 Создана</span>
                            <span>${new Date(chatData.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    
                    <!-- Кнопка поделиться -->
                    <button id="share-group-btn" style="width: 100%; padding: 12px; background: #228B22; color: white; border: none; border-radius: 16px; margin-top: 15px; cursor: pointer;">
                        🔗 Поделиться группой
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        // Сохраняем данные для действий
        window.currentGroupId = chatId;
        window.currentGroupData = chatData;
        
        // Кнопка действия
        const actionBtn = document.getElementById('group-action-btn');
        if (actionBtn) {
            actionBtn.onclick = async () => {
                if (isMember) {
                    if (!confirm('Покинуть группу?')) return;
                    await database.ref('chats/' + chatId + '/members/' + currentUser.uid).remove();
                    await database.ref('userChats/' + currentUser.uid + '/' + chatId).remove();
                    showNotification('Вы покинули группу', 'success');
                    closeGroupProfileModal();
                    if (typeof closeChat === 'function') closeChat();
                    if (typeof loadChats === 'function') loadChats();
                } else {
                    await database.ref('chats/' + chatId + '/members/' + currentUser.uid).set(true);
                    await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
                    showNotification('Вы присоединились к группе', 'success');
                    closeGroupProfileModal();
                    if (typeof loadChats === 'function') loadChats();
                }
            };
        }
        
        // Кнопка поделиться
        const shareBtn = document.getElementById('share-group-btn');
        if (shareBtn) {
            shareBtn.onclick = () => {
                const groupLink = `${window.location.origin}${window.location.pathname}?group=${chatId}`;
                navigator.clipboard.writeText(groupLink);
                showNotification('Ссылка скопирована!', 'success');
            };
        }
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('Ошибка загрузки профиля группы', 'error');
    }
};

// ========== ОТКРЫТИЕ ПРОФИЛЯ КАНАЛА ==========
window.openChannelProfile = async function(chatId) {
    console.log('=== openChannelProfile ВЫЗВАНА ===', chatId);
    
    if (!chatId) {
        showNotification('ID канала не указан', 'error');
        return;
    }
    
    try {
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        const chatData = chatSnap.val();
        
        if (!chatData || chatData.type !== 'channel') {
            showNotification('Канал не найден', 'error');
            return;
        }
        
        const oldModal = document.getElementById('channel-profile-modal');
        if (oldModal) oldModal.remove();
        
        const subscribersCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
        const isSubscribed = chatData.subscribers && chatData.subscribers[currentUser?.uid];
        
        const modal = document.createElement('div');
        modal.id = 'channel-profile-modal';
        modal.className = 'modal';
        modal.style.zIndex = '10003';
        modal.innerHTML = `
            <div style="max-width: 450px; width: 90%; background: white; border-radius: 28px; overflow: hidden; max-height: 80vh; display: flex; flex-direction: column; margin: auto;">
                <div style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; background: white; flex-shrink: 0;">
                    <h3 style="margin: 0; flex: 1; text-align: center;">📢 Информация</h3>
                    <button onclick="closeChannelProfileModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 20px; text-align: center;">
                    <div style="width: 90px; height: 90px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; font-size: 45px; margin: 0 auto; ${chatData.avatar ? 'background-image: url(' + chatData.avatar + '); background-size: cover;' : ''}">
                        ${chatData.avatar ? '' : '📢'}
                    </div>
                    <h2 style="margin: 15px 0 5px;">${escapeHtml(chatData.name || 'Канал')}</h2>
                    ${chatData.kname ? `<p style="color: var(--forest);">@${escapeHtml(chatData.kname)}</p>` : ''}
                    <p style="color: #666;">${escapeHtml(chatData.description || 'Нет описания')}</p>
                    
                    <div style="background: #f5f5f5; border-radius: 12px; padding: 10px; margin: 15px 0;">
                        <span>👥 ${subscribersCount} подписчиков</span>
                    </div>
                    <div style="background: #f5f5f5; border-radius: 12px; padding: 10px; margin-bottom: 15px;">
                        <span>${chatData.privacy === 'public' ? '🌍 Публичный' : '🔒 Приватный'}</span>
                    </div>
                    
                    <button id="channel-action-btn" style="width: 100%; padding: 12px; border-radius: 30px; border: none; font-weight: 600; cursor: pointer; background: ${isSubscribed ? '#dc3545' : '#228B22'}; color: white;">
                        ${isSubscribed ? '🔕 Отписаться' : '📢 Подписаться'}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        window.currentChannelId = chatId;
        window.currentChannelData = chatData;
        
        const actionBtn = document.getElementById('channel-action-btn');
        if (actionBtn) {
            actionBtn.onclick = async () => {
                if (isSubscribed) {
                    await database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).remove();
                    await database.ref('userChats/' + currentUser.uid + '/' + chatId).remove();
                    showNotification('Вы отписались от канала', 'info');
                    closeChannelProfileModal();
                    if (typeof closeChat === 'function') closeChat();
                    if (typeof loadChats === 'function') loadChats();
                } else {
                    await database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true);
                    await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
                    showNotification('Вы подписались на канал', 'success');
                    closeChannelProfileModal();
                    if (typeof loadChats === 'function') loadChats();
                }
            };
        }
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('Ошибка загрузки профиля канала', 'error');
    }
};

// ========== ЗАКРЫТИЕ ==========
window.closeGroupProfileModal = function() {
    const modal = document.getElementById('group-profile-modal');
    if (modal) modal.remove();
};

window.closeChannelProfileModal = function() {
    const modal = document.getElementById('channel-profile-modal');
    if (modal) modal.remove();
};

// ========== ОТКРЫТИЕ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ==========
window.openUserProfile = async function(userId) {
    console.log('openUserProfile вызван для:', userId);
    
    try {
        const userSnap = await database.ref('users/' + userId).once('value');
        const userData = userSnap.val();
        
        if (!userData) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        alert('👤 Пользователь: ' + (userData.username || 'Без имени') + '\n📝 ' + (userData.bio || 'Нет описания'));
        
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
};

console.log('✅ chat-profile.js загружен, функции зарегистрированы:');
console.log('- openGroupProfile:', typeof window.openGroupProfile);
console.log('- openChannelProfile:', typeof window.openChannelProfile);
console.log('- openUserProfile:', typeof window.openUserProfile);

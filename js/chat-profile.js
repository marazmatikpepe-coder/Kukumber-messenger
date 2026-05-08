// CHAT PROFILE - профиль собеседника из чата
// Открывается по клику на шапку чата в личном диалоге

function openChatProfile(userId) {
    window.chatProfileUserId = userId;
    
    var oldModal = document.getElementById('chat-profile-modal');
    if (oldModal) oldModal.remove();
    
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    // Загружаем данные пользователя
    database.ref('users/' + userId).once('value').then(function(userSnap) {
        var userData = userSnap.val();
        if (!userData) return;
        
        var userName = userData.username || 'Пользователь';
        var userAvatar = userData.avatar || '';
        var userBio = userData.bio || 'Нет описания';
        var userBanner = userData.banner || null;
        var userStatus = userData.status || {};
        var isOnline = userStatus.online === true;
        var lastSeen = userStatus.lastSeen;
        
        var bannerStyle = '';
        if (userBanner) {
            if (userBanner.startsWith('#')) {
                bannerStyle = 'background: ' + userBanner + ';';
            } else {
                bannerStyle = 'background-image: url(' + userBanner + '); background-size: cover; background-position: center;';
            }
        } else {
            bannerStyle = 'background: linear-gradient(135deg, #228B22, #556B2F);';
        }
        
        var statusText = isOnline ? '<span style="color: #32CD32;">● В сети</span>' : (lastSeen ? 'Был(а) ' + formatLastSeen(lastSeen) : 'Неизвестно');
        
        var modal = document.createElement('div');
        modal.id = 'chat-profile-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="profile-modal-content">
                <div class="profile-banner" style="${bannerStyle}">
                    <button class="profile-close-btn" onclick="closeChatProfileModal()">×</button>
                </div>
                <div class="profile-avatar-wrapper">
                    <div class="profile-avatar" style="background-image: url(${userAvatar}); background-size: cover;">
                        ${!userAvatar ? '👤' : ''}
                    </div>
                </div>
                <div class="profile-info">
                    <div class="profile-name-row">
                        <h2 class="profile-name">${escapeHtml(userName)}</h2>
                        ${isOwnProfile ? '' : `
                            <button class="profile-subscribe-btn" id="chat-subscribe-btn" onclick="toggleChatSubscription()">Подписаться</button>
                            <button class="profile-notify-btn" id="chat-notify-btn" onclick="toggleChatNotifications()">🔔</button>
                        `}
                    </div>
                    <div class="profile-subscribers" id="chat-subscribers-count">👥 Загрузка...</div>
                    <div class="profile-status">${statusText}</div>
                    <p class="profile-bio">${escapeHtml(userBio)}</p>
                </div>
                <div class="profile-tabs">
                    <button class="profile-tab-btn active" onclick="switchChatProfileTab('contacts', '${userId}')">👥 Контакты</button>
                    <button class="profile-tab-btn" onclick="switchChatProfileTab('media', '${userId}')">📷 Медиа</button>
                    <button class="profile-tab-btn" onclick="switchChatProfileTab('files', '${userId}')">📎 Файлы</button>
                    <button class="profile-tab-btn" onclick="switchChatProfileTab('voice', '${userId}')">🎤 Голосовые</button>
                    <button class="profile-tab-btn" onclick="switchChatProfileTab('links', '${userId}')">🔗 Ссылки</button>
                </div>
                <div id="chat-profile-content" class="profile-content">
                    <div class="profile-loading">Загрузка...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        // Загружаем количество подписчиков
        database.ref('subscriptions/').orderByChild(userId).equalTo(true).once('value').then(function(subsSnap) {
            var count = subsSnap.val() ? Object.keys(subsSnap.val()).length : 0;
            var subsDiv = document.getElementById('chat-subscribers-count');
            if (subsDiv) subsDiv.textContent = '👥 ' + count + ' подписчиков';
        });
        
        if (!isOwnProfile) {
            checkChatSubscriptionStatus(userId);
            checkChatNotificationStatus(userId);
        }
        
        switchChatProfileTab('contacts', userId);
    });
}

function checkChatSubscriptionStatus(userId) {
    database.ref('subscriptions/' + currentUser.uid + '/' + userId).once('value').then(function(snap) {
        var isSubscribed = snap.exists();
        var btn = document.getElementById('chat-subscribe-btn');
        if (btn) {
            btn.textContent = isSubscribed ? 'Отписаться' : 'Подписаться';
            btn.style.background = isSubscribed ? '#555' : '#1a1a1a';
        }
    });
}

function checkChatNotificationStatus(userId) {
    database.ref('subscriptionNotifications/' + currentUser.uid + '/' + userId).once('value').then(function(snap) {
        var notifBtn = document.getElementById('chat-notify-btn');
        if (notifBtn) {
            notifBtn.style.opacity = snap.val() === true ? '1' : '0.5';
        }
    });
}

function toggleChatSubscription() {
    var userId = window.chatProfileUserId;
    if (!userId || userId === currentUser.uid) return;
    
    var subRef = database.ref('subscriptions/' + currentUser.uid + '/' + userId);
    subRef.once('value').then(function(snap) {
        if (snap.exists()) {
            subRef.remove();
            showNotification('Вы отписались', 'info');
        } else {
            subRef.set(true);
            showNotification('Вы подписались', 'success');
        }
        checkChatSubscriptionStatus(userId);
        database.ref('subscriptions/').orderByChild(userId).equalTo(true).once('value').then(function(subsSnap) {
            var count = subsSnap.val() ? Object.keys(subsSnap.val()).length : 0;
            var subsDiv = document.getElementById('chat-subscribers-count');
            if (subsDiv) subsDiv.textContent = '👥 ' + count + ' подписчиков';
        });
    });
}

function toggleChatNotifications() {
    var userId = window.chatProfileUserId;
    if (!userId || userId === currentUser.uid) return;
    
    var notifRef = database.ref('subscriptionNotifications/' + currentUser.uid + '/' + userId);
    notifRef.once('value').then(function(snap) {
        var currentState = snap.val() === true;
        if (currentState) {
            notifRef.remove();
            showNotification('Уведомления выключены', 'info');
        } else {
            notifRef.set(true);
            showNotification('Уведомления включены', 'success');
        }
        var notifBtn = document.getElementById('chat-notify-btn');
        if (notifBtn) notifBtn.style.opacity = !currentState ? '1' : '0.5';
    });
}

function switchChatProfileTab(tab, userId) {
    var content = document.getElementById('chat-profile-content');
    if (!content) return;
    
    var btns = document.querySelectorAll('#chat-profile-modal .profile-tab-btn');
    btns.forEach(function(btn) { btn.classList.remove('active'); });
    var clickedBtn = Array.from(btns).find(function(btn) {
        if (tab === 'contacts' && btn.textContent.includes('Контакты')) return true;
        if (tab === 'media' && btn.textContent.includes('Медиа')) return true;
        if (tab === 'files' && btn.textContent.includes('Файлы')) return true;
        if (tab === 'voice' && btn.textContent.includes('Голосовые')) return true;
        if (tab === 'links' && btn.textContent.includes('Ссылки')) return true;
        return false;
    });
    if (clickedBtn) clickedBtn.classList.add('active');
    
    content.innerHTML = '<div class="profile-loading">Загрузка...</div>';
    
    if (tab === 'contacts') {
        // Общие контакты (контакты, которые есть и у текущего пользователя, и у собеседника)
        loadMutualContacts(content, userId);
    } else {
        loadChatMessagesForChatProfile(content, userId, tab);
    }
}

function loadMutualContacts(container, userId) {
    var myContactsRef = database.ref('contacts/' + currentUser.uid);
    var userContactsRef = database.ref('contacts/' + userId);
    
    Promise.all([myContactsRef.once('value'), userContactsRef.once('value')]).then(function(results) {
        var myContacts = results[0].val() || {};
        var userContacts = results[1].val() || {};
        
        var mutual = [];
        for (var contactId in myContacts) {
            if (userContacts[contactId]) {
                mutual.push(contactId);
            }
        }
        
        if (mutual.length === 0) {
            container.innerHTML = '<div class="profile-empty">Нет общих контактов</div>';
            return;
        }
        
        container.innerHTML = '';
        mutual.forEach(function(contactId) {
            database.ref('users/' + contactId).once('value').then(function(userSnap) {
                var user = userSnap.val();
                if (!user) return;
                var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                var avatarContent = user.avatar ? '' : '👤';
                var div = document.createElement('div');
                div.className = 'mutual-contact-item';
                div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px solid var(--border); cursor:pointer;';
                div.onclick = function() { openChatProfile(contactId); };
                div.innerHTML = `
                    <div class="avatar" style="width:40px; height:40px; ${avatarStyle}">${avatarContent}</div>
                    <div><strong>${escapeHtml(user.username)}</strong></div>
                `;
                container.appendChild(div);
            });
        });
    });
}

function loadChatMessagesForChatProfile(container, userId, tab) {
    var userChatsRef = database.ref('userChats/' + currentUser.uid);
    userChatsRef.once('value').then(function(chatsSnap) {
        var chats = chatsSnap.val();
        if (!chats) { container.innerHTML = '<div class="profile-empty">Нет данных</div>'; return; }
        
        var allMessages = [];
        var chatIds = Object.keys(chats);
        var processed = 0;
        
        chatIds.forEach(function(chatId) {
            database.ref('messages/' + chatId).once('value').then(function(messagesSnap) {
                var messages = messagesSnap.val();
                if (messages) {
                    for (var msgId in messages) {
                        var msg = messages[msgId];
                        if (msg.senderId === userId || (msg.senderId === currentUser.uid && msg.type === 'text' && msg.text.includes(userId))) {
                            allMessages.push(msg);
                        }
                    }
                }
                processed++;
                if (processed === chatIds.length) {
                    filterAndDisplayChatProfileMessages(container, allMessages, tab);
                }
            });
        });
    });
}

function filterAndDisplayChatProfileMessages(container, messages, tab) {
    var filtered = [];
    
    messages.forEach(function(msg) {
        if (tab === 'media' && (msg.type === 'image' || msg.type === 'video' || msg.type === 'gif')) {
            filtered.push(msg);
        } else if (tab === 'files' && msg.type === 'file') {
            filtered.push(msg);
        } else if (tab === 'voice' && msg.type === 'audio') {
            filtered.push(msg);
        } else if (tab === 'links' && msg.type === 'text' && msg.text && msg.text.match(/(https?:\/\/[^\s]+)/g)) {
            filtered.push(msg);
        }
    });
    
    filtered.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    
    container.innerHTML = '';
    if (filtered.length === 0) {
        var tabNames = { media: 'Медиа', files: 'Файлы', voice: 'Голосовые', links: 'Ссылки' };
        container.innerHTML = '<div class="profile-empty">Нет ' + tabNames[tab] + '</div>';
        return;
    }
    
    filtered.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'profile-media-item';
        
        if (tab === 'media') {
            if (item.type === 'image') {
                div.innerHTML = '<img src="' + item.imageUrl + '" class="profile-media-img" onclick="openSliceLightbox(\'' + item.imageUrl + '\')">';
            } else if (item.type === 'gif') {
                div.innerHTML = '<img src="' + item.gifUrl + '" class="profile-media-img" onclick="openSliceLightbox(\'' + item.gifUrl + '\')"><span class="gif-badge-small">GIF</span>';
            } else if (item.type === 'video') {
                div.innerHTML = '<video src="' + item.videoUrl + '" class="profile-media-video" controls></video>';
            }
        } else if (tab === 'files') {
            div.innerHTML = '<div class="profile-file-item">📎 <a href="' + item.fileUrl + '" target="_blank">' + escapeHtml(item.fileName) + '</a></div>';
        } else if (tab === 'voice') {
            div.innerHTML = '<div class="profile-voice-item">🎤 <audio src="' + item.audioUrl + '" controls></audio></div>';
        } else if (tab === 'links') {
            var urls = item.text.match(/(https?:\/\/[^\s]+)/g);
            if (urls) {
                urls.forEach(function(url) {
                    div.innerHTML += '<div class="profile-link-item">🔗 <a href="' + url + '" target="_blank">' + url + '</a></div>';
                });
            }
        }
        
        container.appendChild(div);
    });
}

function closeChatProfileModal() {
    var modal = document.getElementById('chat-profile-modal');
    if (modal) modal.remove();
}

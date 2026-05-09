// KUKUMBER AUTH.JS - Регистрация, вход, сброс пароля, уникальные юзернеймы

function showRegister() { 
    document.getElementById('login-form').classList.add('hidden'); 
    document.getElementById('register-form').classList.remove('hidden'); 
}

function showLogin() { 
    document.getElementById('register-form').classList.add('hidden'); 
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden'); 
}

function showForgotPassword() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.remove('hidden');
}

function backToLogin() {
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const userTagRaw = document.getElementById('reg-usertag').value.trim().toLowerCase();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-password-confirm').value;
    
    // Валидация
    if (!username) { showNotification('Введите отображаемое имя!', 'error'); return; }
    if (username.length < 2) { showNotification('Имя должно быть минимум 2 символа!', 'error'); return; }
    
    if (!userTagRaw) { showNotification('Введите юзернейм!', 'error'); return; }
    if (userTagRaw.length < 3) { showNotification('Юзернейм минимум 3 символа!', 'error'); return; }
    if (!/^[a-z0-9_]+$/.test(userTagRaw)) { 
        showNotification('Только латинские буквы, цифры и _', 'error'); 
        return; 
    }
    
    const userTag = '@' + userTagRaw;
    
    if (!email) { showNotification('Введите email!', 'error'); return; }
    if (!password) { showNotification('Введите пароль!', 'error'); return; }
    if (password.length < 6) { showNotification('Пароль минимум 6 символов!', 'error'); return; }
    if (password !== confirmPassword) { showNotification('Пароли не совпадают!', 'error'); return; }
    
    const btn = document.querySelector('#register-form .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Создание...';
    
    try {
        // Проверяем уникальность юзернейма
        const tagSnapshot = await database.ref('userTags/' + userTag).once('value');
        if (tagSnapshot.exists()) {
            showNotification('Юзернейм ' + userTag + ' уже занят!', 'error');
            btn.disabled = false;
            btn.textContent = 'Создать аккаунт';
            return;
        }
        
        // Проверяем email
        const emailKey = email.replace(/[.#$]/g, ',');
        const emailSnapshot = await database.ref('emails/' + emailKey).once('value');
        if (emailSnapshot.exists()) {
            showNotification('Email уже используется!', 'error');
            btn.disabled = false;
            btn.textContent = 'Создать аккаунт';
            return;
        }
        
        // Создаём пользователя
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Сохраняем данные
        await database.ref('users/' + user.uid).set({
            username: username,
            userTag: userTag,
            email: email,
            avatar: '',
            bio: '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: {
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            }
        });
        
        await database.ref('userTags/' + userTag).set(user.uid);
        await database.ref('emails/' + emailKey).set(user.uid);
        
        showNotification('Регистрация успешна!', 'success');
        
        // Очищаем форму
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-usertag').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-password').value = '';
        document.getElementById('reg-password-confirm').value = '';
        
    } catch (error) {
        console.error(error);
        let errorMessage = 'Ошибка регистрации';
        switch (error.code) {
            case 'auth/email-already-in-use': errorMessage = 'Email уже используется!'; break;
            case 'auth/invalid-email': errorMessage = 'Некорректный email!'; break;
            case 'auth/weak-password': errorMessage = 'Слабый пароль!'; break;
            default: errorMessage = error.message;
        }
        showNotification(errorMessage, 'error');
    }
    
    btn.disabled = false;
    btn.textContent = 'Создать аккаунт';
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email) { showNotification('Введите email!', 'error'); return; }
    if (!password) { showNotification('Введите пароль!', 'error'); return; }
    
    const btn = document.querySelector('#login-form .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Вход...';
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Добро пожаловать в Kukumber!', 'success');
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    } catch (error) {
        console.error(error);
        let errorMessage = 'Ошибка входа';
        switch (error.code) {
            case 'auth/user-not-found': errorMessage = 'Пользователь не найден!'; break;
            case 'auth/wrong-password': errorMessage = 'Неверный пароль!'; break;
            case 'auth/invalid-email': errorMessage = 'Некорректный email!'; break;
            case 'auth/too-many-requests': errorMessage = 'Слишком много попыток. Попробуйте позже.'; break;
            default: errorMessage = error.message;
        }
        showNotification(errorMessage, 'error');
    }
    
    btn.disabled = false;
    btn.textContent = 'Войти';
}

// ========== СБРОС ПАРОЛЯ ==========
async function sendResetEmail() {
    const email = document.getElementById('reset-email').value.trim();
    
    if (!email) {
        showNotification('Введите email!', 'error');
        return;
    }
    
    const btn = document.querySelector('#forgot-password-form .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Отправка...';
    
    try {
        await auth.sendPasswordResetEmail(email);
        showNotification('Письмо для сброса пароля отправлено на ' + email, 'success');
        backToLogin();
    } catch (error) {
        console.error(error);
        let errorMessage = 'Ошибка';
        switch (error.code) {
            case 'auth/user-not-found': errorMessage = 'Пользователь с таким email не найден'; break;
            case 'auth/invalid-email': errorMessage = 'Некорректный email'; break;
            default: errorMessage = error.message;
        }
        showNotification(errorMessage, 'error');
    }
    
    btn.disabled = false;
    btn.textContent = 'Отправить';
}

// ========== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ПО ЮЗЕРНЕЙМУ ==========
async function searchUsersByTag(query) {
    if (!query || query.length < 2) return [];
    
    var searchTag = query.toLowerCase();
    if (!searchTag.startsWith('@')) {
        searchTag = '@' + searchTag;
    }
    
    var snapshot = await database.ref('userTags').orderByKey().startAt(searchTag).endAt(searchTag + '\uf8ff').limitToFirst(20).once('value');
    var tags = snapshot.val();
    var results = [];
    
    for (var tag in tags) {
        var userId = tags[tag];
        if (userId === currentUser.uid) continue;
        var userSnap = await database.ref('users/' + userId).once('value');
        var user = userSnap.val();
        if (user) {
            results.push({
                uid: userId,
                username: user.username,
                userTag: user.userTag,
                avatar: user.avatar
            });
        }
    }
    
    return results;
}

function showGlobalSearch() {
    document.getElementById('global-search-modal').classList.remove('hidden');
    document.getElementById('global-search-input').value = '';
    document.getElementById('global-users-list').innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-muted);">Введите @username для поиска</div>';
}

async function searchGlobalUsers() {
    var query = document.getElementById('global-search-input').value.trim();
    var container = document.getElementById('global-users-list');
    
    if (query.length < 2) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-muted);">Введите минимум 2 символа</div>';
        return;
    }
    
    container.innerHTML = '<div style="padding:20px; text-align:center;">🔍 Поиск...</div>';
    
    var users = await searchUsersByTag(query);
    
    if (users.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-muted);">😕 Пользователи не найдены</div>';
        return;
    }
    
    container.innerHTML = '';
    users.forEach(function(user) {
        var div = document.createElement('div');
        div.className = 'user-item';
        div.style.cursor = 'pointer';
        var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
        var avatarContent = user.avatar ? '' : '👤';
        div.innerHTML = `
            <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
            <div class="user-item-info">
                <h4>${escapeHtml(user.username)}</h4>
                <p style="font-size:12px; color:var(--text-muted);">${escapeHtml(user.userTag)}</p>
            </div>
            <button class="add-contact-btn" onclick="event.stopPropagation(); addToContacts('${user.uid}', '${escapeHtml(user.username)}')">➕ Добавить</button>
        `;
        div.onclick = function() {
            startPrivateChat(user.uid, { username: user.username, avatar: user.avatar, userTag: user.userTag });
            closeGlobalSearch();
        };
        container.appendChild(div);
    });
}

function addToContacts(uid, name) {
    database.ref('contacts/' + currentUser.uid + '/' + uid).set(true);
    database.ref('contactsReverse/' + uid + '/' + currentUser.uid).set(true);
    showNotification(name + ' добавлен в контакты', 'success');
    loadContacts(true);
}

function closeGlobalSearch() {
    document.getElementById('global-search-modal').classList.add('hidden');
}

// Загружаем контакты для нового чата
function loadContacts(forceRefresh) {
    var list = document.getElementById('users-list');
    list.innerHTML = '<div style="padding:20px; text-align:center;">🔄 Загрузка контактов...</div>';
    
    database.ref('contacts/' + currentUser.uid).once('value').then(function(snapshot) {
        var contacts = snapshot.val();
        
        if (!contacts) {
            list.innerHTML = '<div style="padding:20px; text-align:center;">Нет контактов. Добавьте через поиск 🔍</div>';
            return;
        }
        
        var userIds = Object.keys(contacts);
        if (userIds.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center;">Нет контактов. Добавьте через поиск 🔍</div>';
            return;
        }
        
        list.innerHTML = '';
        var pending = userIds.length;
        
        userIds.forEach(function(uid) {
            database.ref('users/' + uid).once('value').then(function(userSnap) {
                var user = userSnap.val();
                if (user) {
                    var div = document.createElement('div');
                    div.className = 'user-item';
                    div.style.cursor = 'pointer';
                    var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                    var avatarContent = user.avatar ? '' : '👤';
                    div.innerHTML = `
                        <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                        <div class="user-item-info">
                            <h4>${escapeHtml(user.username)}</h4>
                            <p style="font-size:11px; color:var(--text-muted);">${escapeHtml(user.userTag)}</p>
                        </div>
                    `;
                    div.onclick = (function(uid, user) {
                        return function() { 
                            startPrivateChat(uid, user);
                            closeNewChatDialog();
                        };
                    })(uid, user);
                    list.appendChild(div);
                }
                pending--;
                if (pending === 0 && list.children.length === 0) {
                    list.innerHTML = '<div style="padding:20px; text-align:center;">Нет доступных контактов</div>';
                }
            });
        });
    });
}

function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    loadContacts();
}

function closeNewChatDialog() {
    document.getElementById('new-chat-modal').classList.add('hidden');
}

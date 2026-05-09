// KUKUMBER AUTH - ЧИСТАЯ ВЕРСИЯ
function showRegister() { 
    document.getElementById('login-form').classList.add('hidden'); 
    document.getElementById('register-form').classList.remove('hidden'); 
}

function showLogin() { 
    document.getElementById('register-form').classList.add('hidden'); 
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
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-password-confirm').value;
    
    if (!username) { showNotification('Введите имя пользователя!', 'error'); return; }
    if (username.length < 3) { showNotification('Имя должно быть минимум 3 символа!', 'error'); return; }
    if (!email) { showNotification('Введите email!', 'error'); return; }
    if (!password) { showNotification('Введите пароль!', 'error'); return; }
    if (password.length < 6) { showNotification('Пароль минимум 6 символов!', 'error'); return; }
    if (password !== confirmPassword) { showNotification('Пароли не совпадают!', 'error'); return; }
    
    const btn = document.querySelector('#register-form .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Создание...';
    
    try {
        const usernameSnapshot = await database.ref('usernames/' + username.toLowerCase()).once('value');
        if (usernameSnapshot.exists()) { 
            showNotification('Имя пользователя уже занято!', 'error'); 
            btn.disabled = false;
            btn.textContent = 'Создать аккаунт';
            return; 
        }
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await database.ref('users/' + user.uid).set({
            username: username,
            email: email,
            avatar: '',
            bio: '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: { online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP }
        });
        
        await database.ref('usernames/' + username.toLowerCase()).set(user.uid);
        
        showNotification('Регистрация успешна!', 'success');
        
        document.getElementById('reg-username').value = '';
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
            case 'auth/too-many-requests': errorMessage = 'Слишком много попыток.'; break;
            default: errorMessage = error.message;
        }
        showNotification(errorMessage, 'error');
    }
    
    btn.disabled = false;
    btn.textContent = 'Войти';
}

function sendResetEmail() {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) {
        showNotification('Введите email!', 'error');
        return;
    }
    
    auth.sendPasswordResetEmail(email).then(function() {
        showNotification('Письмо для сброса пароля отправлено!', 'success');
        backToLogin();
    }).catch(function(error) {
        showNotification('Ошибка: ' + error.message, 'error');
    });
}

function logout() {
    if (!confirm('Вы уверены, что хотите выйти?')) return;
    if (typeof messagesListener !== 'undefined' && messagesListener) messagesListener.off();
    auth.signOut().then(function() {
        currentUser = null;
        currentUserData = null;
        currentChatId = null;
        currentChatUser = null;
        showNotification('Вы вышли', 'info');
    }).catch(function(error) { 
        showNotification('Ошибка выхода', 'error'); 
    });
}

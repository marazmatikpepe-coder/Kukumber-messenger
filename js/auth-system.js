// KUKUMBER AUTH SYSTEM - Новая система авторизации
// Поддержка: регистрация только по номеру телефона, верификация по SMS (через Firebase)

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var currentUser = null;
var currentUserData = null;
var currentVerificationId = null;
var pendingPhoneNumber = null;
var pendingUserTag = null;
var pendingPassword = null;

// ========== ИНИЦИАЛИЗАЦИЯ FIREBASE AUTH ==========
if (typeof firebase !== 'undefined') {
    // Включаем провайдер телефона
    window.recaptchaVerifier = null;
}

// ========== ОТОБРАЖЕНИЕ ЭКРАНОВ ==========
function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
    showLoginScreen();
}

function showLoginScreen() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('phone-verification-form').classList.add('hidden');
    document.getElementById('set-password-form').classList.add('hidden');
    document.getElementById('link-phone-form').classList.add('hidden');
}

function showRegisterScreen() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
}

function showForgotPasswordScreen() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.remove('hidden');
}

function showPhoneVerificationScreen() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('phone-verification-form').classList.remove('hidden');
}

function showSetPasswordScreen() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('phone-verification-form').classList.add('hidden');
    document.getElementById('set-password-form').classList.remove('hidden');
}

function showLinkPhoneScreen() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('link-phone-form').classList.remove('hidden');
}

// ========== РЕГИСТРАЦИЯ ПО НОМЕРУ ТЕЛЕФОНА ==========
function startPhoneRegistration() {
    var phone = document.getElementById('reg-phone').value.trim();
    if (!phone) {
        showNotification('Введите номер телефона', 'error');
        return;
    }
    
    // Форматируем номер (добавляем + если нет)
    if (!phone.startsWith('+')) {
        phone = '+' + phone;
    }
    
    if (phone.length < 10) {
        showNotification('Введите корректный номер телефона', 'error');
        return;
    }
    
    pendingPhoneNumber = phone;
    
    // Сначала проверяем, не зарегистрирован ли уже номер
    database.ref('phoneLinks/' + phone.replace(/\+/g, '')).once('value').then(function(snap) {
        if (snap.exists() && snap.val().verified) {
            showNotification('Этот номер уже зарегистрирован. Войдите или восстановите пароль.', 'error');
            return;
        }
        
        // Отправляем SMS код через Firebase
        sendVerificationCode(phone, 'register');
    }).catch(function(err) {
        showNotification('Ошибка проверки: ' + err.message, 'error');
    });
}

function sendVerificationCode(phoneNumber, purpose) {
    showNotification('Отправка кода на ' + phoneNumber + '...', 'info');
    
    // Создаём recaptcha если ещё нет
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            size: 'invisible',
            callback: function() {}
        });
    }
    
    // Отправляем код через Firebase
    var appVerifier = window.recaptchaVerifier;
    
    firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
        .then(function(confirmationResult) {
            currentVerificationId = confirmationResult;
            window.currentVerificationPurpose = purpose;
            showNotification('Код отправлен!', 'success');
            showPhoneVerificationScreen();
            document.getElementById('verification-phone').textContent = phoneNumber;
        })
        .catch(function(error) {
            console.error(error);
            showNotification('Ошибка отправки кода: ' + error.message, 'error');
        });
}

function verifyCode() {
    var code = document.getElementById('verification-code').value.trim();
    if (!code || code.length < 6) {
        showNotification('Введите 6-значный код', 'error');
        return;
    }
    
    if (!currentVerificationId) {
        showNotification('Ошибка: запросите код заново', 'error');
        return;
    }
    
    showNotification('Проверка кода...', 'info');
    
    currentVerificationId.confirm(code).then(function(result) {
        var user = result.user;
        
        if (window.currentVerificationPurpose === 'register') {
            // Регистрация: создаём профиль
            createUserProfile(user);
        } else if (window.currentVerificationPurpose === 'login') {
            // Вход: проверяем наличие профиля
            checkUserProfile(user);
        } else if (window.currentVerificationPurpose === 'reset') {
            // Сброс пароля: показываем форму нового пароля
            showSetPasswordScreen();
            window.resetUserId = user.uid;
        } else if (window.currentVerificationPurpose === 'link') {
            // Привязка номера к существующему аккаунту
            linkPhoneToAccount(user);
        }
    }).catch(function(error) {
        console.error(error);
        showNotification('Неверный код. Попробуйте снова.', 'error');
    });
}

function createUserProfile(user) {
    var username = document.getElementById('reg-username').value.trim();
    var userTag = document.getElementById('reg-usertag').value.trim().toLowerCase();
    var password = document.getElementById('reg-password').value;
    
    // Валидация
    if (!username) {
        showNotification('Введите отображаемое имя', 'error');
        return;
    }
    
    if (!userTag) {
        showNotification('Введите уникальный юзернейм', 'error');
        return;
    }
    
    // Форматируем юзернейм
    userTag = userTag.replace(/[^a-z0-9_]/g, '');
    if (userTag.length < 3) {
        showNotification('Юзернейм должен быть минимум 3 символа (буквы, цифры, _)', 'error');
        return;
    }
    
    var fullUserTag = '@K-' + userTag;
    
    if (password && password.length < 6) {
        showNotification('Пароль минимум 6 символов', 'error');
        return;
    }
    
    // Проверяем уникальность юзернейма
    database.ref('userTags/' + fullUserTag).once('value').then(function(snap) {
        if (snap.exists()) {
            showNotification('Юзернейм ' + fullUserTag + ' уже занят', 'error');
            return;
        }
        
        // Создаём email для Firebase Auth (виртуальный)
        var fakeEmail = user.uid + '@kukumber.local';
        
        // Устанавливаем пароль для email-аккаунта
        return user.updateEmail(fakeEmail).then(function() {
            if (password) {
                return user.updatePassword(password);
            }
        }).then(function() {
            // Сохраняем данные в Realtime Database
            var userData = {
                uid: user.uid,
                username: username,
                userTag: fullUserTag,
                email: fakeEmail,
                phone: pendingPhoneNumber,
                phoneVerified: true,
                avatar: '',
                bio: '',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                status: {
                    online: true,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                }
            };
            
            return database.ref('users/' + user.uid).set(userData);
        }).then(function() {
            return database.ref('userTags/' + fullUserTag).set(user.uid);
        }).then(function() {
            var phoneKey = pendingPhoneNumber.replace(/\+/g, '');
            return database.ref('phoneLinks/' + phoneKey).set({
                userId: user.uid,
                verified: true,
                linkedAt: firebase.database.ServerValue.TIMESTAMP
            });
        }).then(function() {
            showNotification('Регистрация успешна! Добро пожаловать в Kukumber 🥒', 'success');
            currentUser = user;
            loadUserData();
            showMainScreen();
            requestPhoneContactsPermission();
        });
    }).catch(function(err) {
        console.error(err);
        showNotification('Ошибка: ' + err.message, 'error');
    });
}

function checkUserProfile(user) {
    database.ref('users/' + user.uid).once('value').then(function(snap) {
        var userData = snap.val();
        if (userData) {
            // Профиль существует - вход выполнен
            currentUser = user;
            loadUserData();
            showMainScreen();
            syncPhoneContacts();
        } else {
            // Профиля нет - возможно, нужно привязать номер
            showNotification('Аккаунт не найден. Пожалуйста, зарегистрируйтесь.', 'error');
            auth.signOut();
            showLoginScreen();
        }
    });
}

function linkPhoneToAccount(user) {
    // Привязываем номер телефона к существующему аккаунту
    var phoneKey = pendingPhoneNumber.replace(/\+/g, '');
    
    database.ref('phoneLinks/' + phoneKey).set({
        userId: currentUser.uid,
        verified: true,
        linkedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function() {
        // Обновляем профиль пользователя
        return database.ref('users/' + currentUser.uid + '/phone').set(pendingPhoneNumber);
    }).then(function() {
        return database.ref('users/' + currentUser.uid + '/phoneVerified').set(true);
    }).then(function() {
        showNotification('Номер телефона привязан!', 'success');
        closeLinkPhoneModal();
        syncPhoneContacts();
    }).catch(function(err) {
        showNotification('Ошибка привязки: ' + err.message, 'error');
    });
}

// ========== ВХОД ПО НОМЕРУ ==========
function sendLoginCode() {
    var phone = document.getElementById('login-phone').value.trim();
    if (!phone) {
        showNotification('Введите номер телефона', 'error');
        return;
    }
    
    if (!phone.startsWith('+')) {
        phone = '+' + phone;
    }
    
    pendingPhoneNumber = phone;
    sendVerificationCode(phone, 'login');
}

// ========== ВОССТАНОВЛЕНИЕ ПАРОЛЯ ==========
function sendResetCode() {
    var phone = document.getElementById('reset-phone').value.trim();
    if (!phone) {
        showNotification('Введите номер телефона', 'error');
        return;
    }
    
    if (!phone.startsWith('+')) {
        phone = '+' + phone;
    }
    
    // Проверяем, существует ли номер
    var phoneKey = phone.replace(/\+/g, '');
    database.ref('phoneLinks/' + phoneKey).once('value').then(function(snap) {
        if (!snap.exists() || !snap.val().verified) {
            showNotification('Номер не зарегистрирован', 'error');
            return;
        }
        
        pendingPhoneNumber = phone;
        sendVerificationCode(phone, 'reset');
    }).catch(function(err) {
        showNotification('Ошибка: ' + err.message, 'error');
    });
}

function resetPassword() {
    var newPassword = document.getElementById('new-password').value;
    var confirmPassword = document.getElementById('confirm-password').value;
    
    if (!newPassword || newPassword.length < 6) {
        showNotification('Пароль должен быть минимум 6 символов', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    // Обновляем пароль через Firebase Auth
    var user = firebase.auth().currentUser;
    if (user && window.resetUserId === user.uid) {
        user.updatePassword(newPassword).then(function() {
            showNotification('Пароль успешно изменён!', 'success');
            showLoginScreen();
        }).catch(function(err) {
            showNotification('Ошибка: ' + err.message, 'error');
        });
    } else {
        showNotification('Ошибка: пользователь не найден', 'error');
    }
}

// ========== ЗАПРОС ДОСТУПА К КОНТАКТАМ ==========
function requestPhoneContactsPermission() {
    if ('contacts' in navigator && 'ContactsManager' in window) {
        navigator.contacts.select(['name', 'tel'], { multiple: true })
            .then(function(contacts) {
                syncContactsWithDatabase(contacts);
            })
            .catch(function(err) {
                console.log('Доступ к контактам запрещён или не поддерживается', err);
                showNotification('Для поиска друзей разрешите доступ к контактам', 'info');
            });
    } else {
        console.log('Contacts API не поддерживается');
        // Альтернатива: загрузка vCard файла
        showUploadContactsOption();
    }
}

function syncContactsWithDatabase(contacts) {
    var phoneNumbers = [];
    contacts.forEach(function(contact) {
        if (contact.tel && contact.tel.length) {
            contact.tel.forEach(function(tel) {
                var cleanNumber = tel.value.replace(/[^0-9+]/g, '');
                if (cleanNumber) {
                    phoneNumbers.push(cleanNumber);
                }
            });
        }
    });
    
    // Ищем пользователей Kukumber среди контактов
    findKukumberUsers(phoneNumbers);
}

function findKukumberUsers(phoneNumbers) {
    var foundUsers = [];
    var processed = 0;
    
    phoneNumbers.forEach(function(phone) {
        var phoneKey = phone.replace(/\+/g, '');
        database.ref('phoneLinks/' + phoneKey).once('value').then(function(snap) {
            var link = snap.val();
            if (link && link.verified && link.userId !== currentUser.uid) {
                foundUsers.push(link.userId);
            }
            processed++;
            if (processed === phoneNumbers.length) {
                addFoundUsersToContacts(foundUsers);
            }
        });
    });
}

function addFoundUsersToContacts(userIds) {
    var updates = {};
    userIds.forEach(function(uid) {
        updates['contacts/' + currentUser.uid + '/' + uid] = true;
        updates['contactsReverse/' + uid + '/' + currentUser.uid] = true;
    });
    
    if (Object.keys(updates).length > 0) {
        database.ref().update(updates).then(function() {
            console.log('Добавлено ' + userIds.length + ' контактов');
            showNotification('Найдено ' + userIds.length + ' друзей в Kukumber!', 'success');
            loadContacts();
        });
    }
}

function showUploadContactsOption() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vcf,.csv';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            parseContactFile(file);
        }
    };
    input.click();
}

function parseContactFile(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = e.target.result;
        var phoneNumbers = extractPhonesFromVCard(content);
        findKukumberUsers(phoneNumbers);
    };
    reader.readAsText(file);
}

function extractPhonesFromVCard(content) {
    var phones = [];
    var telMatches = content.match(/TEL[^:]*:([^\r\n]+)/gi);
    if (telMatches) {
        telMatches.forEach(function(match) {
            var phone = match.replace(/TEL[^:]*:/, '').trim();
            phone = phone.replace(/[^0-9+]/g, '');
            if (phone && phone.length > 5) {
                phones.push(phone);
            }
        });
    }
    return phones;
}

function syncPhoneContacts() {
    if (currentUserData && !currentUserData.phoneVerified) {
        showLinkPhoneModal();
    } else {
        requestPhoneContactsPermission();
    }
}

function showLinkPhoneModal() {
    document.getElementById('link-phone-number').value = '';
    showLinkPhoneScreen();
}

function closeLinkPhoneModal() {
    document.getElementById('link-phone-form').classList.add('hidden');
}

function sendLinkPhoneCode() {
    var phone = document.getElementById('link-phone-number').value.trim();
    if (!phone) {
        showNotification('Введите номер телефона', 'error');
        return;
    }
    
    if (!phone.startsWith('+')) {
        phone = '+' + phone;
    }
    
    pendingPhoneNumber = phone;
    sendVerificationCode(phone, 'link');
}

// ========== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ПО @K-username ==========
function searchUsers(query) {
    return new Promise(function(resolve, reject) {
        if (!query || query.length < 3) {
            resolve([]);
            return;
        }
        
        // Поиск по @K-username
        var searchTag = query.toLowerCase();
        if (!searchTag.startsWith('@k-')) {
            searchTag = '@k-' + searchTag;
        }
        
        database.ref('userTags').orderByKey().startAt(searchTag).endAt(searchTag + '\uf8ff').limitToFirst(20).once('value').then(function(snapshot) {
            var tags = snapshot.val();
            var results = [];
            var pending = 0;
            
            for (var tag in tags) {
                var userId = tags[tag];
                pending++;
                database.ref('users/' + userId).once('value').then(function(userSnap) {
                    var user = userSnap.val();
                    if (user) {
                        results.push({
                            uid: userId,
                            username: user.username,
                            userTag: user.userTag,
                            avatar: user.avatar,
                            inContacts: false
                        });
                    }
                    pending--;
                    if (pending === 0) {
                        resolve(results);
                    }
                });
            }
            
            if (pending === 0) {
                resolve(results);
            }
        }).catch(reject);
    });
}

function showGlobalSearch() {
    document.getElementById('global-search-modal').classList.remove('hidden');
    document.getElementById('global-search-input').value = '';
    document.getElementById('global-users-list').innerHTML = '<div>Введите @K-username для поиска</div>';
}

function searchGlobalUsers() {
    var query = document.getElementById('global-search-input').value.trim();
    var container = document.getElementById('global-users-list');
    
    if (query.length < 3) {
        container.innerHTML = '<div>Введите минимум 3 символа для поиска</div>';
        return;
    }
    
    container.innerHTML = '<div class="loading-spinner">🔍 Поиск...</div>';
    
    searchUsers(query).then(function(users) {
        container.innerHTML = '';
        if (users.length === 0) {
            container.innerHTML = '<div>Пользователи не найдены. Попробуйте другой @K-username</div>';
            return;
        }
        
        users.forEach(function(user) {
            var div = document.createElement('div');
            div.className = 'user-item';
            var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
            var avatarContent = user.avatar ? '' : '👤';
            div.innerHTML = `
                <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="user-item-info">
                    <h4>${escapeHtml(user.username)}</h4>
                    <p style="font-size:12px; color:var(--text-muted);">${escapeHtml(user.userTag)}</p>
                </div>
                <button class="add-contact-btn" onclick="addToContacts('${user.uid}', '${escapeHtml(user.username)}')">➕ Добавить</button>
            `;
            container.appendChild(div);
        });
    });
}

function addToContacts(uid, name) {
    database.ref('contacts/' + currentUser.uid + '/' + uid).set(true);
    database.ref('contactsReverse/' + uid + '/' + currentUser.uid).set(true);
    showNotification(name + ' добавлен в контакты', 'success');
    closeGlobalSearch();
    loadContacts(true);
}

// ========== ЗАГРУЗКА КОНТАКТОВ ИЗ БД ==========
var contactsCache = null;
var contactsCacheTime = 0;

function loadContacts(forceRefresh) {
    var now = Date.now();
    if (!forceRefresh && contactsCache && (now - contactsCacheTime) < 30000) {
        renderContactsList(contactsCache);
        return;
    }
    
    var list = document.getElementById('users-list');
    list.innerHTML = '<div class="loading-spinner">🔄 Загрузка контактов...</div>';
    
    database.ref('contacts/' + currentUser.uid).once('value').then(function(snapshot) {
        var contacts = snapshot.val();
        contactsCache = contacts;
        contactsCacheTime = Date.now();
        
        if (!contacts) {
            list.innerHTML = '<div>Нет контактов. Добавьте через поиск 🔍</div>';
            return;
        }
        
        var userIds = Object.keys(contacts);
        if (userIds.length === 0) {
            list.innerHTML = '<div>Нет контактов. Добавьте через поиск 🔍</div>';
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
                    div.setAttribute('data-username', (user.username || '').toLowerCase());
                    div.setAttribute('data-usertag', (user.userTag || '').toLowerCase());
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
                        return function() { startPrivateChat(uid, user); };
                    })(uid, user);
                    list.appendChild(div);
                }
                pending--;
                if (pending === 0 && list.children.length === 0) {
                    list.innerHTML = '<div>Нет доступных контактов</div>';
                }
            });
        });
    });
}

function renderContactsList(contacts) {
    var list = document.getElementById('users-list');
    if (!contacts) {
        list.innerHTML = '<div>Нет контактов</div>';
        return;
    }
    // Аналогично loadContacts но без повторной загрузки
    loadContacts(true);
}

// ========== ОБНОВЛЕНИЕ НАСТРОЕК (ЮЗЕРНЕЙМ И ТЭГ) ==========
function showEditProfileModal() {
    document.getElementById('edit-profile-modal').classList.remove('hidden');
    document.getElementById('edit-username').value = currentUserData?.username || '';
    document.getElementById('edit-usertag').value = (currentUserData?.userTag || '').replace('@K-', '');
    document.getElementById('edit-bio').value = currentUserData?.bio || '';
    
    var preview = document.getElementById('edit-avatar-preview');
    if (currentUserData?.avatar) {
        preview.style.backgroundImage = 'url(' + currentUserData.avatar + ')';
        preview.style.backgroundSize = 'cover';
        preview.textContent = '';
    } else {
        preview.style.backgroundImage = '';
        preview.textContent = '🥒';
    }
}

function saveProfile() {
    var newUsername = document.getElementById('edit-username').value.trim();
    var newUserTagRaw = document.getElementById('edit-usertag').value.trim().toLowerCase();
    var newBio = document.getElementById('edit-bio').value.trim();
    
    if (!newUsername) {
        showNotification('Введите отображаемое имя', 'error');
        return;
    }
    
    var updates = { username: newUsername, bio: newBio };
    
    // Если меняется юзернейм
    var oldUserTag = currentUserData.userTag;
    var newUserTag = '@K-' + newUserTagRaw.replace(/[^a-z0-9_]/g, '');
    
    function saveData(avatarUrl) {
        if (avatarUrl) updates.avatar = avatarUrl;
        
        if (newUserTag !== oldUserTag && newUserTagRaw.length >= 3) {
            // Проверяем уникальность нового тэга
            database.ref('userTags/' + newUserTag).once('value').then(function(snap) {
                if (snap.exists() && snap.val() !== currentUser.uid) {
                    showNotification('Юзернейм ' + newUserTag + ' уже занят', 'error');
                    return;
                }
                
                updates.userTag = newUserTag;
                return database.ref('users/' + currentUser.uid).update(updates);
            }).then(function() {
                if (newUserTag !== oldUserTag) {
                    return database.ref('userTags/' + oldUserTag).remove();
                }
            }).then(function() {
                if (newUserTag !== oldUserTag) {
                    return database.ref('userTags/' + newUserTag).set(currentUser.uid);
                }
            }).then(function() {
                closeEditProfileModal();
                showNotification('Профиль обновлён!', 'success');
                if (typeof updateUserDisplay === 'function') updateUserDisplay();
                loadUserData();
            }).catch(function(err) {
                showNotification('Ошибка: ' + err.message, 'error');
            });
        } else {
            database.ref('users/' + currentUser.uid).update(updates).then(function() {
                closeEditProfileModal();
                showNotification('Профиль обновлён!', 'success');
                if (typeof updateUserDisplay === 'function') updateUserDisplay();
                loadUserData();
            }).catch(function(err) {
                showNotification('Ошибка: ' + err.message, 'error');
            });
        }
    }
    
    if (window.pendingAvatarFile) {
        uploadToImgBB(window.pendingAvatarFile).then(function(url) {
            window.pendingAvatarFile = null;
            saveData(url);
        }).catch(function() {
            saveData(null);
        });
    } else {
        saveData(null);
    }
}

// ========== ОБНОВЛЕНИЕ HTML ==========
function updateAuthFormsHTML() {
    // Обновляем формы в index.html динамически (если нужно)
    var loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.innerHTML = `
            <h2>Вход</h2>
            <input type="tel" id="login-phone" placeholder="Номер телефона (+7...)" class="auth-input">
            <button onclick="sendLoginCode()" class="btn-primary">Отправить код</button>
            <p class="switch-form">Нет аккаунта? <a onclick="showRegisterScreen()">Регистрация</a></p>
            <p class="switch-form"><a onclick="showForgotPasswordScreen()">Забыли пароль?</a></p>
        `;
    }
    
    var registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.innerHTML = `
            <h2>Регистрация</h2>
            <input type="text" id="reg-username" placeholder="Отображаемое имя" class="auth-input">
            <input type="text" id="reg-usertag" placeholder="Юзернейм (латиница, цифры, _)" class="auth-input">
            <small style="display:block; margin:-5px 0 10px 5px; color:#6b8e6b;">Будет виден как @K-юзернейм</small>
            <input type="tel" id="reg-phone" placeholder="Номер телефона (+7...)" class="auth-input">
            <input type="password" id="reg-password" placeholder="Пароль (мин. 6 символов)" class="auth-input">
            <button onclick="startPhoneRegistration()" class="btn-primary">Зарегистрироваться</button>
            <p class="switch-form">Уже есть аккаунт? <a onclick="showLoginScreen()">Войти</a></p>
        `;
    }
    
    var forgotForm = document.getElementById('forgot-password-form');
    if (forgotForm) {
        forgotForm.innerHTML = `
            <h2>Восстановление пароля</h2>
            <input type="tel" id="reset-phone" placeholder="Номер телефона" class="auth-input">
            <button onclick="sendResetCode()" class="btn-primary">Отправить код</button>
            <p class="switch-form"><a onclick="showLoginScreen()">Вернуться ко входу</a></p>
        `;
    }
    
    var phoneVerifyForm = document.getElementById('phone-verification-form');
    if (phoneVerifyForm) {
        phoneVerifyForm.innerHTML = `
            <h2>Подтверждение номера</h2>
            <p>Код отправлен на <strong id="verification-phone"></strong></p>
            <input type="text" id="verification-code" placeholder="6-значный код" class="auth-input" maxlength="6">
            <button onclick="verifyCode()" class="btn-primary">Подтвердить</button>
            <p class="switch-form"><a onclick="showLoginScreen()">Назад</a></p>
        `;
    }
    
    var setPasswordForm = document.getElementById('set-password-form');
    if (setPasswordForm) {
        setPasswordForm.innerHTML = `
            <h2>Новый пароль</h2>
            <input type="password" id="new-password" placeholder="Новый пароль" class="auth-input">
            <input type="password" id="confirm-password" placeholder="Подтвердите пароль" class="auth-input">
            <button onclick="resetPassword()" class="btn-primary">Сохранить</button>
        `;
    }
    
    var linkPhoneForm = document.getElementById('link-phone-form');
    if (linkPhoneForm) {
        linkPhoneForm.innerHTML = `
            <h2>Привяжите номер телефона</h2>
            <p>Для поиска друзей по контактам привяжите номер</p>
            <input type="tel" id="link-phone-number" placeholder="Номер телефона" class="auth-input">
            <button onclick="sendLinkPhoneCode()" class="btn-primary">Отправить код</button>
            <button onclick="closeLinkPhoneModal()" class="btn-secondary">Пропустить</button>
        `;
    }
}

// ========== RECAPTCHA КОНТЕЙНЕР ==========
function addRecaptchaContainer() {
    if (!document.getElementById('recaptcha-container')) {
        var div = document.createElement('div');
        div.id = 'recaptcha-container';
        div.style.position = 'fixed';
        div.style.bottom = '10px';
        div.style.right = '10px';
        div.style.zIndex = '9999';
        document.body.appendChild(div);
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', function() {
    updateAuthFormsHTML();
    addRecaptchaContainer();
});

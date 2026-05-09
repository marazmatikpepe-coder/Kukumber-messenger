function showRegister() { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); }
function showLogin() { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); }

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-password-confirm').value;
    if (!username) { showNotification('Введите имя пользователя!', 'error'); return; }
    if (username.length < 3) { showNotification('Имя должно быть минимум 3 символа!', 'error'); return; }
    if (!email) { showNotification('Введите email!', 'error'); return; }
    if (!password) { showNotification('Введите пароль!', 'error'); return; }
    if (password.length < 6) { showNotification('Пароль минимум 6 символов!', 'error'); return; }
    if (password !== confirmPassword) { showNotification('Пароли не совпадают!', 'error'); return; }
    const btn = document.querySelector('#register-form .btn-primary');
    btn.disabled = true; btn.textContent = 'Создание...';
    try {
        const usernameSnapshot = await database.ref('usernames/' + username.toLowerCase()).once('value');
        if (usernameSnapshot.exists()) { showNotification('Имя пользователя уже занято!', 'error'); btn.disabled=false; btn.textContent='Создать аккаунт'; return; }
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        await database.ref('users/' + user.uid).set({
            username: username, email: email, phone: phone || '', avatar: '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: { online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP }
        });
        await database.ref('usernames/' + username.toLowerCase()).set(user.uid);
        showNotification('Регистрация успешна!', 'success');
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-phone').value = '';
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
    btn.disabled = false; btn.textContent = 'Создать аккаунт';
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email) { showNotification('Введите email!', 'error'); return; }
    if (!password) { showNotification('Введите пароль!', 'error'); return; }
    const btn = document.querySelector('#login-form .btn-primary');
    btn.disabled = true; btn.textContent = 'Вход...';
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
    btn.disabled = false; btn.textContent = 'Войти';
}

function logout() {
    if (!confirm('Вы уверены, что хотите выйти?')) return;
    if (messagesListener) messagesListener.off();
    auth.signOut().then(() => {
        currentUser = null; currentUserData = null; currentChatId = null; currentChatUser = null;
        showNotification('Вы вышли', 'info');
    }).catch(error => showNotification('Ошибка выхода', 'error'));
}
calls.js: // KUKUMBER MESSENGER - CALLS
var localStream = null;
var currentPeerConnection = null;
var callTimerInterval = null;
var callSecondsCount = 0;

var iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function initializePeer() {
    console.log('Готов к звонкам');
}

function startVoiceCall() { startCall(false); }
function startVideoCall() { startCall(true); }

function startCall(withVideo) {
    if (!currentChatId || !currentChatUser) {
        showNotification('Выберите чат', 'error');
        return;
    }
    if (currentChatUser.type !== 'private') {
        showNotification('Только личные чаты', 'info');
        return;
    }
    
    var otherUserId = currentChatUser.otherUserId;
    if (!otherUserId) {
        showNotification('Ошибка', 'error');
        return;
    }
    
    navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true })
        .then(stream => {
            localStream = stream;
            showCallModal(withVideo);
            document.getElementById('local-video').srcObject = localStream;
            document.getElementById('call-username').textContent = currentChatUser.otherUser?.username || 'Пользователь';
            document.getElementById('call-status').textContent = 'Соединение...';
            
            currentPeerConnection = new RTCPeerConnection(iceServers);
            localStream.getTracks().forEach(track => currentPeerConnection.addTrack(track, localStream));
            
            currentPeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    database.ref(`calls/${currentChatId}/candidates`).push({
                        to: otherUserId, candidate: event.candidate, from: currentUser.uid
                    });
                }
            };
            
            currentPeerConnection.ontrack = (event) => {
                document.getElementById('remote-video').srcObject = event.streams[0];
                document.getElementById('call-status').textContent = 'Подключено';
                startCallTimer();
            };
            
            currentPeerConnection.createOffer()
                .then(offer => currentPeerConnection.setLocalDescription(offer))
                .then(() => {
                    database.ref(`calls/${currentChatId}/offer`).set({
                        from: currentUser.uid, to: otherUserId, sdp: currentPeerConnection.localDescription
                    });
                });
            
            setupCallListeners(currentChatId, otherUserId);
        })
        .catch(err => { showNotification('Нет доступа к камере/микрофону', 'error'); endCall(); });
}

function setupCallListeners(chatId, otherUserId) {
    database.ref(`calls/${chatId}/answer`).on('value', snapshot => {
        var data = snapshot.val();
        if (data && data.from === otherUserId && currentPeerConnection) {
            currentPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
    });
    
    database.ref(`calls/${chatId}/candidates`).on('child_added', snapshot => {
        var data = snapshot.val();
        if (data && data.to === currentUser.uid && currentPeerConnection) {
            currentPeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
}

function acceptCall() {
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        .then(stream => {
            localStream = stream;
            showCallModal(false);
            document.getElementById('local-video').srcObject = localStream;
            document.getElementById('call-username').textContent = currentChatUser?.otherUser?.username || 'Пользователь';
            document.getElementById('call-status').textContent = 'Соединение...';
            
            currentPeerConnection = new RTCPeerConnection(iceServers);
            localStream.getTracks().forEach(track => currentPeerConnection.addTrack(track, localStream));
            
            currentPeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    database.ref(`calls/${currentChatId}/candidates`).push({
                        to: currentChatUser.otherUserId, candidate: event.candidate, from: currentUser.uid
                    });
                }
            };
            
            currentPeerConnection.ontrack = (event) => {
                document.getElementById('remote-video').srcObject = event.streams[0];
                document.getElementById('call-status').textContent = 'Подключено';
                startCallTimer();
            };
            
            database.ref(`calls/${currentChatId}/offer`).once('value', snapshot => {
                var offer = snapshot.val();
                if (offer) {
                    currentPeerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp))
                        .then(() => currentPeerConnection.createAnswer())
                        .then(answer => currentPeerConnection.setLocalDescription(answer))
                        .then(() => {
                            database.ref(`calls/${currentChatId}/answer`).set({
                                from: currentUser.uid, to: currentChatUser.otherUserId, sdp: currentPeerConnection.localDescription
                            });
                        });
                }
            });
            
            setupCallListeners(currentChatId, currentChatUser.otherUserId);
            document.getElementById('incoming-call-modal').classList.add('hidden');
            stopRingtone();
        });
}

function rejectCall() {
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
    endCall();
}

function toggleMute() {
    if (!localStream) return;
    var audio = localStream.getAudioTracks();
    if (audio.length) {
        var enabled = !audio[0].enabled;
        audio.forEach(t => t.enabled = enabled);
        var btn = document.getElementById('mute-btn');
        if (btn) {
            btn.textContent = enabled ? '🎤' : '🔇';
            btn.classList.toggle('muted', !enabled);
        }
    }
}

function toggleVideo() {
    if (!localStream) return;
    var video = localStream.getVideoTracks();
    if (video.length) {
        var enabled = !video[0].enabled;
        video.forEach(t => t.enabled = enabled);
        var btn = document.getElementById('video-btn');
        if (btn) {
            btn.textContent = enabled ? '📹' : '📷';
            btn.classList.toggle('muted', !enabled);
        }
    }
}

function endCall() {
    stopCallTimer();
    if (currentPeerConnection) currentPeerConnection.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (currentChatId) database.ref(`calls/${currentChatId}`).remove();
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
    document.getElementById('call-modal').classList.add('hidden');
}

function startCallTimer() {
    callSecondsCount = 0;
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        callSecondsCount++;
        var mins = Math.floor(callSecondsCount/60).toString().padStart(2,'0');
        var secs = (callSecondsCount%60).toString().padStart(2,'0');
        document.getElementById('call-timer').textContent = mins+':'+secs;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    document.getElementById('call-timer').textContent = '00:00';
}

function showCallModal(isVideo) {
    document.getElementById('call-modal').classList.remove('hidden');
    document.getElementById('video-btn').style.display = isVideo ? '' : 'none';
    document.getElementById('local-video').style.display = isVideo ? '' : 'none';
    document.getElementById('call-avatar').classList.toggle('hidden', isVideo);
}

var ringtoneInterval = null;
function playRingtone() {
    if (ringtoneInterval) return;
    ringtoneInterval = setInterval(() => {
        try {
            var ctx = new (window.AudioContext||window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 440;
            gain.gain.value = 0.2;
            osc.start();
            setTimeout(() => { osc.stop(); ctx.close(); }, 200);
        } catch(e) {}
    }, 1000);
}

function stopRingtone() {
    if (ringtoneInterval) clearInterval(ringtoneInterval);
    ringtoneInterval = null;
}
chat-profile.js: // CHAT PROFILE - профиль собеседника из чата
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
                    <button class="profile-tab-btn active" onclick="switchChatProfileTab('contacts', '${userId}')">👥 Контакты</b

// KUKUMBER MESSENGER - CALLS
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
// ========== НОВЫЕ ФУНКЦИИ ДЛЯ UI ==========
let isMuted = false;
let isSpeakerOn = false;
let isMinimized = false;

function minimizeCall() {
    isMinimized = true;
    document.getElementById('call-fullscreen').classList.add('hidden');
    document.getElementById('call-minimized').classList.remove('hidden');
}

function restoreCall() {
    isMinimized = false;
    document.getElementById('call-fullscreen').classList.remove('hidden');
    document.getElementById('call-minimized').classList.add('hidden');
}

function toggleCallMute() {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length) {
        isMuted = !isMuted;
        audioTracks.forEach(track => track.enabled = !isMuted);
        const micBtn = document.getElementById('call-mic-btn');
        if (isMuted) {
            micBtn.classList.add('muted');
        } else {
            micBtn.classList.remove('muted');
            // Анимация свечения при включении
            const glow = document.getElementById('call-glow');
            if (glow) {
                glow.style.animation = 'none';
                setTimeout(() => glow.style.animation = 'glowPulse 1.5s ease-out infinite', 10);
            }
        }
    }
}

function toggleSpeaker() {
    // Переключение на громкую связь
    const audioElements = document.querySelectorAll('audio, video');
    audioElements.forEach(el => {
        if (el.srcObject) {
            // В реальности нужно использовать audio output device
            console.log('Переключение динамика');
        }
    });
}

// Переопределяем showCallModal для нового UI
function showCallModal(isVideo) {
    document.getElementById('call-modal').classList.remove('hidden');
    document.getElementById('call-fullscreen').classList.remove('hidden');
    document.getElementById('call-minimized').classList.add('hidden');
    
    if (!isVideo) {
        document.getElementById('call-videos').classList.add('hidden');
        document.getElementById('call-avatar-container').classList.remove('hidden');
    } else {
        document.getElementById('call-videos').classList.remove('hidden');
        document.getElementById('call-avatar-container').classList.add('hidden');
    }
}

// Обновляем таймер
function startCallTimer() {
    callSecondsCount = 0;
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        callSecondsCount++;
        const mins = Math.floor(callSecondsCount/60).toString().padStart(2,'0');
        const secs = (callSecondsCount%60).toString().padStart(2,'0');
        const timeStr = `${mins}:${secs}`;
        document.getElementById('call-timer').textContent = timeStr;
        document.getElementById('minimized-timer').textContent = timeStr;
    }, 1000);
}

// Обновляем имя в свёрнутом окне
function updateCallName(name) {
    document.getElementById('call-username').textContent = name;
    document.getElementById('minimized-name').textContent = name;
}

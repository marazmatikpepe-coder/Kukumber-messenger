// ЕДИНЫЙ КЛЮЧ ДЛЯ ImgBB
var IMGBB_API_KEY = '03a5a914cba6f919ff317ebb6d9ed4f9';

// ========== ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ==========
async function uploadToImgBB(file) {
    var formData = new FormData();
    formData.append('image', file);
    
    var response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });
    
    var data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error?.message || 'Ошибка загрузки');
    }
    
    return data.data.url;
}

// ========== ГЛОБАЛЬНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ АВАТАРА ВО ВСЕХ МЕСТАХ ==========
function updateAvatarEverywhere(userId, avatarUrl, userName) {
    // 1. Профиль (открытое модальное окно)
    var profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) {
        profileAvatar.style.backgroundImage = 'url(' + avatarUrl + ')';
        profileAvatar.style.backgroundSize = 'cover';
        profileAvatar.textContent = '';
    }
    
    // 2. Боковая панель (свой профиль)
    if (userId === currentUser?.uid) {
        var userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
            userAvatar.style.backgroundImage = 'url(' + avatarUrl + ')';
            userAvatar.style.backgroundSize = 'cover';
            userAvatar.textContent = '';
        }
        
        var settingsAvatar = document.getElementById('settings-avatar');
        if (settingsAvatar) {
            settingsAvatar.style.backgroundImage = 'url(' + avatarUrl + ')';
            settingsAvatar.style.backgroundSize = 'cover';
            settingsAvatar.textContent = '';
        }
        
        var slicesAvatar = document.getElementById('slices-user-avatar');
        if (slicesAvatar) {
            slicesAvatar.style.backgroundImage = 'url(' + avatarUrl + ')';
            slicesAvatar.style.backgroundSize = 'cover';
            slicesAvatar.textContent = '';
        }
    }
    
    // 3. Все посты (Slices) этого пользователя в ленте
    var allCards = document.querySelectorAll('.slice-card');
    allCards.forEach(function(card) {
        var authorDiv = card.querySelector('.slice-author');
        if (authorDiv && authorDiv.getAttribute('onclick') && authorDiv.getAttribute('onclick').includes(userId)) {
            var avatarEl = authorDiv.querySelector('.avatar');
            if (avatarEl) {
                avatarEl.style.backgroundImage = 'url(' + avatarUrl + ')';
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.textContent = '';
            }
        }
    });
    
    // 4. Открытый чат
    if (currentChatUser && currentChatUser.otherUserId === userId) {
        var chatAvatar = document.getElementById('chat-avatar');
        if (chatAvatar) {
            chatAvatar.style.backgroundImage = 'url(' + avatarUrl + ')';
            chatAvatar.style.backgroundSize = 'cover';
            chatAvatar.textContent = '';
        }
    }
    
    // 5. Список чатов
    var chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(function(item) {
        var nameSpan = item.querySelector('.chat-item-name');
        if (nameSpan && nameSpan.textContent === (userName || window.viewingProfileUserName)) {
            var chatAvatarEl = item.querySelector('.avatar');
            if (chatAvatarEl && !chatAvatarEl.parentElement.querySelector('.chat-type-badge')) {
                chatAvatarEl.style.backgroundImage = 'url(' + avatarUrl + ')';
                chatAvatarEl.style.backgroundSize = 'cover';
                chatAvatarEl.textContent = '';
            }
        }
    });
    
    // 6. Список участников в чате
    var memberAvatars = document.querySelectorAll('.member-item .avatar');
    memberAvatars.forEach(function(avatar) {
        var parent = avatar.closest('.member-item');
        if (parent && parent.textContent.includes(userName || '')) {
            avatar.style.backgroundImage = 'url(' + avatarUrl + ')';
            avatar.style.backgroundSize = 'cover';
            avatar.textContent = '';
        }
    });
    
    // 7. Комментарии
    var commentAvatars = document.querySelectorAll('.comment-author-avatar');
    commentAvatars.forEach(function(avatar) {
        var parent = avatar.closest('.comment-item');
        if (parent && parent.querySelector('.comment-author-name')?.textContent === (userName || '')) {
            avatar.style.backgroundImage = 'url(' + avatarUrl + ')';
            avatar.style.backgroundSize = 'cover';
            avatar.textContent = '';
        }
    });
}

// ========== РЕДАКТИРОВАНИЕ АВАТАРА (СВОЙ ПРОФИЛЬ) ==========
async function editProfileAvatar() {
    var userId = window.viewingProfileUserId || currentUser?.uid;
    if (!userId) return;
    
    var isOwnProfile = (userId === currentUser?.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) {
        showNotification('Вы не можете редактировать чужой профиль', 'error');
        return;
    }
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        showNotification('Загрузка аватара...', 'info');
        
        try {
            var avatarUrl = await uploadToImgBB(file);
            
            await database.ref('users/' + userId + '/avatar').set(avatarUrl);
            
            showNotification('Аватар обновлён!', 'success');
            
            var userName = '';
            var userSnap = await database.ref('users/' + userId + '/username').once('value');
            userName = userSnap.val();
            
            updateAvatarEverywhere(userId, avatarUrl, userName);
            
            if (userId === currentUser?.uid && currentUserData) {
                currentUserData.avatar = avatarUrl;
            }
            if (window.viewingProfileUserData) {
                window.viewingProfileUserData.avatar = avatarUrl;
            }
            
            setTimeout(function() {
                openUserProfile(userId);
            }, 300);
            
        } catch (err) {
            console.error(err);
            showNotification('Ошибка загрузки: ' + err.message, 'error');
        }
    };
    input.click();
}

// ========== РЕДАКТИРОВАНИЕ БАННЕРА ==========
function editProfileBanner() {
    var userId = window.viewingProfileUserId || currentUser?.uid;
    if (!userId) return;
    
    var isOwnProfile = (userId === currentUser?.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) {
        showNotification('Вы не можете редактировать чужой профиль', 'error');
        return;
    }
    
    var colors = ['#228B22', '#556B2F', '#1a5c1a', '#32CD32', '#6b8e6b', '#000000', '#1E90FF', '#FFD700', '#FFA500', '#FF69B4', '#87CEEB', '#9370DB'];
    
    var oldColorModal = document.getElementById('color-picker-modal');
    if (oldColorModal) oldColorModal.remove();
    
    var modal = document.createElement('div');
    modal.id = 'color-picker-modal';
    modal.className = 'modal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px;">
            <div class="modal-header">
                <h3>Выберите баннер</h3>
                <button onclick="closeColorPickerModal()" class="btn-close">×</button>
            </div>
            <div class="banner-color-picker" style="display:flex; flex-wrap:wrap; gap:10px; padding:15px; justify-content:center;">
                ${colors.map(c => `<div class="banner-color-option" style="background:${c}; width:40px; height:40px; border-radius:50%; cursor:pointer; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="setProfileBanner('${c}')"></div>`).join('')}
            </div>
            <div style="padding:10px; text-align:center;">
                <button onclick="uploadProfileBannerImage()" class="btn-primary" style="width: auto; padding: 8px 20px;">📷 Загрузить картинку/GIF</button>
            </div>
            <div style="padding:10px; text-align:center;">
                <button onclick="setProfileBanner('')" class="btn-secondary">Сбросить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
}

function closeColorPickerModal() {
    var modal = document.getElementById('color-picker-modal');
    if (modal) modal.remove();
}

async function setProfileBanner(colorOrUrl) {
    var userId = window.viewingProfileUserId || currentUser?.uid;
    if (!userId) return;
    
    showNotification('Сохранение баннера...', 'info');
    
    try {
        var updateData = {};
        if (colorOrUrl) {
            updateData.banner = colorOrUrl;
        } else {
            updateData.banner = null;
        }
        
        await database.ref('users/' + userId).update(updateData);
        
        showNotification('Баннер обновлён', 'success');
        closeColorPickerModal();
        
        var bannerDiv = document.getElementById('profile-banner');
        if (bannerDiv) {
            if (colorOrUrl) {
                if (colorOrUrl.startsWith('#')) {
                    bannerDiv.style.background = colorOrUrl;
                    bannerDiv.style.backgroundImage = 'none';
                } else {
                    bannerDiv.style.backgroundImage = 'url(' + colorOrUrl + ')';
                    bannerDiv.style.backgroundSize = 'cover';
                    bannerDiv.style.backgroundPosition = 'center';
                    bannerDiv.style.background = 'none';
                }
            } else {
                bannerDiv.style.background = 'linear-gradient(135deg, #228B22, #556B2F)';
                bannerDiv.style.backgroundImage = 'none';
            }
        }
        
        if (window.viewingProfileUserData) {
            window.viewingProfileUserData.banner = colorOrUrl || null;
        }
        
    } catch (err) {
        console.error(err);
        showNotification('Ошибка: ' + err.message, 'error');
    }
}

async function uploadProfileBannerImage() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        showNotification('Загрузка баннера...', 'info');
        
        try {
            var url = await uploadToImgBB(file);
            await setProfileBanner(url);
        } catch (err) {
            showNotification('Ошибка загрузки: ' + err.message, 'error');
        }
    };
    input.click();
}

// ========== РЕДАКТИРОВАНИЕ АВАТАРА ЧЕРЕЗ НАСТРОЙКИ ==========
function previewEditAvatar(event) {
    var file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        window.pendingAvatarFile = file;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var preview = document.getElementById('edit-avatar-preview');
            if (preview) {
                preview.style.backgroundImage = 'url(' + ev.target.result + ')';
                preview.style.backgroundSize = 'cover';
                preview.textContent = '';
            }
        };
        reader.readAsDataURL(file);
    }
}

// ========== ГРУППЫ И КАНАЛЫ ==========
window.groupAvatarFile = null;
window.channelAvatarFile = null;

function previewGroupAvatar(e) {
    var file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        window.groupAvatarFile = file;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var preview = document.getElementById('group-avatar-preview');
            if (preview) {
                preview.style.backgroundImage = 'url(' + ev.target.result + ')';
                preview.style.backgroundSize = 'cover';
                preview.textContent = '';
            }
        };
        reader.readAsDataURL(file);
    }
}

function previewChannelAvatar(e) {
    var file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        window.channelAvatarFile = file;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var preview = document.getElementById('channel-avatar-preview');
            if (preview) {
                preview.style.backgroundImage = 'url(' + ev.target.result + ')';
                preview.style.backgroundSize = 'cover';
                preview.textContent = '';
            }
        };
        reader.readAsDataURL(file);
    }
}

// ========== ЗАГРУЗКА МЕДИА ДЛЯ ЧАТА ==========
var pendingImages = [];
var currentImageIndex = 0;
var pendingGifs = [];

function handleFileSelect(event) {
    var files = Array.from(event.target.files);
    if (!files.length) return;
    
    files.forEach(function(file) {
        var isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
        var isImage = file.type.startsWith('image/') && !isGif;
        
        // ВИДЕО ПРОСТО ИГНОРИРУЕМ
        if (file.type.startsWith('video/')) {
            showNotification('📹 Видео временно недоступно, отправьте фото или GIF', 'info');
            return;
        }
        
        if (isGif) {
            pendingGifs.push(file);
        } else if (isImage) {
            pendingImages.push({ file: file, caption: '' });
        } else {
            showNotification('Неподдерживаемый формат файла', 'error');
        }
    });
    
    if (pendingGifs.length) sendAllGifs();
    if (pendingImages.length) showImagePreview();
    
    event.target.value = '';
}
async function sendAllGifs() {
    if (pendingGifs.length === 0) return;
    if (!currentChatId) { 
        showNotification('Выберите чат', 'error'); 
        return; 
    }
    
    showNotification(`📤 Отправка ${pendingGifs.length} GIF...`, 'info');
    var successCount = 0;
    
    for (var i = 0; i < pendingGifs.length; i++) {
        try {
            var gifUrl = await uploadToImgBB(pendingGifs[i]);
            var message = {
                type: 'gif',
                gifUrl: gifUrl,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            await database.ref('messages/' + currentChatId).push(message);
            successCount++;
            await new Promise(r => setTimeout(r, 200));
        } catch (error) {
            console.error('Ошибка отправки GIF', error);
            showNotification(`❌ Ошибка: ${pendingGifs[i].name}`, 'error');
        }
    }
    
    if (successCount > 0) {
        var lastMsg = successCount === 1 ? '🎬 GIF' : `🎬 ${successCount} GIF`;
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification(`✅ ${successCount} GIF отправлено!`, 'success');
    }
    
    pendingGifs = [];
}

function showImagePreview() {
    if (pendingImages.length === 0) return;
    var modal = document.getElementById('image-preview-modal');
    if (!modal) return;
    
    var currentImage = pendingImages[currentImageIndex];
    var reader = new FileReader();
    
    reader.onload = function(e) {
        var previewImg = document.getElementById('preview-image');
        if (previewImg) previewImg.src = e.target.result;
        var captionInput = document.getElementById('image-caption');
        if (captionInput) captionInput.value = currentImage.caption || '';
        var counter = document.getElementById('image-counter');
        if (counter) counter.textContent = `${currentImageIndex + 1} / ${pendingImages.length}`;
        updateNavButtons();
    };
    
    reader.readAsDataURL(currentImage.file);
    modal.classList.remove('hidden');
}

function updateNavButtons() {
    var prevBtn = document.getElementById('nav-prev-btn');
    var nextBtn = document.getElementById('nav-next-btn');
    if (prevBtn) prevBtn.style.display = currentImageIndex > 0 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = currentImageIndex < pendingImages.length - 1 ? 'flex' : 'none';
}

function navigateImage(direction) {
    var newIndex = currentImageIndex + direction;
    if (newIndex >= 0 && newIndex < pendingImages.length) {
        var captionInput = document.getElementById('image-caption');
        if (captionInput && pendingImages[currentImageIndex]) {
            pendingImages[currentImageIndex].caption = captionInput.value;
        }
        currentImageIndex = newIndex;
        showImagePreview();
    }
}

function addMoreImages() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.type.startsWith('image/') && !file.type.includes('gif')) {
                if (file.size <= 10 * 1024 * 1024) {
                    pendingImages.push({ file: file, caption: '' });
                }
            }
        });
        if (pendingImages.length > 0) {
            currentImageIndex = pendingImages.length - 1;
            showImagePreview();
        }
    };
    input.click();
}

function closeImagePreview() {
    var modal = document.getElementById('image-preview-modal');
    if (modal) modal.classList.add('hidden');
}

function cancelAllImages() {
    pendingImages = [];
    currentImageIndex = 0;
    closeImagePreview();
}

async function confirmImageSend() {
    if (pendingImages.length === 0) { 
        showNotification('Нет фото для отправки', 'error'); 
        return; 
    }
    if (!currentChatId) { 
        showNotification('Выберите чат', 'error'); 
        return; 
    }
    
    var captionInput = document.getElementById('image-caption');
    var currentCaption = captionInput ? captionInput.value.trim() : '';
    
    showNotification(`📤 Отправка ${pendingImages.length} фото...`, 'info');
    var successCount = 0, failCount = 0;
    
    for (var i = 0; i < pendingImages.length; i++) {
        try {
            var imageUrl = await uploadToImgBB(pendingImages[i].file);
            
            var message = {
                type: 'image',
                imageUrl: imageUrl,
                caption: pendingImages[i].caption || currentCaption || '',
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            
            await database.ref('messages/' + currentChatId).push(message);
            successCount++;
            await new Promise(r => setTimeout(r, 300));
        } catch (error) {
            console.error('Ошибка отправки фото', i, error);
            failCount++;
        }
    }
    
    if (successCount > 0) {
        var lastMsg = successCount === 1 ? '📷 Фото' : `📷 ${successCount} фото`;
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    showNotification(failCount === 0 ? `✅ Все ${successCount} фото отправлены!` : `✅ Отправлено: ${successCount}, ошибок: ${failCount}`, failCount === 0 ? 'success' : 'info');
    
    pendingImages = [];
    currentImageIndex = 0;
    closeImagePreview();
}

// ========== ОТПРАВКА ФАЙЛОВ ==========
async function sendAnyFile(file) {
    if (!currentChatId) { 
        showNotification('Ошибка: чат не выбран', 'error'); 
        return; 
    }
    showNotification('📤 Загрузка...', 'info');
    
    try {
        var url = await uploadToImgBB(file);
        var message = {
            type: 'file',
            fileName: file.name,
            fileUrl: url,
            fileSize: file.size,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        await database.ref('messages/' + currentChatId).push(message);
        await database.ref('chats/' + currentChatId).update({
            lastMessage: '📎 ' + file.name,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification('✅ Файл отправлен!', 'success');
    } catch (error) {
        console.error(error);
        showNotification('❌ Ошибка загрузки', 'error');
    }
}

// ========== ГОЛОСОВЫЕ СООБЩЕНИЯ (КРАСИВЫЙ ИНТЕРФЕЙС + ХРАНЕНИЕ В FIREBASE) ==========

var voiceState = {
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    isPaused: false,
    startTime: null,
    pausedTime: 0,
    totalPaused: 0,
    audioBlob: null,
    audioUrl: null,
    animationId: null,
    audioContext: null,
    analyser: null,
    source: null,
    stream: null,
    timerInterval: null
};

// Сохраняем голосовое в Firebase как base64
async function saveVoiceToFirebase(blob, duration) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onloadend = function() {
            var base64 = reader.result;
            var voiceId = 'voice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            
            database.ref('voiceMessages/' + voiceId).set({
                data: base64,
                duration: duration,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                senderId: currentUser.uid
            }).then(() => {
                resolve(voiceId);
            }).catch(reject);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Получить голосовое из Firebase
window.getVoiceUrl = function(voiceId) {
    return `#voice_${voiceId}`;
};

// Показать панель записи
function showRecordingPanel() {
    var inputArea = document.querySelector('.message-input-area');
    if (!inputArea) return;
    
    var originalContent = inputArea.innerHTML;
    inputArea.setAttribute('data-original', originalContent);
    
    inputArea.innerHTML = `
        <div class="voice-recording-panel" style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px; background: #1a1a1a; padding: 8px 16px; border-radius: 30px;">
            <div class="voice-timer" style="font-family: monospace; font-size: 16px; font-weight: 600; color: #32CD32; min-width: 50px;">0:00</div>
            <div class="voice-waveform" style="flex: 1; display: flex; align-items: center; gap: 3px; height: 40px; justify-content: center;"></div>
            <button class="voice-stop-btn" style="background: #ff4444; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <span style="width: 16px; height: 16px; background: white; border-radius: 2px;"></span>
            </button>
        </div>
    `;
    
    var stopBtn = inputArea.querySelector('.voice-stop-btn');
    if (stopBtn) stopBtn.onclick = stopRecordingAndShowPreview;
    
    voiceState.waveformBars = [];
    startWaveformVisualization();
}

// Визуализация звука
function startWaveformVisualization() {
    if (!voiceState.analyser) return;
    
    var dataArray = new Uint8Array(voiceState.analyser.frequencyBinCount);
    var container = document.querySelector('.voice-waveform');
    if (!container) return;
    
    function draw() {
        if (!voiceState.isRecording || voiceState.isPaused) {
            if (voiceState.animationId) cancelAnimationFrame(voiceState.animationId);
            return;
        }
        
        voiceState.analyser.getByteFrequencyData(dataArray);
        
        var sum = 0;
        for (var i = 0; i < dataArray.length; i++) sum += dataArray[i];
        var avg = sum / dataArray.length;
        var level = Math.min(1, avg / 128);
        
        var barsCount = 25;
        if (voiceState.waveformBars.length === 0) {
            container.innerHTML = '';
            for (var i = 0; i < barsCount; i++) {
                var bar = document.createElement('div');
                bar.style.cssText = 'width: 4px; background: #32CD32; border-radius: 3px; transition: height 0.05s;';
                container.appendChild(bar);
                voiceState.waveformBars.push(bar);
            }
        }
        
        for (var i = 0; i < voiceState.waveformBars.length; i++) {
            var randomFactor = 0.4 + Math.random() * 0.8;
            var height = Math.max(4, Math.min(45, 4 + level * 45 * randomFactor));
            voiceState.waveformBars[i].style.height = height + 'px';
        }
        
        voiceState.animationId = requestAnimationFrame(draw);
    }
    
    draw();
}

// Остановить запись и показать предпросмотр
function stopRecordingAndShowPreview() {
    if (voiceState.mediaRecorder && voiceState.mediaRecorder.state === 'recording') {
        voiceState.mediaRecorder.stop();
    }
    voiceState.isRecording = false;
    
    if (voiceState.timerInterval) {
        clearInterval(voiceState.timerInterval);
        voiceState.timerInterval = null;
    }
    if (voiceState.animationId) {
        cancelAnimationFrame(voiceState.animationId);
        voiceState.animationId = null;
    }
    
    showPreviewPanel();
}

// Показать панель предпросмотра
function showPreviewPanel() {
    var inputArea = document.querySelector('.message-input-area');
    if (!inputArea) return;
    
    var duration = voiceState.totalDuration;
    var minutes = Math.floor(duration / 60);
    var seconds = duration % 60;
    var timeStr = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds} сек`;
    
    inputArea.innerHTML = `
        <div class="voice-preview-panel" style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px; background: var(--background); padding: 8px 16px; border-radius: 30px;">
            <button class="voice-delete-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #ff4444;">🗑️</button>
            <button class="voice-play-pause-btn" style="background: var(--forest); border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <span style="font-size: 20px; color: white;">▶️</span>
            </button>
            <div style="flex: 1; text-align: center; font-size: 14px; color: var(--text-dark);">🎤 Голосовое · ${timeStr}</div>
            <button class="voice-send-btn" style="background: var(--forest); border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </button>
        </div>
    `;
    
    var deleteBtn = inputArea.querySelector('.voice-delete-btn');
    var playPauseBtn = inputArea.querySelector('.voice-play-pause-btn');
    var sendBtn = inputArea.querySelector('.voice-send-btn');
    
    if (deleteBtn) deleteBtn.onclick = cancelVoiceRecording;
    if (playPauseBtn) playPauseBtn.onclick = toggleVoicePlayback;
    if (sendBtn) sendBtn.onclick = sendVoiceMessageToFirebase;
    
    if (voiceState.audioBlob) {
        if (voiceState.audioUrl) URL.revokeObjectURL(voiceState.audioUrl);
        voiceState.audioUrl = URL.createObjectURL(voiceState.audioBlob);
    }
}

// Восстановить строку ввода
function restoreInputArea() {
    var inputArea = document.querySelector('.message-input-area');
    if (!inputArea) return;
    
    if (voiceState.audioPreview) {
        voiceState.audioPreview.pause();
        voiceState.audioPreview = null;
    }
    
    if (voiceState.audioContext) {
        voiceState.audioContext.close();
        voiceState.audioContext = null;
    }
    
    if (voiceState.stream) {
        voiceState.stream.getTracks().forEach(track => track.stop());
        voiceState.stream = null;
    }
    
    var original = inputArea.getAttribute('data-original');
    if (original) inputArea.innerHTML = original;
}

// Отмена записи
function cancelVoiceRecording() {
    if (voiceState.audioUrl) {
        URL.revokeObjectURL(voiceState.audioUrl);
        voiceState.audioUrl = null;
    }
    voiceState.audioBlob = null;
    voiceState.audioChunks = [];
    voiceState.totalDuration = 0;
    restoreInputArea();
}

// Воспроизведение в предпросмотре
function toggleVoicePlayback() {
    var btn = document.querySelector('.voice-play-pause-btn span');
    if (!voiceState.audioPreview) {
        voiceState.audioPreview = new Audio(voiceState.audioUrl);
        voiceState.audioPreview.onended = function() {
            var playBtn = document.querySelector('.voice-play-pause-btn span');
            if (playBtn) playBtn.textContent = '▶️';
            voiceState.audioPreview = null;
        };
        voiceState.audioPreview.play();
        if (btn) btn.textContent = '⏸️';
    } else if (voiceState.audioPreview.paused) {
        voiceState.audioPreview.play();
        if (btn) btn.textContent = '⏸️';
    } else {
        voiceState.audioPreview.pause();
        if (btn) btn.textContent = '▶️';
    }
}

// Отправка голосового через Firebase
async function sendVoiceMessageToFirebase() {
    if (!voiceState.audioBlob) return;
    if (!window.currentChatId) {
        showNotification('Выберите чат', 'error');
        return;
    }
    
    showNotification('📤 Отправка голосового...', 'info');
    
    try {
        var voiceId = await saveVoiceToFirebase(voiceState.audioBlob, voiceState.totalDuration);
        
        await database.ref('messages/' + window.currentChatId).push({
            type: 'audio',
            voiceId: voiceId,
            duration: voiceState.totalDuration,
            senderId: window.currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await database.ref('chats/' + window.currentChatId).update({
            lastMessage: `🎤 Голосовое (${voiceState.totalDuration} сек)`,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        showNotification('✅ Голосовое отправлено!', 'success');
        
        if (voiceState.audioUrl) URL.revokeObjectURL(voiceState.audioUrl);
        voiceState.audioBlob = null;
        restoreInputArea();
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('❌ Ошибка отправки', 'error');
    }
}

// Начать запись
window.startVoiceRecording = async function() {
    if (voiceState.isRecording || voiceState.audioBlob) return;
    if (!window.currentChatId) {
        showNotification('Сначала выберите чат', 'error');
        return;
    }
    
    try {
        voiceState.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        voiceState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        voiceState.analyser = voiceState.audioContext.createAnalyser();
        voiceState.source = voiceState.audioContext.createMediaStreamSource(voiceState.stream);
        voiceState.source.connect(voiceState.analyser);
        voiceState.analyser.fftSize = 256;
        
        voiceState.mediaRecorder = new MediaRecorder(voiceState.stream);
        voiceState.audioChunks = [];
        voiceState.startTime = Date.now();
        voiceState.totalPaused = 0;
        voiceState.isRecording = true;
        voiceState.isPaused = false;
        
        voiceState.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) voiceState.audioChunks.push(e.data);
        };
        
        voiceState.mediaRecorder.onstop = () => {
            voiceState.audioBlob = new Blob(voiceState.audioChunks, { type: 'audio/webm' });
            voiceState.totalDuration = Math.floor((Date.now() - voiceState.startTime - voiceState.totalPaused) / 1000);
            voiceState.audioChunks = [];
            voiceState.isRecording = false;
        };
        
        voiceState.mediaRecorder.start(100);
        
        showRecordingPanel();
        
        var startTimer = Date.now();
        voiceState.timerInterval = setInterval(function() {
            if (!voiceState.isRecording && !voiceState.isPaused) {
                clearInterval(voiceState.timerInterval);
                return;
            }
            var elapsed = Math.floor((Date.now() - startTimer - voiceState.totalPaused) / 1000);
            var minutes = Math.floor(elapsed / 60);
            var seconds = elapsed % 60;
            var timerDiv = document.querySelector('.voice-timer');
            if (timerDiv) timerDiv.textContent = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `0:${seconds.toString().padStart(2, '0')}`;
        }, 100);
        
        const btn = document.getElementById('voice-record-btn');
        if (btn) {
            btn.style.background = '#dc3545';
            btn.innerHTML = '⏹️';
        }
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('Нет доступа к микрофону', 'error');
    }
};

// Остановить запись
window.stopVoiceRecording = function() {
    if (!voiceState.isRecording) return;
    if (voiceState.mediaRecorder && voiceState.mediaRecorder.state === 'recording') {
        voiceState.mediaRecorder.stop();
    }
    
    const btn = document.getElementById('voice-record-btn');
    if (btn) {
        btn.style.background = '';
        btn.innerHTML = '🎤';
    }
};

// Инициализация кнопки
function initVoiceButton() {
    const btn = document.getElementById('voice-record-btn');
    if (!btn) return;
    
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('mousedown', function(e) {
        e.preventDefault();
        window.startVoiceRecording();
    });
    
    newBtn.addEventListener('mouseup', function(e) {
        e.preventDefault();
        window.stopVoiceRecording();
    });
    
    newBtn.addEventListener('mouseleave', function(e) {
        e.preventDefault();
        window.stopVoiceRecording();
    });
    
    newBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        window.startVoiceRecording();
    });
    
    newBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        window.stopVoiceRecording();
    });
}

setTimeout(initVoiceButton, 1000);

console.log('✅ Голосовые сообщения с красивым интерфейсом настроены! Хранение в Firebase');

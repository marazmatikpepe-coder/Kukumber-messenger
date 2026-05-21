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

// ========== ГОЛОСОВЫЕ СООБЩЕНИЯ ==========
if (typeof window.voiceRecorderLoaded === 'undefined') {
    window.voiceRecorderLoaded = true;
    
    const IA_ACCESS_KEY = 'NvSNcWy5BiOXcDk2';
    const IA_SECRET_KEY = '1Katd89Oa7Xk49P3';
    
    window.voiceMediaRecorder = null;
    window.voiceAudioChunks = [];
    window.isVoiceRecording = false;
    
    async function uploadAudioToArchive(file, fileName) {
        const itemId = `kukumber_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const uploadUrl = `https://s3.us.archive.org/${itemId}/${fileName}`;
        const authBase64 = btoa(`${IA_ACCESS_KEY}:${IA_SECRET_KEY}`);
        
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `LOW ${authBase64}`,
                'x-amz-auto-make-bucket': '1',
                'x-archive-meta-mediatype': 'audio',
                'Content-Type': 'audio/webm'
            },
            body: file
        });
        
        if (!response.ok) throw new Error(`Ошибка: ${response.status}`);
        return `https://archive.org/download/${itemId}/${fileName}`;
    }
    
    window.startVoiceRecording = async function() {
        if (window.isVoiceRecording) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            window.voiceMediaRecorder = new MediaRecorder(stream);
            window.voiceAudioChunks = [];
            const startTime = Date.now();
            
            window.voiceMediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) window.voiceAudioChunks.push(e.data);
            };
            
            window.voiceMediaRecorder.onstop = async () => {
                const blob = new Blob(window.voiceAudioChunks, { type: 'audio/webm' });
                const duration = Math.floor((Date.now() - startTime) / 1000);
                stream.getTracks().forEach(t => t.stop());
                
                if (duration >= 1 && blob.size > 0) {
                    const url = await uploadAudioToArchive(blob, `voice_${Date.now()}.webm`);
                    await database.ref('messages/' + currentChatId).push({
                        type: 'audio', audioUrl: url, duration: duration,
                        senderId: currentUser.uid, timestamp: firebase.database.ServerValue.TIMESTAMP
                    });
                    await database.ref('chats/' + currentChatId).update({
                        lastMessage: `🎤 Голосовое (${duration} сек)`,
                        lastMessageTime: firebase.database.ServerValue.TIMESTAMP
                    });
                    showNotification('✅ Голосовое отправлено!', 'success');
                }
                window.voiceAudioChunks = [];
            };
            
            window.voiceMediaRecorder.start(100);
            window.isVoiceRecording = true;
            document.getElementById('voice-record-btn').style.background = '#dc3545';
            showNotification('🎙️ Запись... Отпустите кнопку для отправки', 'info');
            
        } catch(e) { showNotification('Нет доступа к микрофону', 'error'); }
    };
    
    window.stopVoiceRecording = function() {
        if (!window.isVoiceRecording) return;
        window.voiceMediaRecorder?.stop();
        window.isVoiceRecording = false;
        document.getElementById('voice-record-btn').style.background = '';
    };
    
    function initVoiceBtn() {
        const btn = document.getElementById('voice-record-btn');
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); window.startVoiceRecording(); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); window.stopVoiceRecording(); });
        btn.addEventListener('mousedown', window.startVoiceRecording);
        btn.addEventListener('mouseup', window.stopVoiceRecording);
        btn.addEventListener('mouseleave', window.stopVoiceRecording);
    }
    
    document.addEventListener('DOMContentLoaded', initVoiceBtn);
    setTimeout(initVoiceBtn, 1000);
}
// ========== ОТПРАВКА ВИДЕО (ЧЕРЕЗ GOFILE.IO) ==========

window.uploadVideoToGoFile = async function(file) {
    try {
        console.log('Загрузка видео на GoFile:', file.name, 'Размер:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        
        // Сначала получаем сервер
        var serverResponse = await fetch('https://api.gofile.io/servers');
        var serverData = await serverResponse.json();
        
        if (!serverData.status === 'ok') {
            throw new Error('Не удалось получить сервер');
        }
        
        var server = serverData.data.servers[0].name;
        
        // Загружаем файл
        var formData = new FormData();
        formData.append('file', file);
        
        var uploadResponse = await fetch(`https://${server}.gofile.io/uploadFile`, {
            method: 'POST',
            body: formData
        });
        
        var uploadData = await uploadResponse.json();
        console.log('Ответ GoFile:', uploadData);
        
        if (uploadData.status === 'ok') {
            // Получаем прямую ссылку
            var fileId = uploadData.data.fileId;
            var directUrl = `https://${server}.gofile.io/download/${fileId}/${encodeURIComponent(file.name)}`;
            return directUrl;
        } else {
            throw new Error(uploadData.status || 'Ошибка загрузки');
        }
        
    } catch (error) {
        console.error('Ошибка загрузки на GoFile:', error);
        throw new Error('Не удалось загрузить видео: ' + error.message);
    }
};

// Обновляем confirmVideoSend для использования GoFile
async function confirmVideoSend() {
    if (pendingVideos.length === 0) {
        showNotification('Нет видео для отправки', 'error');
        return;
    }
    if (!window.currentChatId) {
        showNotification('Выберите чат', 'error');
        return;
    }
    
    var captionInput = document.getElementById('video-caption');
    var currentCaption = captionInput ? captionInput.value.trim() : '';
    
    if (pendingVideos[currentVideoIndex]) {
        pendingVideos[currentVideoIndex].caption = currentCaption;
    }
    
    showNotification(`📤 Отправка ${pendingVideos.length} видео...`, 'info');
    var successCount = 0;
    var failCount = 0;
    
    for (var i = 0; i < pendingVideos.length; i++) {
        try {
            var video = pendingVideos[i];
            
            if (video.file.size > 500 * 1024 * 1024) {
                throw new Error('Видео больше 500MB');
            }
            
            showNotification(`Загрузка видео ${i+1}/${pendingVideos.length}...`, 'info');
            
            var videoUrl = await window.uploadVideoToGoFile(video.file);
            
            var message = {
                type: 'video',
                videoUrl: videoUrl,
                caption: video.caption || '',
                fileName: video.file.name,
                senderId: window.currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            
            await database.ref('messages/' + window.currentChatId).push(message);
            successCount++;
            await new Promise(r => setTimeout(r, 300));
            
        } catch (error) {
            console.error('Ошибка отправки видео', i, error);
            failCount++;
        }
    }
    
    if (successCount > 0) {
        var lastMsg = successCount === 1 ? '🎬 Видео' : `🎬 ${successCount} видео`;
        await database.ref('chats/' + window.currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    if (failCount > 0) {
        showNotification(`✅ Отправлено: ${successCount}, ❌ Ошибок: ${failCount}`, 'info');
    } else {
        showNotification(`✅ Все ${successCount} видео отправлены!`, 'success');
    }
    
    pendingVideos = [];
    currentVideoIndex = 0;
    closeVideoPreview();
}

// Функция для теста
window.testVideoUpload = async function() {
    // Создаём тестовый маленький файл
    var blob = new Blob(['test'], { type: 'text/plain' });
    var testFile = new File([blob], 'test.txt', { type: 'text/plain' });
    
    console.log('Тестовый файл создан');
    
    try {
        var url = await window.uploadVideoToGoFile(testFile);
        console.log('Успешно! URL:', url);
        showNotification('Тест успешен!', 'success');
        return url;
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('Ошибка: ' + err.message, 'error');
        return null;
    }
};

console.log('✅ Видео-функционал переключен на GoFile.io');
console.log('Для теста введите testVideoUpload()');
// ========== ВИДЕО - ОБЪЯВЛЕНИЕ ПЕРЕМЕННЫХ И ФУНКЦИЙ ==========

// Объявляем глобальные переменные для видео
window.pendingVideos = window.pendingVideos || [];
window.currentVideoIndex = window.currentVideoIndex || 0;

// Функция добавления видео в предпросмотр
window.addVideoForPreview = function(file) {
    if (!file.type.startsWith('video/')) return false;
    
    if (file.size > 200 * 1024 * 1024) {
        if (typeof showNotification === 'function') {
            showNotification('Видео не более 200MB', 'error');
        }
        return false;
    }
    
    window.pendingVideos.push({ file: file, caption: '' });
    console.log('Видео добавлено в очередь:', file.name, 'Всего:', window.pendingVideos.length);
    return true;
};

// Показать предпросмотр видео
window.showVideoPreview = function() {
    if (!window.pendingVideos || window.pendingVideos.length === 0) return;
    
    // Удаляем старую модалку если есть
    var oldModal = document.getElementById('video-preview-modal');
    if (oldModal) oldModal.remove();
    
    var modalHtml = `
        <div id="video-preview-modal" class="modal" style="z-index: 10010;">
            <div class="image-preview-container" style="max-width: 500px; width: 90%; border-radius: 20px; overflow: hidden; background: white; margin: auto;">
                <div class="modal-header" style="padding: 12px 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px;">🎬 Отправка видео (<span id="video-counter">0/0</span>)</h3>
                    <button onclick="window.closeVideoPreview()" class="btn-close" style="font-size: 24px;">×</button>
                </div>
                <div style="position: relative; background: #000; min-height: 250px; display: flex; align-items: center; justify-content: center;">
                    <video id="preview-video" controls style="max-width: 100%; max-height: 400px; width: auto; height: auto;"></video>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px;">
                    <button id="video-prev-btn" style="background: none; border: none; font-size: 32px; cursor: pointer; color: var(--forest); display: none;">←</button>
                    <img src="https://i.ibb.co/BVhBTnmS/11623-AE3-5-A11-48-F3-9-C9-F-95-AF1-CD6-AAE4.png" alt="Добавить видео" onclick="window.addMoreVideos()" style="width: 50px; height: 50px; cursor: pointer;">
                    <button id="video-next-btn" style="background: none; border: none; font-size: 32px; cursor: pointer; color: var(--forest); display: none;">→</button>
                </div>
                <div style="padding: 10px 20px 20px;">
                    <div style="display: flex; align-items: center; background: #f5f5f5; border-radius: 24px; padding: 5px 15px;">
                        <input type="text" id="video-caption" placeholder="Добавить подпись к видео..." style="flex: 1; background: transparent; border: none; padding: 12px 0; font-size: 14px; outline: none;">
                        <button onclick="window.confirmVideoSend()" style="background: #228B22; border: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; padding: 0 20px 20px;">
                    <button onclick="window.cancelAllVideos()" class="btn-secondary" style="flex: 1; padding: 10px;">❌ Отмена</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    var currentVideo = window.pendingVideos[window.currentVideoIndex];
    var previewVideo = document.getElementById('preview-video');
    var captionInput = document.getElementById('video-caption');
    var counter = document.getElementById('video-counter');
    
    if (previewVideo && currentVideo) {
        var url = URL.createObjectURL(currentVideo.file);
        previewVideo.src = url;
        previewVideo.load();
    }
    
    if (captionInput) captionInput.value = currentVideo.caption || '';
    if (counter) counter.textContent = `${window.currentVideoIndex + 1} / ${window.pendingVideos.length}`;
    
    window.updateVideoNavButtons();
};

window.updateVideoNavButtons = function() {
    var prevBtn = document.getElementById('video-prev-btn');
    var nextBtn = document.getElementById('video-next-btn');
    if (prevBtn) prevBtn.style.display = window.currentVideoIndex > 0 ? 'inline-block' : 'none';
    if (nextBtn) nextBtn.style.display = window.currentVideoIndex < window.pendingVideos.length - 1 ? 'inline-block' : 'none';
    
    // Привязываем события
    if (prevBtn) prevBtn.onclick = function() { window.navigateVideo(-1); };
    if (nextBtn) nextBtn.onclick = function() { window.navigateVideo(1); };
};

window.navigateVideo = function(direction) {
    var newIndex = window.currentVideoIndex + direction;
    if (newIndex >= 0 && newIndex < window.pendingVideos.length) {
        var captionInput = document.getElementById('video-caption');
        if (captionInput && window.pendingVideos[window.currentVideoIndex]) {
            window.pendingVideos[window.currentVideoIndex].caption = captionInput.value;
        }
        window.currentVideoIndex = newIndex;
        window.showVideoPreview();
    }
};

window.addMoreVideos = function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(function(file) {
            if (file.type.startsWith('video/')) {
                if (file.size <= 200 * 1024 * 1024) {
                    window.pendingVideos.push({ file: file, caption: '' });
                } else if (typeof showNotification === 'function') {
                    showNotification('Видео ' + file.name + ' больше 200MB', 'error');
                }
            }
        });
        if (window.pendingVideos.length > 0) {
            window.currentVideoIndex = window.pendingVideos.length - 1;
            window.showVideoPreview();
        }
    };
    input.click();
};

window.cancelAllVideos = function() {
    window.pendingVideos = [];
    window.currentVideoIndex = 0;
    window.closeVideoPreview();
};

window.closeVideoPreview = function() {
    var modal = document.getElementById('video-preview-modal');
    if (modal) modal.remove();
    var previewVideo = document.getElementById('preview-video');
    if (previewVideo) previewVideo.src = '';
};

// Простая загрузка видео через ImgBB (для маленьких видео)
window.uploadVideoToImgBB = async function(file) {
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
};

// Отправка видео (упрощённая версия)
window.confirmVideoSend = async function() {
    if (!window.pendingVideos || window.pendingVideos.length === 0) {
        if (typeof showNotification === 'function') showNotification('Нет видео для отправки', 'error');
        return;
    }
    if (!window.currentChatId) {
        if (typeof showNotification === 'function') showNotification('Выберите чат', 'error');
        return;
    }
    
    var captionInput = document.getElementById('video-caption');
    var currentCaption = captionInput ? captionInput.value.trim() : '';
    
    if (window.pendingVideos[window.currentVideoIndex]) {
        window.pendingVideos[window.currentVideoIndex].caption = currentCaption;
    }
    
    if (typeof showNotification === 'function') {
        showNotification(`📤 Отправка ${window.pendingVideos.length} видео...`, 'info');
    }
    
    var successCount = 0;
    var failCount = 0;
    
    for (var i = 0; i < window.pendingVideos.length; i++) {
        try {
            var video = window.pendingVideos[i];
            
            if (typeof showNotification === 'function') {
                showNotification(`Загрузка видео ${i+1}/${window.pendingVideos.length}...`, 'info');
            }
            
            // Пробуем загрузить через ImgBB (поддерживает видео до 32MB)
            var videoUrl = await window.uploadVideoToImgBB(video.file);
            
            var message = {
                type: 'video',
                videoUrl: videoUrl,
                caption: video.caption || '',
                fileName: video.file.name,
                senderId: window.currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            
            await database.ref('messages/' + window.currentChatId).push(message);
            successCount++;
            await new Promise(r => setTimeout(r, 300));
            
        } catch (error) {
            console.error('Ошибка отправки видео', i, error);
            failCount++;
        }
    }
    
    if (successCount > 0) {
        var lastMsg = successCount === 1 ? '🎬 Видео' : `🎬 ${successCount} видео`;
        await database.ref('chats/' + window.currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    if (typeof showNotification === 'function') {
        if (failCount > 0) {
            showNotification(`✅ Отправлено: ${successCount}, ❌ Ошибок: ${failCount}`, 'info');
        } else {
            showNotification(`✅ Все ${successCount} видео отправлены!`, 'success');
        }
    }
    
    window.pendingVideos = [];
    window.currentVideoIndex = 0;
    window.closeVideoPreview();
};

// Переопределяем handleFileSelect для поддержки видео
if (typeof window.handleFileSelect !== 'undefined') {
    var originalHandleFileSelect = window.handleFileSelect;
    window.handleFileSelect = function(event) {
        var files = Array.from(event.target.files);
        if (!files.length) return;
        
        var hasImages = false;
        var hasVideos = false;
        var hasGifs = false;
        
        files.forEach(function(file) {
            var isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
            var isVideo = file.type.startsWith('video/');
            var isImage = file.type.startsWith('image/') && !isGif;
            
            if (isVideo) {
                window.addVideoForPreview(file);
                hasVideos = true;
            } else if (isGif) {
                if (!window.pendingGifs) window.pendingGifs = [];
                window.pendingGifs.push(file);
                hasGifs = true;
            } else if (isImage) {
                if (!window.pendingImages) window.pendingImages = [];
                window.pendingImages.push({ file: file, caption: '' });
                hasImages = true;
            }
        });
        
        if (hasVideos && window.pendingVideos && window.pendingVideos.length > 0) {
            window.showVideoPreview();
        } else if (hasImages && window.pendingImages && window.pendingImages.length > 0) {
            if (typeof window.showImagePreview === 'function') {
                window.showImagePreview();
            }
        } else if (hasGifs && window.pendingGifs && window.pendingGifs.length > 0) {
            if (typeof window.sendAllGifs === 'function') {
                window.sendAllGifs();
            }
        }
        
        event.target.value = '';
    };
}

console.log('✅ Видео-функционал полностью настроен!');
console.log('Теперь при выборе видео должно открываться окно предпросмотра');
// ========== ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ОТПРАВКА ВИДЕО ==========

// Удаляем старую функцию sendVideoMessage если она есть
if (typeof window.sendVideoMessage === 'function') {
    window.sendVideoMessage = null;
}

// Переменные для видео
window.pendingVideos = window.pendingVideos || [];
window.currentVideoIndex = 0;

// Функция добавления видео
window.addVideoForPreview = function(file) {
    if (!file.type.startsWith('video/')) return false;
    if (file.size > 100 * 1024 * 1024) {
        showNotification('Видео не более 100MB', 'error');
        return false;
    }
    window.pendingVideos.push({ file: file, caption: '' });
    console.log('Видео добавлено:', file.name);
    return true;
};

// Показать предпросмотр видео
window.showVideoPreview = function() {
    if (!window.pendingVideos.length) return;
    
    var oldModal = document.getElementById('video-preview-modal');
    if (oldModal) oldModal.remove();
    
    var modalHtml = `
        <div id="video-preview-modal" class="modal" style="z-index: 10010;">
            <div style="max-width: 450px; width: 90%; background: white; border-radius: 24px; margin: auto; overflow: hidden;">
                <div style="padding: 12px 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                    <h3 style="margin: 0;">🎬 Отправка видео (<span id="video-counter">0/0</span>)</h3>
                    <button onclick="window.closeVideoPreview()" style="background: none; border: none; font-size: 24px;">×</button>
                </div>
                <div style="background: #000; text-align: center;">
                    <video id="preview-video" controls style="max-width: 100%; max-height: 300px;"></video>
                </div>
                <div style="display: flex; justify-content: center; gap: 30px; padding: 10px;">
                    <button id="video-prev-btn" style="background: none; border: none; font-size: 32px;">←</button>
                    <img src="https://i.ibb.co/BVhBTnmS/11623-AE3-5-A11-48-F3-9-C9-F-95-AF1-CD6-AAE4.png" onclick="window.addMoreVideos()" style="width: 45px; cursor: pointer;">
                    <button id="video-next-btn" style="background: none; border: none; font-size: 32px;">→</button>
                </div>
                <div style="padding: 10px 16px 20px;">
                    <input type="text" id="video-caption" placeholder="Добавить подпись..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 30px;">
                    <button onclick="window.confirmVideoSend()" style="width: 100%; margin-top: 12px; padding: 12px; background: #228B22; color: white; border: none; border-radius: 30px;">📤 Отправить</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    var video = window.pendingVideos[window.currentVideoIndex];
    var preview = document.getElementById('preview-video');
    if (preview && video) {
        preview.src = URL.createObjectURL(video.file);
        preview.load();
    }
    
    document.getElementById('video-counter').textContent = `${window.currentVideoIndex + 1}/${window.pendingVideos.length}`;
    document.getElementById('video-caption').value = video.caption || '';
    
    document.getElementById('video-prev-btn').onclick = () => window.navigateVideo(-1);
    document.getElementById('video-next-btn').onclick = () => window.navigateVideo(1);
    
    document.getElementById('video-prev-btn').style.display = window.currentVideoIndex > 0 ? 'inline-block' : 'none';
    document.getElementById('video-next-btn').style.display = window.currentVideoIndex < window.pendingVideos.length - 1 ? 'inline-block' : 'none';
};

window.navigateVideo = function(direction) {
    var newIndex = window.currentVideoIndex + direction;
    if (newIndex >= 0 && newIndex < window.pendingVideos.length) {
        var caption = document.getElementById('video-caption');
        if (caption) window.pendingVideos[window.currentVideoIndex].caption = caption.value;
        window.currentVideoIndex = newIndex;
        window.showVideoPreview();
    }
};

window.addMoreVideos = function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(f => {
            if (f.type.startsWith('video/') && f.size <= 100 * 1024 * 1024) {
                window.pendingVideos.push({ file: f, caption: '' });
            }
        });
        if (window.pendingVideos.length) {
            window.currentVideoIndex = window.pendingVideos.length - 1;
            window.showVideoPreview();
        }
    };
    input.click();
};

window.closeVideoPreview = function() {
    var modal = document.getElementById('video-preview-modal');
    if (modal) modal.remove();
};

window.cancelAllVideos = function() {
    window.pendingVideos = [];
    window.currentVideoIndex = 0;
    window.closeVideoPreview();
};

// Загрузка видео на PixelDrain (рабочая версия)
window.uploadVideoToPixelDrain = async function(file) {
    var formData = new FormData();
    formData.append('file', file);
    
    var response = await fetch('https://pixeldrain.com/api/file/', {
        method: 'POST',
        body: formData
    });
    
    var data = await response.json();
    console.log('PixelDrain ответ:', data);
    
    if (!data.id) {
        throw new Error(data.message || 'Ошибка загрузки');
    }
    
    return `https://pixeldrain.com/api/file/${data.id}`;
};

// Отправка видео
window.confirmVideoSend = async function() {
    if (!window.pendingVideos.length) {
        showNotification('Нет видео для отправки', 'error');
        return;
    }
    if (!window.currentChatId) {
        showNotification('Выберите чат', 'error');
        return;
    }
    
    var caption = document.getElementById('video-caption')?.value || '';
    if (window.pendingVideos[window.currentVideoIndex]) {
        window.pendingVideos[window.currentVideoIndex].caption = caption;
    }
    
    showNotification(`📤 Отправка ${window.pendingVideos.length} видео...`, 'info');
    
    var success = 0, fail = 0;
    
    for (var i = 0; i < window.pendingVideos.length; i++) {
        try {
            var video = window.pendingVideos[i];
            var videoUrl = await window.uploadVideoToPixelDrain(video.file);
            
            await database.ref('messages/' + window.currentChatId).push({
                type: 'video',
                videoUrl: videoUrl,
                caption: video.caption || '',
                fileName: video.file.name,
                senderId: window.currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            success++;
        } catch (err) {
            console.error('Ошибка:', err);
            fail++;
        }
    }
    
    if (success > 0) {
        var lastMsg = success === 1 ? '🎬 Видео' : `🎬 ${success} видео`;
        await database.ref('chats/' + window.currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    showNotification(`✅ Отправлено: ${success}, ❌ Ошибок: ${fail}`, success ? 'success' : 'error');
    
    window.pendingVideos = [];
    window.currentVideoIndex = 0;
    window.closeVideoPreview();
};

// Переопределяем handleFileSelect
window.handleFileSelect = function(event) {
    var files = Array.from(event.target.files);
    if (!files.length) return;
    
    var hasVideo = false;
    
    for (var file of files) {
        var isVideo = file.type.startsWith('video/');
        
        if (isVideo) {
            window.addVideoForPreview(file);
            hasVideo = true;
        } else if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
            if (!window.pendingGifs) window.pendingGifs = [];
            window.pendingGifs.push(file);
            if (typeof window.sendAllGifs === 'function') window.sendAllGifs();
        } else if (file.type.startsWith('image/')) {
            if (!window.pendingImages) window.pendingImages = [];
            window.pendingImages.push({ file: file, caption: '' });
            if (typeof window.showImagePreview === 'function') window.showImagePreview();
        }
    }
    
    if (hasVideo && window.pendingVideos.length) {
        window.currentVideoIndex = window.pendingVideos.length - 1;
        window.showVideoPreview();
    }
    
    event.target.value = '';
};

console.log('✅ Видео полностью исправлено! Используется PixelDrain');
// ========== ОТКЛЮЧЕНИЕ ВИДЕО ==========
// Перехватываем выбор файлов и блокируем видео
var originalHandleFileSelect = window.handleFileSelect;
if (originalHandleFileSelect) {
    window.handleFileSelect = function(event) {
        var files = Array.from(event.target.files);
        var hasVideo = false;
        
        for (var i = 0; i < files.length; i++) {
            if (files[i].type.startsWith('video/')) {
                hasVideo = true;
                break;
            }
        }
        
        if (hasVideo) {
            showNotification('📹 Видео временно недоступно. Отправьте фото или GIF.', 'info');
            event.target.value = '';
            return;
        }
        
        originalHandleFileSelect(event);
    };
}

console.log('✅ Видео отключено, отправка только фото и GIF');
// ========== ГОЛОСОВЫЕ СООБЩЕНИЯ (КРАСИВЫЙ ИНТЕРФЕЙС) ==========

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

// Загрузка аудио через PixelDrain API
window.uploadAudioToPixelDrain = async function(blob) {
    var PIXELDRAIN_API_KEY = 'fb14ed75-4352-4e78-804c-a797b3131456';
    
    var formData = new FormData();
    formData.append('file', blob, `voice_${Date.now()}.webm`);
    
    var response = await fetch('https://pixeldrain.com/api/file/', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa(PIXELDRAIN_API_KEY + ':')
        },
        body: formData
    });
    
    var data = await response.json();
    console.log('PixelDrain ответ:', data);
    
    if (!data.id) {
        throw new Error('Ошибка загрузки');
    }
    
    return `https://pixeldrain.com/api/file/${data.id}`;
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

// Визуализация звука (волны)
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
    if (sendBtn) sendBtn.onclick = sendVoiceMessageWithAPI;
    
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
    
    var attachBtn = document.getElementById('attach-file-btn');
    var fileInput = document.getElementById('file-input');
    if (attachBtn && fileInput) attachBtn.onclick = function() { fileInput.click(); };
    
    var sendBtn = document.querySelector('.send-btn');
    if (sendBtn) sendBtn.onclick = function() { if (typeof window.sendMessage === 'function') window.sendMessage(); };
    
    var messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.onkeypress = function(e) { if (typeof window.handleMessageKeyPress === 'function') window.handleMessageKeyPress(e); };
        messageInput.oninput = function() { if (typeof window.onTyping === 'function') window.onTyping(); };
    }
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

// Воспроизведение/пауза в предпросмотре
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

// Отправка голосового сообщения
async function sendVoiceMessageWithAPI() {
    if (!voiceState.audioBlob) return;
    if (!window.currentChatId) {
        showNotification('Выберите чат', 'error');
        return;
    }
    
    showNotification('📤 Отправка голосового...', 'info');
    
    try {
        var audioUrl = await window.uploadAudioToPixelDrain(voiceState.audioBlob);
        
        await database.ref('messages/' + window.currentChatId).push({
            type: 'audio',
            audioUrl: audioUrl,
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
        showNotification('❌ Ошибка отправки: ' + err.message, 'error');
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
        
        showNotification('🎙️ Запись...', 'info');
        
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

console.log('✅ Голосовые сообщения с красивым интерфейсом настроены!');

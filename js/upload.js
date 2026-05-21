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
        var isVideo = file.type.startsWith('video/');
        var isImage = file.type.startsWith('image/') && !isGif;
        
        if (isVideo) {
            sendVideoMessage(file);
        } else if (isGif) {
            pendingGifs.push(file);
        } else if (isImage) {
            pendingImages.push({ file: file, caption: '' });
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
// ========== ЗАГРУЗКА ВИДЕО ЧЕРЕЗ PIXELDRAIN ==========
var PIXELDRAIN_API_KEY = 'fb14ed75-4352-4e78-804c-a797b3131456';

async function uploadVideoToPixelDrain(file) {
    if (!file.type.startsWith('video/')) {
        throw new Error('Файл не является видео');
    }
    
    if (file.size > 100 * 1024 * 1024) {
        throw new Error('Видео не должно превышать 100MB');
    }
    
    showNotification('📤 Загрузка видео...', 'info');
    
    var formData = new FormData();
    formData.append('file', file);
    
    var response = await fetch('https://pixeldrain.com/api/file/', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa(PIXELDRAIN_API_KEY + ':')
        },
        body: formData
    });
    
    var data = await response.json();
    
    if (!response.ok || !data.id) {
        throw new Error(data.message || 'Ошибка загрузки');
    }
    
    var videoUrl = 'https://pixeldrain.com/api/file/' + data.id;
    return videoUrl;
}

async function sendVideoMessage(file) {
    if (!currentChatId) {
        showNotification('Выберите чат', 'error');
        return;
    }
    
    if (file.size > 100 * 1024 * 1024) {
        showNotification('Видео не более 100MB', 'error');
        return;
    }
    
    showNotification('📤 Загрузка видео...', 'info');
    
    var formData = new FormData();
    formData.append('file', file);
    
    try {
        var response = await fetch('https://pixeldrain.com/api/file/', {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + btoa('fb14ed75-4352-4e78-804c-a797b3131456' + ':') },
            body: formData
        });
        
        var data = await response.json();
        if (!data.id) throw new Error('Ошибка');
        
        var videoUrl = 'https://pixeldrain.com/api/file/' + data.id;
        
        await database.ref('messages/' + currentChatId).push({
            type: 'video',
            videoUrl: videoUrl,
            fileName: file.name,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await database.ref('chats/' + currentChatId).update({
            lastMessage: '🎬 Видео',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        showNotification('✅ Видео отправлено!', 'success');
    } catch(e) {
        showNotification('Ошибка загрузки видео', 'error');
    }
}
// ========== ОТПРАВКА ВИДЕО (С ПРЕДПРОСМОТРОМ КАК У ФОТО) ==========

var pendingVideos = [];
var currentVideoIndex = 0;

// Функция для видео (вызывается из handleFileSelect)
window.addVideoForPreview = function(file) {
    if (!file.type.startsWith('video/')) return;
    
    if (file.size > 100 * 1024 * 1024) {
        showNotification('Видео не более 100MB', 'error');
        return false;
    }
    
    pendingVideos.push({ file: file, caption: '' });
    return true;
};

// Показать предпросмотр видео (как у фото)
window.showVideoPreview = function() {
    if (pendingVideos.length === 0) return;
    
    var modal = document.getElementById('video-preview-modal');
    if (!modal) {
        // Создаём модальное окно для видео
        var modalHtml = `
            <div id="video-preview-modal" class="modal" style="z-index: 10010;">
                <div class="image-preview-container" style="max-width: 500px; width: 90%; border-radius: 20px; overflow: hidden; background: white;">
                    <div class="modal-header" style="padding: 12px 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 16px;">🎬 Отправка видео (<span id="video-counter">0/0</span>)</h3>
                        <button onclick="closeVideoPreview()" class="btn-close" style="font-size: 24px;">×</button>
                    </div>
                    <div style="position: relative; background: #000; min-height: 250px; display: flex; align-items: center; justify-content: center;">
                        <video id="preview-video" controls style="max-width: 100%; max-height: 400px; width: auto; height: auto;"></video>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px;">
                        <button id="video-prev-btn" onclick="navigateVideo(-1)" style="background: none; border: none; font-size: 32px; cursor: pointer; color: var(--forest); display: none;">←</button>
                        <img src="https://i.ibb.co/BVhBTnmS/11623-AE3-5-A11-48-F3-9-C9-F-95-AF1-CD6-AAE4.png" alt="Добавить видео" onclick="addMoreVideos()" style="width: 50px; height: 50px; cursor: pointer;">
                        <button id="video-next-btn" onclick="navigateVideo(1)" style="background: none; border: none; font-size: 32px; cursor: pointer; color: var(--forest); display: none;">→</button>
                    </div>
                    <div style="padding: 10px 20px 20px;">
                        <div style="display: flex; align-items: center; background: var(--background); border-radius: 24px; padding: 5px 15px;">
                            <input type="text" id="video-caption" placeholder="Добавить подпись к видео..." style="flex: 1; background: transparent; border: none; padding: 12px 0; font-size: 14px; outline: none;">
                            <button onclick="confirmVideoSend()" style="background: var(--forest); border: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; padding: 0 20px 20px;">
                        <button onclick="cancelAllVideos()" class="btn-secondary" style="flex: 1; padding: 10px;">❌ Отмена</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('video-preview-modal');
    }
    
    var currentVideo = pendingVideos[currentVideoIndex];
    var previewVideo = document.getElementById('preview-video');
    var captionInput = document.getElementById('video-caption');
    var counter = document.getElementById('video-counter');
    
    if (previewVideo && currentVideo) {
        var url = URL.createObjectURL(currentVideo.file);
        previewVideo.src = url;
        previewVideo.load();
        
        // Старый URL нужно удалить при закрытии
        previewVideo.onended = function() {
            URL.revokeObjectURL(url);
        };
    }
    
    if (captionInput) captionInput.value = currentVideo.caption || '';
    if (counter) counter.textContent = `${currentVideoIndex + 1} / ${pendingVideos.length}`;
    
    updateVideoNavButtons();
    
    modal.classList.remove('hidden');
};

function updateVideoNavButtons() {
    var prevBtn = document.getElementById('video-prev-btn');
    var nextBtn = document.getElementById('video-next-btn');
    if (prevBtn) prevBtn.style.display = currentVideoIndex > 0 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = currentVideoIndex < pendingVideos.length - 1 ? 'flex' : 'none';
}

function navigateVideo(direction) {
    var newIndex = currentVideoIndex + direction;
    if (newIndex >= 0 && newIndex < pendingVideos.length) {
        var captionInput = document.getElementById('video-caption');
        if (captionInput && pendingVideos[currentVideoIndex]) {
            pendingVideos[currentVideoIndex].caption = captionInput.value;
        }
        currentVideoIndex = newIndex;
        showVideoPreview();
    }
}

function addMoreVideos() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(function(file) {
            if (file.type.startsWith('video/')) {
                if (file.size <= 100 * 1024 * 1024) {
                    pendingVideos.push({ file: file, caption: '' });
                } else {
                    showNotification('Видео ' + file.name + ' больше 100MB', 'error');
                }
            }
        });
        if (pendingVideos.length > 0) {
            currentVideoIndex = pendingVideos.length - 1;
            showVideoPreview();
        }
    };
    input.click();
}

function cancelAllVideos() {
    pendingVideos = [];
    currentVideoIndex = 0;
    closeVideoPreview();
}

function closeVideoPreview() {
    var modal = document.getElementById('video-preview-modal');
    if (modal) modal.classList.add('hidden');
    
    // Очищаем видео
    var previewVideo = document.getElementById('preview-video');
    if (previewVideo) {
        previewVideo.src = '';
    }
}

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
    
    // Сохраняем подпись для текущего видео
    if (pendingVideos[currentVideoIndex]) {
        pendingVideos[currentVideoIndex].caption = currentCaption;
    }
    
    showNotification(`📤 Отправка ${pendingVideos.length} видео...`, 'info');
    var successCount = 0;
    var failCount = 0;
    
    for (var i = 0; i < pendingVideos.length; i++) {
        try {
            var video = pendingVideos[i];
            var videoUrl = await uploadVideoToPixelDrain(video.file);
            
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
    
    showNotification(failCount === 0 ? `✅ Все ${successCount} видео отправлены!` : `✅ Отправлено: ${successCount}, ошибок: ${failCount}`, failCount === 0 ? 'success' : 'info');
    
    pendingVideos = [];
    currentVideoIndex = 0;
    closeVideoPreview();
}

// Переопределяем handleFileSelect для поддержки видео
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
    
    // Показываем соответствующий предпросмотр
    if (hasVideos) {
        if (window.pendingVideos && window.pendingVideos.length > 0) {
            window.showVideoPreview();
        }
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

// ========== ОТПРАВКА ВИДЕО (ИСПРАВЛЕННАЯ ВЕРСИЯ) ==========

// Функция загрузки видео на Pixeldrain (исправленная)
window.uploadVideoToPixelDrain = async function(file) {
    var PIXELDRAIN_API_KEY = 'fb14ed75-4352-4e78-804c-a797b3131456';
    
    var formData = new FormData();
    formData.append('file', file);
    
    try {
        console.log('Начинаем загрузку видео:', file.name, 'Размер:', file.size);
        
        var response = await fetch('https://pixeldrain.com/api/file/', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(PIXELDRAIN_API_KEY + ':')
            },
            body: formData
        });
        
        var data = await response.json();
        console.log('Ответ Pixeldrain:', data);
        
        if (!response.ok) {
            throw new Error(data.message || 'Ошибка загрузки видео');
        }
        
        if (!data.id) {
            throw new Error('Не получен ID файла');
        }
        
        // Возвращаем прямую ссылку на файл
        return 'https://pixeldrain.com/api/file/' + data.id;
        
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        throw new Error('Не удалось загрузить видео: ' + error.message);
    }
};

// Альтернативный способ загрузки через Archive.org (если Pixeldrain не работает)
window.uploadVideoToArchive = async function(file) {
    var IA_ACCESS_KEY = 'NvSNcWy5BiOXcDk2';
    var IA_SECRET_KEY = '1Katd89Oa7Xk49P3';
    
    var itemId = 'kukumber_video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    var fileName = file.name;
    var uploadUrl = `https://s3.us.archive.org/${itemId}/${encodeURIComponent(fileName)}`;
    
    var authBase64 = btoa(IA_ACCESS_KEY + ':' + IA_SECRET_KEY);
    
    var response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': 'LOW ' + authBase64,
            'x-amz-auto-make-bucket': '1',
            'x-archive-meta-mediatype': 'movies',
            'Content-Type': file.type
        },
        body: file
    });
    
    if (!response.ok) {
        throw new Error('Ошибка загрузки на Archive.org');
    }
    
    return `https://archive.org/download/${itemId}/${encodeURIComponent(fileName)}`;
};

// Исправленная функция confirmVideoSend с лучшей обработкой ошибок
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
    var errors = [];
    
    for (var i = 0; i < pendingVideos.length; i++) {
        try {
            var video = pendingVideos[i];
            showNotification(`Загрузка видео ${i+1}/${pendingVideos.length}...`, 'info');
            
            // Пробуем Pixeldrain
            var videoUrl = await window.uploadVideoToPixelDrain(video.file);
            
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
            await new Promise(r => setTimeout(r, 500));
            
        } catch (error) {
            console.error('Ошибка отправки видео', i, error);
            failCount++;
            errors.push(video.file.name + ': ' + error.message);
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
        showNotification(`✅ Отправлено: ${successCount}, ❌ Ошибок: ${failCount}\n${errors[0] || ''}`, 'info');
    } else {
        showNotification(`✅ Все ${successCount} видео отправлены!`, 'success');
    }
    
    pendingVideos = [];
    currentVideoIndex = 0;
    closeVideoPreview();
}
// Проверка работоспособности загрузки видео
window.testVideoUpload = async function() {
    // Создаём тестовый маленький видеофайл (1 секунда)
    var canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Test Video', 50, 120);
    
    // Преобразуем в Blob
    var blob = await new Promise(resolve => canvas.toBlob(resolve, 'video/mp4'));
    var testFile = new File([blob], 'test.mp4', { type: 'video/mp4' });
    
    console.log('Тестовый файл создан, размер:', testFile.size);
    
    try {
        var url = await window.uploadVideoToPixelDrain(testFile);
        console.log('Успешно загружено! URL:', url);
        showNotification('Тест успешен! Видео загружено', 'success');
        return url;
    } catch (err) {
        console.error('Тест не удался:', err);
        showNotification('Ошибка загрузки: ' + err.message, 'error');
        return null;
    }
};

console.log('Для теста загрузки видео введите в консоль: testVideoUpload()');

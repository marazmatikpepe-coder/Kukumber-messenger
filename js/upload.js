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
        
        // ВИДЕО ОТКЛЮЧЕНО НАВСЕГДА
        if (isVideo) {
            showNotification('📹 Видео недоступно', 'info');
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

// ========== ГОЛОСОВЫЕ СООБЩЕНИЯ (ПРОСТАЯ РАБОЧАЯ ВЕРСИЯ ДЛЯ ТЕЛЕФОНА) ==========

var simpleVoice = {
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    startTime: null
};

// Запись голосового
window.startVoiceRecording = async function() {
    if (simpleVoice.isRecording) {
        showNotification('Уже идет запись', 'info');
        return;
    }
    if (!window.currentChatId) {
        showNotification('Сначала выберите чат', 'error');
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        simpleVoice.mediaRecorder = new MediaRecorder(stream);
        simpleVoice.audioChunks = [];
        simpleVoice.startTime = Date.now();
        simpleVoice.isRecording = true;
        
        simpleVoice.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) simpleVoice.audioChunks.push(e.data);
        };
        
        simpleVoice.mediaRecorder.onstop = async () => {
            const blob = new Blob(simpleVoice.audioChunks, { type: 'audio/webm' });
            const duration = Math.floor((Date.now() - simpleVoice.startTime) / 1000);
            
            stream.getTracks().forEach(track => track.stop());
            
            if (duration >= 1 && blob.size > 0) {
                await sendSimpleVoice(blob, duration);
            } else {
                showNotification('Голосовое слишком короткое', 'error');
            }
            
            simpleVoice.audioChunks = [];
            simpleVoice.isRecording = false;
        };
        
        simpleVoice.mediaRecorder.start();
        
        // Меняем внешний вид кнопки
        const btn = document.getElementById('voice-record-btn');
        if (btn) {
            btn.style.background = '#dc3545';
            btn.textContent = '⏹️';
        }
        
        showNotification('🎙️ Запись... Отпустите кнопку', 'info');
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('Нет доступа к микрофону', 'error');
    }
};

// Остановка записи
window.stopVoiceRecording = function() {
    if (!simpleVoice.isRecording) return;
    
    if (simpleVoice.mediaRecorder && simpleVoice.mediaRecorder.state === 'recording') {
        simpleVoice.mediaRecorder.stop();
    }
    
    const btn = document.getElementById('voice-record-btn');
    if (btn) {
        btn.style.background = '';
        btn.textContent = '🎤';
    }
};

// Отправка голосового
async function sendSimpleVoice(blob, duration) {
    showNotification('📤 Отправка...', 'info');
    
    try {
        // Конвертируем в base64 и сохраняем в Firebase
        const reader = new FileReader();
        
        reader.onloadend = async function() {
            const base64 = reader.result;
            const voiceId = 'voice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            
            await database.ref('voiceMessages/' + voiceId).set({
                data: base64,
                duration: duration,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                senderId: currentUser.uid
            });
            
            await database.ref('messages/' + window.currentChatId).push({
                type: 'audio',
                voiceId: voiceId,
                duration: duration,
                senderId: window.currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            await database.ref('chats/' + window.currentChatId).update({
                lastMessage: `🎤 Голосовое (${duration} сек)`,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
            
            showNotification('✅ Голосовое отправлено!', 'success');
        };
        
        reader.readAsDataURL(blob);
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('❌ Ошибка отправки', 'error');
    }
}

// Инициализация кнопки
function initSimpleVoice() {
    const btn = document.getElementById('voice-record-btn');
    if (!btn) return;
    
    // Убираем старые обработчики
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Для телефона - touch события
    newBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        window.startVoiceRecording();
    });
    
    newBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        window.stopVoiceRecording();
    });
    
    // Для компьютера - mouse события
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
}

setTimeout(initSimpleVoice, 1000);

console.log('✅ Голосовые сообщения (простая версия) загружены');
// ========== ЗАГРУЗКА ВИДЕО НА VIMEO (РАБОЧАЯ ВЕРСИЯ) ==========

const VIMEO_TOKEN = '53baf378ccee4b18ca872bf638cff33f';

// Функция загрузки видео на Vimeo
window.uploadVideoToVimeo = async function(file, onProgress) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('1. Запрашиваем ссылку для загрузки...');
            
            // 1. Получаем upload_link от Vimeo
            const response = await fetch('https://api.vimeo.com/me/videos', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${VIMEO_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.vimeo.*+json;version=3.4'
                },
                body: JSON.stringify({
                    upload: {
                        approach: 'tus',
                        size: file.size
                    }
                })
            });
            
            const data = await response.json();
            
            if (!data.upload || !data.upload.upload_link) {
                console.error('Ответ Vimeo:', data);
                throw new Error('Не удалось получить ссылку для загрузки');
            }
            
            const uploadLink = data.upload.upload_link;
            const videoUri = data.uri;
            console.log('2. Получена ссылка для загрузки:', uploadLink);
            
            // 2. Проверяем, подключена ли библиотека tus
            if (typeof tus === 'undefined') {
                // Если библиотека не загружена, загружаем её
                await loadTusLibrary();
            }
            
            // 3. Загружаем файл через tus
            const upload = new tus.Upload(file, {
                uploadUrl: uploadLink,
                retryDelays: [0, 3000, 5000, 10000],
                metadata: {
                    filename: file.name,
                    filetype: file.type
                },
                onError: (error) => {
                    console.error('Tus ошибка:', error);
                    reject(new Error('Ошибка при загрузке: ' + error.message));
                },
                onProgress: (bytesUploaded, bytesTotal) => {
                    const percent = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
                    if (onProgress) onProgress(percent);
                    console.log(`Загружено: ${percent}%`);
                },
                onSuccess: () => {
                    console.log('3. Загрузка завершена!');
                    const videoId = videoUri.split('/').pop();
                    const videoUrl = `https://vimeo.com/${videoId}`;
                    resolve(videoUrl);
                }
            });
            
            upload.start();
            
        } catch (err) {
            console.error('Ошибка:', err);
            reject(err);
        }
    });
};

// Функция загрузки библиотеки tus
function loadTusLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof tus !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tus-js-client@latest/dist/tus.min.js';
        script.onload = () => {
            console.log('Tus библиотека загружена');
            resolve();
        };
        script.onerror = () => reject(new Error('Не удалось загрузить библиотеку tus'));
        document.head.appendChild(script);
    });
}

// Функция отправки видео
window.sendVideoMessage = async function(file) {
    if (!file.type.startsWith('video/')) {
        showNotification('Это не видео файл', 'error');
        return;
    }
    
    if (!window.currentChatId) {
        showNotification('Сначала выберите чат', 'error');
        return;
    }
    
    // Проверка размера (Vimeo бесплатно до 25GB в неделю)
    if (file.size > 500 * 1024 * 1024) {
        if (!confirm('Видео больше 500MB. Загрузка может занять время. Продолжить?')) {
            return;
        }
    }
    
    showNotification('📤 Загрузка видео на Vimeo... 0%', 'info');
    
    try {
        const videoUrl = await window.uploadVideoToVimeo(file, (percent) => {
            showNotification(`📤 Загрузка видео: ${percent}%`, 'info');
        });
        
        // Отправляем ссылку на видео в чат
        await database.ref('messages/' + window.currentChatId).push({
            type: 'text',
            text: `🎬 Видео: ${videoUrl}`,
            senderId: window.currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await database.ref('chats/' + window.currentChatId).update({
            lastMessage: '🎬 Видео',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        showNotification('✅ Видео загружено и отправлено!', 'success');
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('❌ Ошибка загрузки видео: ' + err.message, 'error');
    }
};

console.log('✅ Vimeo видео загрузка настроена!');

// UPLOAD - работающая отправка фото через Catbox
var pendingImageFile = null;

// Загрузка на Catbox (работает без API ключа)
async function uploadToCatbox(file) {
    var formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);
    
    var response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        mode: 'cors'
    });
    
    var url = await response.text();
    
    if (!url || !url.startsWith('https://')) {
        throw new Error('Catbox вернул неверный URL: ' + url);
    }
    
    return url;
}

// Выбор файла
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        event.target.value = '';
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showNotification('Файл слишком большой (макс. 10MB)', 'error');
        event.target.value = '';
        return;
    }
    
    pendingImageFile = file;
    
    var reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('preview-image').src = e.target.result;
        document.getElementById('image-caption').value = '';
        document.getElementById('image-preview-modal').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
}

function closeImagePreview() {
    document.getElementById('image-preview-modal').classList.add('hidden');
    pendingImageFile = null;
}

// Отправка фото
async function confirmImageSend() {
    if (!pendingImageFile) {
        showNotification('Нет выбранного фото', 'error');
        closeImagePreview();
        return;
    }
    
    if (!currentChatId) {
        showNotification('Выберите чат', 'error');
        closeImagePreview();
        return;
    }
    
    var caption = document.getElementById('image-caption').value.trim();
    var file = pendingImageFile;
    
    showNotification('📤 Загрузка фото на сервер...', 'info');
    
    try {
        // Сначала загружаем фото
        var imageUrl = await uploadToCatbox(file);
        console.log('Фото загружено:', imageUrl);
        
        // Потом отправляем ссылку в Firebase
        var message = {
            type: 'image',
            imageUrl: imageUrl,
            caption: caption,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            sentAt: Date.now()
        };
        
        console.log('Отправка сообщения в чат:', currentChatId);
        
        var newMsgRef = await database.ref('messages/' + currentChatId).push(message);
        console.log('Сообщение отправлено, ID:', newMsgRef.key);
        
        var lastMsg = caption ? '📷 ' + caption.substring(0, 47) : '📷 Фото';
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        showNotification('✅ Фото отправлено!', 'success');
        closeImagePreview();
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
}

// Голосовые и остальные функции
var mediaRecorder = null;
var audioChunks = [];
var isRecording = false;

async function sendAnyFile(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('📤 Загрузка...', 'info');
    
    try {
        var url = await uploadToCatbox(file);
        
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

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                var blob = new Blob(audioChunks, { type: 'audio/webm' });
                var file = new File([blob], 'voice.webm', { type: 'audio/webm' });
                sendAnyFile(file);
                stream.getTracks().forEach(t => t.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            
            var btn = document.getElementById('voice-record-btn');
            if (btn) {
                btn.classList.add('recording');
                btn.textContent = '🔴';
            }
            
            setTimeout(() => {
                if (isRecording) stopRecording();
            }, 60000);
        })
        .catch(() => showNotification('❌ Нет доступа к микрофону', 'error'));
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        var btn = document.getElementById('voice-record-btn');
        if (btn) {
            btn.classList.remove('recording');
            btn.textContent = '🎤';
        }
    }
}

var groupAvatarFile = null;
var channelAvatarFile = null;

function previewGroupAvatar(e) {
    var file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        groupAvatarFile = file;
        var reader = new FileReader();
        reader.onload = ev => {
            var preview = document.getElementById('group-avatar-preview');
            preview.style.backgroundImage = 'url(' + ev.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewChannelAvatar(e) {
    var file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        channelAvatarFile = file;
        var reader = new FileReader();
        reader.onload = ev => {
            var preview = document.getElementById('channel-avatar-preview');
            preview.style.backgroundImage = 'url(' + ev.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

var pendingAvatarFile = null;

function previewEditAvatar(e) {
    var file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        pendingAvatarFile = file;
        var reader = new FileReader();
        reader.onload = ev => {
            var preview = document.getElementById('edit-avatar-preview');
            preview.style.backgroundImage = 'url(' + ev.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

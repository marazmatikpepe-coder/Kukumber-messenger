// UPLOAD - работающая отправка фото через ImgBB
var pendingImageFile = null;

// ТВОЙ API ключ ImgBB
var IMGBB_API_KEY = '03a5a914cba6f919ff317ebb6d9ed4f9';

// Загрузка фото на ImgBB
async function uploadImageToImgBB(file) {
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
    
    return { url: data.data.url };
}

// Выбор файла (только фото)
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    // Проверяем что это изображение
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        event.target.value = '';
        return;
    }
    
    // Ограничение размера 10MB
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

// Закрыть окно предпросмотра
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
    
    // Показываем индикатор загрузки
    showNotification('📤 Загрузка фото...', 'info');
    
    try {
        var result = await uploadImageToImgBB(file);
        var imageUrl = result.url;
        
        var message = {
            type: 'image',
            imageUrl: imageUrl,
            caption: caption,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref('messages/' + currentChatId).push(message);
        
        var lastMsg = caption ? '📷 ' + caption.substring(0, 47) : '📷 Фото';
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        showNotification('✅ Фото отправлено!', 'success');
        closeImagePreview();
        
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('❌ Ошибка загрузки фото. Попробуйте ещё раз.', 'error');
    }
}

// Отправка любых файлов (для голосовых сообщений)
async function sendAnyFile(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('📤 Загрузка...', 'info');
    
    try {
        // Для голосовых используем тот же принцип
        var formData = new FormData();
        formData.append('image', file);
        
        var response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        
        var data = await response.json();
        
        if (!data.success) throw new Error('Upload failed');
        
        var url = data.data.url;
        
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

// Голосовые сообщения
var mediaRecorder = null;
var audioChunks = [];
var isRecording = false;

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
            
            // Авто-остановка через 60 секунд
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

// Аватарки групп и каналов
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

// Для редактирования аватарки профиля
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

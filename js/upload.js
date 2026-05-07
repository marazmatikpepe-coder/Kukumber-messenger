// UPLOAD - Catbox (работает из РФ)
var pendingImageFile = null;

// Загрузка на Catbox
async function uploadToCatbox(file) {
    var formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);
    
    var response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData
    });
    
    var url = await response.text();
    if (!url.startsWith('https://')) throw new Error('Ошибка загрузки');
    return url;
}

// Выбор файла
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        sendAnyFile(file);
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
    if (!pendingImageFile || !currentChatId) {
        showNotification('Ошибка отправки', 'error');
        closeImagePreview();
        return;
    }
    
    var caption = document.getElementById('image-caption').value.trim();
    var file = pendingImageFile;
    
    closeImagePreview();
    showNotification('Загрузка фото...', 'info');
    
    try {
        var url = await uploadToCatbox(file);
        
        var message = {
            type: 'image',
            imageUrl: url,
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
        
        showNotification('Фото отправлено!', 'success');
    } catch (error) {
        console.error(error);
        showNotification('Ошибка загрузки фото', 'error');
    }
}

// Отправка любых файлов
async function sendAnyFile(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('Загрузка файла...', 'info');
    
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
        showNotification('Файл отправлен!', 'success');
    } catch (error) {
        showNotification('Ошибка загрузки файла', 'error');
    }
}

// Голосовые сообщения
var mediaRecorder, audioChunks, isRecording = false;

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                var blob = new Blob(audioChunks, { type: 'audio/webm' });
                var file = new File([blob], 'voice.webm', { type: 'audio/webm' });
                sendAnyFile(file);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            var btn = document.getElementById('voice-record-btn');
            if (btn) btn.classList.add('recording');
        })
        .catch(() => showNotification('Нет доступа к микрофону', 'error'));
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        var btn = document.getElementById('voice-record-btn');
        if (btn) btn.classList.remove('recording');
    }
}

// Аватарки
function previewGroupAvatar(e) {
    var file = e.target.files[0];
    if (file) {
        groupAvatarFile = file;
        var reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('group-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('group-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('group-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewChannelAvatar(e) {
    var file = e.target.files[0];
    if (file) {
        channelAvatarFile = file;
        var reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('channel-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('channel-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('channel-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewEditAvatar(e) {
    var file = e.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('edit-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('edit-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('edit-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
        window.pendingAvatarFile = file;
    }
}

// UPLOAD - отправка фото через ImgBB (с обходом CORS)
var pendingImageFile = null;
var IMGBB_API_KEY = '03a5a914cba6f919ff317ebb6d9ed4f9';

// Загрузка на ImgBB через CORS-прокси
async function uploadToImgBB(file) {
    return new Promise(async (resolve, reject) => {
        var formData = new FormData();
        formData.append('image', file);
        
        // Пробуем напрямую
        try {
            console.log('Пробуем загрузить на ImgBB напрямую...');
            var response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            
            var data = await response.json();
            
            if (data.success) {
                console.log('✅ ImgBB загрузил напрямую');
                resolve(data.data.url);
                return;
            } else {
                console.log('ImgBB вернул ошибку:', data);
                throw new Error(data.error?.message || 'Ошибка ImgBB');
            }
        } catch (error) {
            console.log('Прямая загрузка не удалась, пробуем через прокси...', error.message);
            
            // Пробуем через CORS-прокси
            try {
                var proxyFormData = new FormData();
                proxyFormData.append('image', file);
                proxyFormData.append('key', IMGBB_API_KEY);
                
                var proxyResponse = await fetch('https://cors-anywhere.herokuapp.com/https://api.imgbb.com/1/upload', {
                    method: 'POST',
                    body: proxyFormData
                });
                
                var proxyData = await proxyResponse.json();
                
                if (proxyData.success) {
                    console.log('✅ ImgBB загрузил через прокси');
                    resolve(proxyData.data.url);
                } else {
                    throw new Error(proxyData.error?.message || 'Ошибка через прокси');
                }
            } catch (proxyError) {
                console.log('Прокси тоже не сработал:', proxyError.message);
                reject(new Error('Не удалось загрузить фото. Попробуйте фото меньшего размера.'));
            }
        }
    });
}

// Выбор файла
window.handleFileSelect = function(event) {
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
        var previewImg = document.getElementById('preview-image');
        if (previewImg) previewImg.src = e.target.result;
        
        var captionInput = document.getElementById('image-caption');
        if (captionInput) captionInput.value = '';
        
        var modal = document.getElementById('image-preview-modal');
        if (modal) modal.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
};

// Закрыть окно предпросмотра
window.closeImagePreview = function() {
    var modal = document.getElementById('image-preview-modal');
    if (modal) modal.classList.add('hidden');
    pendingImageFile = null;
};

// Отправка фото
window.confirmImageSend = async function() {
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
    
    if (!currentUser) {
        showNotification('Пользователь не авторизован', 'error');
        closeImagePreview();
        return;
    }
    
    var caption = document.getElementById('image-caption').value.trim();
    var file = pendingImageFile;
    
    showNotification('📤 Загрузка фото...', 'info');
    
    try {
        // Загружаем на ImgBB
        var imageUrl = await uploadToImgBB(file);
        console.log('Фото загружено, URL:', imageUrl);
        
        // Отправляем сообщение в Firebase
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
        console.error('Ошибка:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
};

// Отправка любых файлов (голосовые)
window.sendAnyFile = async function(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('📤 Загрузка...', 'info');
    
    try {
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
};

// Голосовые сообщения
var mediaRecorder = null;
var audioChunks = [];
var isRecording = false;

window.startRecording = function() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = function(e) {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = function() {
                var blob = new Blob(audioChunks, { type: 'audio/webm' });
                var file = new File([blob], 'voice.webm', { type: 'audio/webm' });
                window.sendAnyFile(file);
                stream.getTracks().forEach(t => t.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            
            var btn = document.getElementById('voice-record-btn');
            if (btn) {
                btn.classList.add('recording');
                btn.innerHTML = '🔴';
            }
            
            setTimeout(function() {
                if (isRecording) window.stopRecording();
            }, 60000);
        })
        .catch(function() {
            showNotification('❌ Нет доступа к микрофону', 'error');
        });
};

window.stopRecording = function() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        var btn = document.getElementById('voice-record-btn');
        if (btn) {
            btn.classList.remove('recording');
            btn.innerHTML = '🎤';
        }
    }
};

// Аватарки
window.groupAvatarFile = null;
window.channelAvatarFile = null;

window.previewGroupAvatar = function(e) {
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
};

window.previewChannelAvatar = function(e) {
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
};

window.pendingAvatarFile = null;

window.previewEditAvatar = function(e) {
    var file = e.target.files[0];
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
};

// UPLOAD - фото через base64 (хранятся прямо в Firebase)
var pendingImageFile = null;

// Конвертация файла в base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = function() {
            resolve(reader.result);
        };
        reader.onerror = function(error) {
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}

// Выбор файла
window.handleFileSelect = function(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    // Проверяем что это изображение
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        event.target.value = '';
        return;
    }
    
    // Ограничение 5MB для base64 (чтобы Firebase не тормозил)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Файл слишком большой (макс. 5MB)', 'error');
        event.target.value = '';
        return;
    }
    
    pendingImageFile = file;
    
    // Показываем превью
    var reader = new FileReader();
    reader.onload = function(e) {
        var previewImg = document.getElementById('preview-image');
        if (previewImg) {
            previewImg.src = e.target.result;
        }
        var captionInput = document.getElementById('image-caption');
        if (captionInput) {
            captionInput.value = '';
        }
        var modal = document.getElementById('image-preview-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
};

// Закрыть окно предпросмотра
window.closeImagePreview = function() {
    var modal = document.getElementById('image-preview-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    pendingImageFile = null;
};

// Отправка фото
window.confirmImageSend = async function() {
    // Проверки
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
    
    // Показываем индикатор загрузки
    showNotification('🔄 Конвертация фото...', 'info');
    
    try {
        // Конвертируем фото в base64
        var base64 = await fileToBase64(file);
        
        // Создаём сообщение
        var message = {
            type: 'image',
            imageUrl: base64,
            caption: caption,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        showNotification('📤 Отправка в чат...', 'info');
        
        // Отправляем в Firebase
        var messagesRef = database.ref('messages/' + currentChatId);
        var newMessageRef = await messagesRef.push(message);
        
        console.log('✅ Фото отправлено! ID:', newMessageRef.key);
        
        // Обновляем последнее сообщение в чате
        var lastMsg = caption ? '📷 ' + caption.substring(0, 47) : '📷 Фото';
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        showNotification('✅ Фото отправлено!', 'success');
        closeImagePreview();
        
    } catch (error) {
        console.error('Ошибка отправки фото:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
};

// Отправка любых файлов (для голосовых)
window.sendAnyFile = async function(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('🔄 Обработка...', 'info');
    
    try {
        var base64 = await fileToBase64(file);
        
        var message = {
            type: 'file',
            fileName: file.name,
            fileUrl: base64,
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
            
            // Авто-остановка через 60 секунд
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

// Аватарки групп
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

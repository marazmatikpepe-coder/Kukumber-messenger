// UPLOAD - мульти-отправка фото и GIF через ImgBB
var IMGBB_API_KEY = '03a5a914cba6f919ff317ebb6d9ed4f9';
var pendingImages = []; // массив объектов {file, caption}
var currentImageIndex = 0;
var pendingGifs = []; // массив GIF-файлов

// Загрузка на ImgBB
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

// Выбор файлов (фото и GIF)
window.handleFileSelect = function(event) {
    var files = Array.from(event.target.files);
    if (!files.length) return;
    
    // Разделяем на фото/обычные и GIF
    files.forEach(file => {
        var isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
        
        if (!file.type.startsWith('image/') && !isGif) {
            showNotification('⚠️ ' + file.name + ' — не изображение и не GIF', 'error');
            return;
        }
        
        if (file.size > 15 * 1024 * 1024) {
            showNotification('⚠️ ' + file.name + ' — слишком большой (макс. 15MB)', 'error');
            return;
        }
        
        if (isGif) {
            // GIF отправляем сразу, без предпросмотра
            pendingGifs.push(file);
        } else if (file.type.startsWith('image/')) {
            pendingImages.push({
                file: file,
                caption: ''
            });
        }
    });
    
    // Если есть GIF, отправляем их сразу
    if (pendingGifs.length > 0) {
        sendAllGifs();
    }
    
    // Если есть обычные фото, показываем предпросмотр
    if (pendingImages.length > 0) {
        currentImageIndex = pendingImages.length - 1;
        showImagePreview();
    }
    
    event.target.value = '';
};

// Отправка всех GIF
async function sendAllGifs() {
    if (pendingGifs.length === 0) return;
    
    if (!currentChatId) {
        showNotification('Выберите чат', 'error');
        return;
    }
    
    showNotification(`📤 Отправка ${pendingGifs.length} GIF...`, 'info');
    
    var successCount = 0;
    
    for (var i = 0; i < pendingGifs.length; i++) {
        var gifFile = pendingGifs[i];
        
        try {
            var gifUrl = await uploadToImgBB(gifFile);
            
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
            showNotification(`❌ Ошибка: ${gifFile.name}`, 'error');
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

// Показать текущее фото в превью
function showImagePreview() {
    if (pendingImages.length === 0) return;
    
    var currentImage = pendingImages[currentImageIndex];
    var reader = new FileReader();
    
    reader.onload = function(e) {
        var previewImg = document.getElementById('preview-image');
        if (previewImg) previewImg.src = e.target.result;
        
        var captionInput = document.getElementById('image-caption');
        if (captionInput) captionInput.value = currentImage.caption || '';
        
        var counter = document.getElementById('image-counter');
        if (counter) {
            counter.textContent = `${currentImageIndex + 1} / ${pendingImages.length}`;
        }
        
        updateNavButtons();
    };
    
    reader.readAsDataURL(currentImage.file);
    
    var modal = document.getElementById('image-preview-modal');
    if (modal) modal.classList.remove('hidden');
}

function updateNavButtons() {
    var prevBtn = document.getElementById('nav-prev-btn');
    var nextBtn = document.getElementById('nav-next-btn');
    
    if (prevBtn) {
        prevBtn.style.display = currentImageIndex > 0 ? 'flex' : 'none';
    }
    if (nextBtn) {
        nextBtn.style.display = currentImageIndex < pendingImages.length - 1 ? 'flex' : 'none';
    }
}

window.navigateImage = function(direction) {
    var newIndex = currentImageIndex + direction;
    
    if (newIndex >= 0 && newIndex < pendingImages.length) {
        var captionInput = document.getElementById('image-caption');
        if (captionInput && pendingImages[currentImageIndex]) {
            pendingImages[currentImageIndex].caption = captionInput.value;
        }
        
        currentImageIndex = newIndex;
        showImagePreview();
    }
};

window.addMoreImages = function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.type.startsWith('image/') && !file.type.includes('gif')) {
                if (file.size <= 10 * 1024 * 1024) {
                    pendingImages.push({
                        file: file,
                        caption: ''
                    });
                }
            }
        });
        if (pendingImages.length > 0) {
            currentImageIndex = pendingImages.length - 1;
            showImagePreview();
        }
    };
    input.click();
};

window.closeImagePreview = function() {
    var modal = document.getElementById('image-preview-modal');
    if (modal) modal.classList.add('hidden');
};

window.cancelAllImages = function() {
    pendingImages = [];
    currentImageIndex = 0;
    closeImagePreview();
};

window.confirmImageSend = async function() {
    if (pendingImages.length === 0) {
        showNotification('Нет фото для отправки', 'error');
        return;
    }
    
    if (!currentChatId) {
        showNotification('Выберите чат', 'error');
        return;
    }
    
    var captionInput = document.getElementById('image-caption');
    if (captionInput && pendingImages[currentImageIndex]) {
        pendingImages[currentImageIndex].caption = captionInput.value;
    }
    
    showNotification(`📤 Отправка ${pendingImages.length} фото...`, 'info');
    
    var successCount = 0;
    var failCount = 0;
    
    for (var i = 0; i < pendingImages.length; i++) {
        var image = pendingImages[i];
        
        try {
            showNotification(`📤 Отправка ${i+1}/${pendingImages.length}...`, 'info');
            
            var imageUrl = await uploadToImgBB(image.file);
            
            var message = {
                type: 'image',
                imageUrl: imageUrl,
                caption: image.caption || '',
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
    
    if (failCount === 0) {
        showNotification(`✅ Все ${successCount} фото отправлены!`, 'success');
    } else {
        showNotification(`✅ Отправлено: ${successCount}, ошибок: ${failCount}`, 'info');
    }
    
    pendingImages = [];
    currentImageIndex = 0;
    closeImagePreview();
};

// Остальные функции (голосовые, аватарки) остаются
var mediaRecorder = null;
var audioChunks = [];
var isRecording = false;

window.sendAnyFile = async function(file) {
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
};

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

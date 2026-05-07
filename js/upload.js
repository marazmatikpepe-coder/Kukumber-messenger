// UPLOAD - мульти-отправка фото через ImgBB
var IMGBB_API_KEY = '03a5a914cba6f919ff317ebb6d9ed4f9';
var pendingImages = []; // массив объектов {file, caption}
var currentImageIndex = 0;

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

// Выбор файлов (несколько)
window.handleFileSelect = function(event) {
    var files = Array.from(event.target.files);
    if (!files.length) return;
    
    // Добавляем новые файлы в очередь
    files.forEach(file => {
        if (!file.type.startsWith('image/')) {
            showNotification('⚠️ ' + file.name + ' — не изображение', 'error');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showNotification('⚠️ ' + file.name + ' — слишком большой (макс. 10MB)', 'error');
            return;
        }
        
        pendingImages.push({
            file: file,
            caption: ''
        });
    });
    
    if (pendingImages.length > 0) {
        currentImageIndex = pendingImages.length - 1;
        showImagePreview();
    }
    
    event.target.value = '';
};

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
        
        // Обновляем счетчик
        var counter = document.getElementById('image-counter');
        if (counter) {
            counter.textContent = `${currentImageIndex + 1} / ${pendingImages.length}`;
        }
        
        // Обновляем состояние кнопок навигации
        updateNavButtons();
    };
    
    reader.readAsDataURL(currentImage.file);
    
    // Показываем модальное окно
    var modal = document.getElementById('image-preview-modal');
    if (modal) modal.classList.remove('hidden');
}

// Обновить кнопки навигации
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

// Переключение между фото
window.navigateImage = function(direction) {
    var newIndex = currentImageIndex + direction;
    
    if (newIndex >= 0 && newIndex < pendingImages.length) {
        // Сохраняем текущую подпись
        var captionInput = document.getElementById('image-caption');
        if (captionInput && pendingImages[currentImageIndex]) {
            pendingImages[currentImageIndex].caption = captionInput.value;
        }
        
        currentImageIndex = newIndex;
        showImagePreview();
    }
};

// Добавить еще фото
window.addMoreImages = function() {
    // Создаем скрытый input и кликаем
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024) {
                pendingImages.push({
                    file: file,
                    caption: ''
                });
            }
        });
        if (pendingImages.length > 0) {
            currentImageIndex = pendingImages.length - 1;
            showImagePreview();
        }
    };
    input.click();
};

// Закрыть окно предпросмотра
window.closeImagePreview = function() {
    var modal = document.getElementById('image-preview-modal');
    if (modal) modal.classList.add('hidden');
    // Не очищаем pendingImages, чтобы можно было вернуться
};

// Отмена всей отправки
window.cancelAllImages = function() {
    pendingImages = [];
    currentImageIndex = 0;
    closeImagePreview();
};

// Отправка ВСЕХ фото по очереди
window.confirmImageSend = async function() {
    if (pendingImages.length === 0) {
        showNotification('Нет фото для отправки', 'error');
        return;
    }
    
    if (!currentChatId) {
        showNotification('Выберите чат', 'error');
        return;
    }
    
    // Сохраняем текущую подпись
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
            // Обновляем прогресс
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
            
            // Небольшая задержка между отправками
            await new Promise(r => setTimeout(r, 300));
            
        } catch (error) {
            console.error('Ошибка отправки фото', i, error);
            failCount++;
        }
    }
    
    // Обновляем последнее сообщение в чате
    if (successCount > 0) {
        var lastMsg = successCount === 1 ? '📷 Фото' : `📷 ${successCount} фото`;
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    // Показываем результат
    if (failCount === 0) {
        showNotification(`✅ Все ${successCount} фото отправлены!`, 'success');
    } else {
        showNotification(`✅ Отправлено: ${successCount}, ошибок: ${failCount}`, 'info');
    }
    
    // Очищаем очередь и закрываем окно
    pendingImages = [];
    currentImageIndex = 0;
    closeImagePreview();
};

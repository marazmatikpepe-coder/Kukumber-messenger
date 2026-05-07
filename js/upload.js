// UPLOAD - reeImage.host
var REEIMAGE_API_KEY = '6d207e02198a847aa98d0a2a901485a5';
var pendingImageFile = null;
var currentUploadXhr = null;

// Universal upload function for any file type (reeImage.host supports images, videos, files)
async function uploadToReeImage(file) {
    // Determine file type for API
    let sourceType = 'file';
    if (file.type.startsWith('image/')) sourceType = 'image';
    else if (file.type.startsWith('video/')) sourceType = 'video';
    
    const formData = new FormData();
    formData.append('source', file);
    formData.append('type', sourceType);
    formData.append('action', 'upload');
    formData.append('key', REEIMAGE_API_KEY);
    formData.append('format', 'json');
    
    const response = await fetch('https://reeimage.host/api/1/upload', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    
    if (data && data.image && data.image.url) {
        return data.image.url;
    } else if (data && data.image && data.image.url) {
        return data.image.url;
    } else if (data && data.url) {
        return data.url;
    } else if (typeof data === 'string' && data.startsWith('https://')) {
        return data;
    } else {
        console.error('Upload error response:', data);
        throw new Error('Upload failed: ' + (data.error?.message || 'Unknown error'));
    }
}

// Show circular progress modal
function showCircularProgress() {
    let modal = document.getElementById('upload-progress-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'upload-progress-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
        
        const style = document.createElement('style');
        style.textContent = `
            #upload-progress-modal .progress-container {
                background: white;
                border-radius: 20px;
                padding: 25px;
                text-align: center;
                min-width: 220px;
            }
            #upload-progress-modal .progress-circle {
                position: relative;
                width: 100px;
                height: 100px;
                margin: 0 auto;
            }
            #upload-progress-modal .progress-circle svg {
                width: 100%;
                height: 100%;
                transform: rotate(-90deg);
            }
            #upload-progress-modal .progress-fill {
                transition: stroke-dashoffset 0.2s;
            }
            #upload-progress-modal .progress-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 18px;
                font-weight: bold;
                color: #333;
            }
            #upload-progress-modal .progress-subtext {
                text-align: center;
                margin-top: 12px;
                color: #666;
                font-size: 13px;
            }
            #upload-progress-modal .cancel-btn {
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 30px;
                padding: 8px 25px;
                margin-top: 15px;
                cursor: pointer;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }
    
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    
    modal.innerHTML = `
        <div class="progress-container">
            <div class="progress-circle">
                <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#ddd" stroke-width="6"/>
                    <circle class="progress-fill" cx="50" cy="50" r="45" fill="none" stroke="#32CD32" stroke-width="6" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" stroke-linecap="round"/>
                </svg>
                <div class="progress-text">0%</div>
            </div>
            <div class="progress-subtext">Загрузка...</div>
            <button class="cancel-btn" id="cancel-upload">Отменить</button>
        </div>
    `;
    modal.style.display = 'flex';
    
    const cancelBtn = document.getElementById('cancel-upload');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (currentUploadXhr) {
                currentUploadXhr.abort();
                closeCircularProgress();
                showNotification('Загрузка отменена', 'info');
            }
        };
    }
}

function updateCircularProgress(percent) {
    const circle = document.querySelector('#upload-progress-modal .progress-fill');
    const text = document.querySelector('#upload-progress-modal .progress-text');
    if (circle && text) {
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - percent / 100);
        circle.style.strokeDashoffset = offset;
        text.textContent = Math.round(percent) + '%';
    }
}

function closeCircularProgress() {
    const modal = document.getElementById('upload-progress-modal');
    if (modal) modal.style.display = 'none';
    currentUploadXhr = null;
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        sendAnyFile(file);
        event.target.value = '';
        return;
    }
    
    pendingImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
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

// Send photo with circular progress
async function confirmImageSend() {
    if (!pendingImageFile || !currentChatId) {
        showNotification('Ошибка отправки', 'error');
        closeImagePreview();
        return;
    }
    
    const caption = document.getElementById('image-caption').value.trim();
    const file = pendingImageFile;
    
    closeImagePreview();
    showCircularProgress();
    
    try {
        updateCircularProgress(10);
        const url = await uploadToReeImage(file);
        updateCircularProgress(100);
        
        const message = {
            type: 'image',
            imageUrl: url,
            caption: caption,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref('messages/' + currentChatId).push(message);
        
        const lastMsg = caption ? '📷 ' + caption.substring(0, 47) : '📷 Фото';
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        closeCircularProgress();
        showNotification('Фото отправлено!', 'success');
    } catch (error) {
        closeCircularProgress();
        console.error('Upload error:', error);
        showNotification('Ошибка загрузки фото: ' + (error.message || 'Проверьте соединение'), 'error');
    }
}

// Send any file (non-image) with circular progress
async function sendAnyFile(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showCircularProgress();
    
    try {
        updateCircularProgress(10);
        const url = await uploadToReeImage(file);
        updateCircularProgress(100);
        
        const message = file.type.startsWith('audio/') ? {
            type: 'audio', audioUrl: url, senderId: currentUser.uid, timestamp: firebase.database.ServerValue.TIMESTAMP
        } : {
            type: 'file', fileName: file.name, fileUrl: url, fileSize: file.size, senderId: currentUser.uid, timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref('messages/' + currentChatId).push(message);
        await database.ref('chats/' + currentChatId).update({
            lastMessage: file.type.startsWith('audio/') ? '🎤 Голосовое' : '📎 ' + file.name,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        closeCircularProgress();
        showNotification('Файл отправлен!', 'success');
    } catch (error) {
        closeCircularProgress();
        console.error('Upload error:', error);
        showNotification('Ошибка загрузки файла', 'error');
    }
}

// Voice messages
let mediaRecorder, audioChunks, isRecording = false;

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
                sendAnyFile(file);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            const btn = document.getElementById('voice-record-btn');
            if (btn) btn.classList.add('recording');
        })
        .catch(() => showNotification('Нет доступа к микрофону', 'error'));
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        const btn = document.getElementById('voice-record-btn');
        if (btn) btn.classList.remove('recording');
    }
}

// Avatars
function previewGroupAvatar(e) {
    const file = e.target.files[0];
    if (file) {
        groupAvatarFile = file;
        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('group-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('group-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('group-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewChannelAvatar(e) {
    const file = e.target.files[0];
    if (file) {
        channelAvatarFile = file;
        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('channel-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('channel-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('channel-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewEditAvatar(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('edit-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('edit-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('edit-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
        window.pendingAvatarFile = file;
    }
}

// Helper function to test API
window.testReeImage = async function() {
    const testBlob = new Blob(['test'], { type: 'image/png' });
    const testFile = new File([testBlob], 'test.png', { type: 'image/png' });
    try {
        const url = await uploadToReeImage(testFile);
        console.log('✅ reeImage.host работает! URL:', url);
        showNotification('reeImage.host работает!', 'success');
    } catch(e) {
        console.error('❌ Ошибка reeImage.host:', e);
        showNotification('Ошибка соединения с reeImage.host', 'error');
    }
};

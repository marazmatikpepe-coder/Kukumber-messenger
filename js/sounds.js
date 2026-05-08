// SOUNDS.JS - звуки для мессенджера

// Создаём аудио объекты
var sendSound = null;
var receiveSound = null;

// Инициализация звуков (вызови при загрузке страницы)
function initSounds() {
    // Звук отправки сообщения
    sendSound = new Audio();
    sendSound.src = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3';
    // Если не работает, запасной вариант
    sendSound.onerror = function() {
        console.log('Звук отправки не загружен, использую резервный');
        sendSound.src = 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8f7c6b7.mp3';
    };
    
    // Звук получения сообщения
    receiveSound = new Audio();
    receiveSound.src = 'https://www.soundjay.com/misc/sounds/notification-01.mp3';
    receiveSound.onerror = function() {
        console.log('Звук получения не загружен, использую резервный');
        receiveSound.src = 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_3c8f5e6c7d.mp3';
    };
    
    // Предзагрузка
    sendSound.load();
    receiveSound.load();
}

// Воспроизведение звука отправки
function playSendSound() {
    if (!sendSound) initSounds();
    try {
        sendSound.currentTime = 0;
        sendSound.play().catch(function(e) { console.log('Звук не воспроизведён:', e); });
    } catch(e) { console.log('Ошибка звука:', e); }
}

// Воспроизведение звука получения
function playReceiveSound() {
    if (!receiveSound) initSounds();
    try {
        receiveSound.currentTime = 0;
        receiveSound.play().catch(function(e) { console.log('Звук не воспроизведён:', e); });
    } catch(e) { console.log('Ошибка звука:', e); }
}

// Включить/выключить звуки
var soundsEnabled = localStorage.getItem('sounds_enabled') !== 'false';

function toggleSounds() {
    soundsEnabled = !soundsEnabled;
    localStorage.setItem('sounds_enabled', soundsEnabled);
    showNotification(soundsEnabled ? 'Звуки включены' : 'Звуки выключены', 'info');
}

function getSoundsEnabled() {
    return soundsEnabled;
}

// SOUNDS.JS - звуки для мессенджера
// Звук отправки сообщения/создания слайса
// Звук получения сообщения

// Создаём аудио объекты
var sendSound = null;
var receiveSound = null;
var sliceCreateSound = null;

// URL твоих звуков
var SEND_SOUND_URL = 'https://s33.aconvert.com/convert/p3r68-cdx67/rvt3w-3afhb.mp3';
var RECEIVE_SOUND_URL = 'https://s33.aconvert.com/convert/p3r68-cdx67/stzi2-lrg6l.mp3';

// Инициализация звуков
function initSounds() {
    // Звук отправки
    sendSound = new Audio();
    sendSound.src = SEND_SOUND_URL;
    sendSound.load();
    sendSound.onerror = function() {
        console.warn('Не удалось загрузить звук отправки');
    };
    
    // Звук получения
    receiveSound = new Audio();
    receiveSound.src = RECEIVE_SOUND_URL;
    receiveSound.load();
    receiveSound.onerror = function() {
        console.warn('Не удалось загрузить звук получения');
    };
    
    // Звук создания слайса (используем тот же, что и отправка)
    sliceCreateSound = new Audio();
    sliceCreateSound.src = SEND_SOUND_URL;
    sliceCreateSound.load();
    
    console.log('Звуки инициализированы');
}

// Воспроизведение звука отправки
function playSendSound() {
    if (!soundsEnabled) return;
    if (!sendSound) initSounds();
    try {
        sendSound.currentTime = 0;
        sendSound.play().catch(function(e) {
            console.log('Звук отправки не воспроизведён:', e);
        });
    } catch(e) {
        console.log('Ошибка воспроизведения звука отправки:', e);
    }
}

// Воспроизведение звука получения
function playReceiveSound() {
    if (!soundsEnabled) return;
    if (!receiveSound) initSounds();
    try {
        receiveSound.currentTime = 0;
        receiveSound.play().catch(function(e) {
            console.log('Звук получения не воспроизведён:', e);
        });
    } catch(e) {
        console.log('Ошибка воспроизведения звука получения:', e);
    }
}

// Воспроизведение звука создания слайса
function playSliceCreateSound() {
    if (!soundsEnabled) return;
    if (!sliceCreateSound) initSounds();
    try {
        sliceCreateSound.currentTime = 0;
        sliceCreateSound.play().catch(function(e) {
            console.log('Звук создания слайса не воспроизведён:', e);
        });
    } catch(e) {
        console.log('Ошибка воспроизведения звука создания слайса:', e);
    }
}

// Настройки звуков
var soundsEnabled = localStorage.getItem('sounds_enabled') !== 'false';

// Включить/выключить звуки
function toggleSounds() {
    soundsEnabled = !soundsEnabled;
    localStorage.setItem('sounds_enabled', soundsEnabled);
    showNotification(soundsEnabled ? '🔊 Звуки включены' : '🔇 Звуки выключены', 'info');
}

// Получить статус звуков
function getSoundsEnabled() {
    return soundsEnabled;
}

// Автоматическая инициализация при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initSounds();
    });
} else {
    initSounds();
}

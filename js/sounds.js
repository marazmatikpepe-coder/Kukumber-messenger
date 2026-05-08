// SOUNDS.JS - звуки для мессенджера
var sendSound = null;
var receiveSound = null;

var SEND_SOUND_URL = 'https://s33.aconvert.com/convert/p3r68-cdx67/rvt3w-3afhb.mp3';
var RECEIVE_SOUND_URL = 'https://s33.aconvert.com/convert/p3r68-cdx67/stzi2-lrg6l.mp3';

function initSounds() {
    try {
        sendSound = new Audio(SEND_SOUND_URL);
        sendSound.load();
        receiveSound = new Audio(RECEIVE_SOUND_URL);
        receiveSound.load();
        console.log('Звуки инициализированы');
    } catch(e) {
        console.log('Ошибка инициализации звуков:', e);
    }
}

function playSendSound() {
    if (sendSound) {
        try {
            sendSound.currentTime = 0;
            sendSound.play().catch(function(e) { console.log('Звук отправки заблокирован:', e); });
        } catch(e) { console.log('Ошибка звука:', e); }
    }
}

function playReceiveSound() {
    if (receiveSound) {
        try {
            receiveSound.currentTime = 0;
            receiveSound.play().catch(function(e) { console.log('Звук получения заблокирован:', e); });
        } catch(e) { console.log('Ошибка звука:', e); }
    }
}

// Инициализация
initSounds();

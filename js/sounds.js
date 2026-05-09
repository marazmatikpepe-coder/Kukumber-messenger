// KUKUMBER SOUNDS - единый работающий модуль
var KukumberSounds = {
    sendSound: null,
    receiveSound: null,
    enabled: true,
    initialized: false,

    init: function() {
        if (this.initialized) return;
        
        try {
            // Короткие беззвучные аудио для "разрешения" автоплейса
            var silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQs8AAAdHAAAAhQEQgAIAICAKBwQAgOB4JBgIAkEg0Gg2GwKBQKBQqFQwGAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgEAgF/80DE8AAAaUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+1DE9AAADaQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
            silentAudio.volume = 0;
            silentAudio.play().catch(function() {});
            
            this.sendSound = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
            this.receiveSound = new Audio('https://www.soundjay.com/misc/sounds/notification-2.mp3');
            
            this.sendSound.load();
            this.receiveSound.load();
            this.sendSound.volume = 0.5;
            this.receiveSound.volume = 0.5;
            
            // Загружаем настройку
            var saved = localStorage.getItem('kukumber_sounds_enabled');
            if (saved !== null) this.enabled = saved === 'true';
            
            this.initialized = true;
            console.log('Звуки инициализированы');
        } catch(e) {
            console.log('Ошибка инициализации звуков:', e);
        }
    },
    
    playSend: function() {
        if (!this.initialized) this.init();
        if (!this.enabled) return;
        if (this.sendSound) {
            try {
                this.sendSound.currentTime = 0;
                this.sendSound.play().catch(function(e) { console.log('Звук отправки заблокирован:', e); });
            } catch(e) {}
        }
    },
    
    playReceive: function() {
        if (!this.initialized) this.init();
        if (!this.enabled) return;
        if (this.receiveSound) {
            try {
                this.receiveSound.currentTime = 0;
                this.receiveSound.play().catch(function(e) { console.log('Звук получения заблокирован:', e); });
            } catch(e) {}
        }
    },
    
    toggle: function() {
        this.enabled = !this.enabled;
        localStorage.setItem('kukumber_sounds_enabled', this.enabled);
        return this.enabled;
    },
    
    isEnabled: function() {
        return this.enabled;
    }
};

// Глобальные функции для совместимости
function initSounds() { KukumberSounds.init(); }
function playSendSound() { KukumberSounds.playSend(); }
function playReceiveSound() { KukumberSounds.playReceive(); }
function getSoundsEnabled() { return KukumberSounds.isEnabled(); }
function toggleSounds() { KukumberSounds.toggle(); }

// Автоинициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    KukumberSounds.init();
});

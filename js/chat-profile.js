<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clip-аю — Видеомонтаж</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,600;14..32,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(145deg, #0a0c12 0%, #10141e 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        /* SPLASH SCREEN */
        .splash-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at 20% 30%, #0b0e17, #03050a);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            transition: opacity 0.8s ease;
        }

        .splash-logo {
            width: 180px;
            height: auto;
            filter: drop-shadow(0 20px 30px rgba(0,0,0,0.6));
            animation: floatLogo 1.8s infinite alternate ease-in-out;
        }

        @keyframes floatLogo {
            0% { transform: translateY(0px); }
            100% { transform: translateY(-12px); }
        }

        .splash-title {
            font-size: 2rem;
            font-weight: 700;
            margin-top: 30px;
            background: linear-gradient(135deg, #FFE6B0, #FFB347);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }

        .loader {
            margin-top: 40px;
            width: 60px;
            height: 60px;
            border: 5px solid rgba(255,180,70,0.2);
            border-top: 5px solid #FFB347;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* APP CONTAINER */
        .app-container {
            width: 1300px;
            max-width: 98vw;
            background: rgba(18, 22, 35, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 48px;
            border: 1px solid rgba(255, 200, 120, 0.25);
            box-shadow: 0 25px 45px rgba(0,0,0,0.5);
            overflow: hidden;
        }

        .app-header {
            padding: 20px 28px;
            border-bottom: 1px solid rgba(255,180,70,0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo-mini {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-mini img {
            width: 45px;
            height: 45px;
            object-fit: contain;
            border-radius: 16px;
        }

        .logo-mini span {
            font-size: 1.7rem;
            font-weight: 700;
            background: linear-gradient(135deg, #FFD966, #FF9F2E);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }

        .new-project-btn {
            background: rgba(255,180,70,0.15);
            border: 1px solid rgba(255,180,70,0.5);
            padding: 10px 20px;
            border-radius: 40px;
            color: #FFC97A;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
        }

        .new-project-btn:hover {
            background: #FFB347;
            color: #0f1119;
        }

        .editor-area {
            padding: 20px 28px;
        }

        .video-preview {
            background: #000000aa;
            border-radius: 32px;
            padding: 16px;
            border: 1px solid rgba(255,200,100,0.3);
        }

        .video-wrapper {
            background: #000;
            border-radius: 24px;
            overflow: hidden;
            display: flex;
            justify-content: center;
        }

        video {
            width: 100%;
            max-height: 55vh;
            object-fit: contain;
            display: block;
        }

        .timeline-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 14px;
            padding: 0 8px;
        }

        .chrono {
            font-family: monospace;
            font-size: 1.3rem;
            font-weight: 600;
            background: #1e1f2c;
            padding: 5px 15px;
            border-radius: 40px;
            color: #FFE0A3;
        }

        .play-pause-btn {
            background: #FFB347;
            border: none;
            width: 52px;
            height: 52px;
            border-radius: 60px;
            font-size: 1.7rem;
            color: #1e1f2c;
            cursor: pointer;
            transition: 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .play-pause-btn:hover {
            transform: scale(1.05);
            background: #FFC46B;
        }

        .timeline-track {
            margin-top: 28px;
            background: #0c0f18b3;
            border-radius: 28px;
            padding: 20px;
        }

        .track-label {
            font-size: 0.8rem;
            text-transform: uppercase;
            color: #FFC285;
            margin-bottom: 12px;
        }

        .clips-list {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            min-height: 100px;
        }

        .clip-item {
            background: #181e2c;
            border-radius: 20px;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            gap: 14px;
            border-left: 4px solid #FFB347;
            cursor: grab;
            user-select: none;
        }

        .clip-item:active {
            cursor: grabbing;
        }

        .clip-thumb {
            width: 55px;
            height: 55px;
            background: #2a2f3f;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFB347;
            font-size: 1.8rem;
        }

        .clip-info {
            display: flex;
            flex-direction: column;
        }

        .clip-name {
            font-weight: 600;
            font-size: 0.85rem;
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .clip-duration {
            font-size: 0.7rem;
            color: #bbb;
        }

        .speed-badge {
            background: #2a2e3e;
            border-radius: 30px;
            padding: 2px 8px;
            font-size: 0.7rem;
            font-weight: bold;
            color: #FFD966;
            margin-top: 4px;
        }

        .clip-actions {
            display: flex;
            gap: 8px;
        }

        .icon-btn {
            background: none;
            border: none;
            color: #ffb86b;
            font-size: 1rem;
            cursor: pointer;
            padding: 5px;
            border-radius: 8px;
            transition: 0.1s;
        }

        .icon-btn:hover {
            background: #ffffff20;
        }

        .add-video-btn {
            background: rgba(255,180,70,0.2);
            border: 1px dashed #FFB347;
            border-radius: 48px;
            padding: 12px 22px;
            margin-top: 16px;
            display: inline-flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            color: #FFC285;
            font-weight: 500;
        }

        .add-video-btn:hover {
            background: #FFB34720;
        }

        .empty-track {
            color: #aaa;
            font-style: italic;
            padding: 20px;
            text-align: center;
        }

        /* NO PROJECT PLACEHOLDER */
        .no-project-placeholder {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 500px;
            flex-direction: column;
            gap: 30px;
        }

        .big-plus-btn {
            background: none;
            border: 2px solid #FFB347;
            width: 180px;
            height: 180px;
            border-radius: 48px;
            font-size: 5rem;
            color: #FFB347;
            cursor: pointer;
            transition: 0.2s;
        }

        .big-plus-btn:hover {
            background: #FFB34720;
            transform: scale(1.02);
        }

        /* MODAL */
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000000cc;
            backdrop-filter: blur(12px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            visibility: hidden;
            opacity: 0;
            transition: 0.2s;
        }

        .modal.active {
            visibility: visible;
            opacity: 1;
        }

        .modal-card {
            background: #1a1e2c;
            border-radius: 48px;
            padding: 30px;
            width: 340px;
            text-align: center;
            border: 1px solid #FFB34780;
        }

        .modal-card h2 {
            color: #FFE0A3;
            margin-bottom: 20px;
        }

        .modal-card input {
            background: #0e111b;
            border: 1px solid #FFB347;
            padding: 14px;
            border-radius: 60px;
            width: 100%;
            margin: 20px 0;
            color: white;
            font-size: 1rem;
            outline: none;
        }

        .modal-card button {
            background: #FFB347;
            border: none;
            padding: 12px 24px;
            border-radius: 40px;
            font-weight: bold;
            cursor: pointer;
            font-size: 1rem;
        }

        .modal-card button:hover {
            background: #FFC46B;
        }
    </style>
</head>
<body>

<!-- SPLASH -->
<div class="splash-screen" id="splashScreen">
    <img class="splash-logo" src="https://i.ibb.co/fGBMHT6m/image-Photoroom-2.png" alt="Clip-аю">
    <div class="splash-title">Clip-аю</div>
    <div class="loader"></div>
    <div style="margin-top: 32px; color: #FFD68A;">видеомонтаж с душой</div>
</div>

<!-- MAIN APP -->
<div class="app-container" id="appContainer" style="display: none;">
    <div class="app-header">
        <div class="logo-mini">
            <img src="https://i.ibb.co/fGBMHT6m/image-Photoroom-2.png" alt="лого">
            <span>Clip-аю</span>
        </div>
        <div class="new-project-btn" id="newProjectBtn">
            <i class="fas fa-folder-open"></i> Новый проект
        </div>
    </div>

    <div id="mainContent"></div>
</div>

<!-- MODAL -->
<div class="modal" id="projectModal">
    <div class="modal-card">
        <h2>✨ Новый проект</h2>
        <input type="text" id="projectNameInput" placeholder="Название проекта" value="Мой монтаж">
        <button id="confirmCreateBtn">Создать проект</button>
    </div>
</div>

<script>
    // Состояние
    let currentProject = null;
    let currentClipIndex = 0;
    let videoPlayer = null;

    // DOM элементы
    const splash = document.getElementById('splashScreen');
    const appContainer = document.getElementById('appContainer');
    const mainContent = document.getElementById('mainContent');
    const newProjectBtn = document.getElementById('newProjectBtn');
    const projectModal = document.getElementById('projectModal');
    const confirmCreateBtn = document.getElementById('confirmCreateBtn');
    const projectNameInput = document.getElementById('projectNameInput');

    // Утилиты
    function formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Рендер главного экрана редактора
    function renderEditor() {
        if (!currentProject) {
            // Показать заглушку с большой кнопкой плюс
            mainContent.innerHTML = `
                <div class="no-project-placeholder">
                    <div style="background: #FFB34720; border-radius: 80px; padding: 20px;">
                        <i class="fas fa-plus" style="font-size: 70px; color: #FFB347;"></i>
                    </div>
                    <p style="color: #FFDEB3; font-size: 1.3rem;">Создайте проект монтажа</p>
                    <button class="big-plus-btn" id="bigPlusBtn">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
            const bigPlusBtn = document.getElementById('bigPlusBtn');
            if (bigPlusBtn) {
                bigPlusBtn.onclick = () => projectModal.classList.add('active');
            }
            return;
        }

        // Показать редактор с видео
        const hasClips = currentProject.clips.length > 0;
        const currentClip = hasClips ? currentProject.clips[currentClipIndex] : null;
        
        mainContent.innerHTML = `
            <div class="editor-area">
                <div class="video-preview">
                    <div class="video-wrapper">
                        <video id="mainVideo" controlsList="nodownload"></video>
                    </div>
                    <div class="timeline-info">
                        <div class="chrono" id="chronoDisplay">00:00 / 00:00</div>
                        <button class="play-pause-btn" id="playPauseBtn">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </div>

                <div class="timeline-track">
                    <div class="track-label">
                        <i class="fas fa-layer-group"></i> Дорожка клипов (перетащи чтобы менять порядок)
                    </div>
                    <div class="clips-list" id="clipsList"></div>
                    <div class="add-video-btn" id="addVideoBtn">
                        <i class="fas fa-plus-circle"></i> Загрузить видеофайл
                    </div>
                </div>
            </div>
        `;

        // Инициализация плеера после рендера
        videoPlayer = document.getElementById('mainVideo');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const chronoDisplay = document.getElementById('chronoDisplay');
        const addVideoBtn = document.getElementById('addVideoBtn');
        const clipsList = document.getElementById('clipsList');

        // Загрузить текущий клип
        if (hasClips && currentClip) {
            videoPlayer.src = currentClip.url;
            videoPlayer.load();
            videoPlayer.playbackRate = currentClip.speed;
            videoPlayer.ontimeupdate = () => {
                if (chronoDisplay) {
                    const current = videoPlayer.currentTime || 0;
                    const duration = videoPlayer.duration || 0;
                    chronoDisplay.innerText = `${formatTime(current)} / ${formatTime(duration)}`;
                }
            };
            videoPlayer.onloadedmetadata = () => {
                if (chronoDisplay) {
                    chronoDisplay.innerText = `00:00 / ${formatTime(videoPlayer.duration)}`;
                }
            };
        } else {
            if (videoPlayer) videoPlayer.src = "";
            if (chronoDisplay) chronoDisplay.innerText = "00:00 / 00:00";
        }

        // Play/Pause
        if (playPauseBtn) {
            playPauseBtn.onclick = () => {
                if (!videoPlayer) return;
                if (videoPlayer.paused) {
                    videoPlayer.play();
                    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                } else {
                    videoPlayer.pause();
                    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            };
            
            if (videoPlayer) {
                videoPlayer.onplay = () => playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                videoPlayer.onpause = () => playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        }

        // Рендер списка клипов
        function renderClips() {
            if (!clipsList) return;
            if (currentProject.clips.length === 0) {
                clipsList.innerHTML = '<div class="empty-track"><i class="fas fa-video-slash"></i> Нет клипов. Загрузите видео.</div>';
                return;
            }

            clipsList.innerHTML = '';
            currentProject.clips.forEach((clip, idx) => {
                const clipDiv = document.createElement('div');
                clipDiv.className = 'clip-item';
                clipDiv.setAttribute('draggable', 'true');
                clipDiv.setAttribute('data-idx', idx);
                clipDiv.innerHTML = `
                    <div class="clip-thumb"><i class="fas fa-film"></i></div>
                    <div class="clip-info">
                        <div class="clip-name">${escapeHtml(clip.name.substring(0, 20))}</div>
                        <div class="clip-duration">${formatTime(clip.duration)}</div>
                        <div class="speed-badge"><i class="fas fa-tachometer-alt"></i> ${clip.speed}x</div>
                    </div>
                    <div class="clip-actions">
                        <button class="icon-btn speed-btn" data-idx="${idx}" title="Скорость"><i class="fas fa-gauge-high"></i></button>
                        <button class="icon-btn trim-btn" data-idx="${idx}" title="Обрезать"><i class="fas fa-cut"></i></button>
                        <button class="icon-btn delete-btn" data-idx="${idx}" title="Удалить"><i class="fas fa-trash"></i></button>
                    </div>
                `;

                // Drag & Drop
                clipDiv.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', idx);
                    clipDiv.style.opacity = '0.5';
                });
                clipDiv.addEventListener('dragend', () => { clipDiv.style.opacity = ''; });
                clipDiv.addEventListener('dragover', (e) => e.preventDefault());
                clipDiv.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIdx = idx;
                    if (fromIdx !== toIdx) {
                        const newClips = [...currentProject.clips];
                        [newClips[fromIdx], newClips[toIdx]] = [newClips[toIdx], newClips[fromIdx]];
                        currentProject.clips = newClips;
                        if (currentClipIndex === fromIdx) currentClipIndex = toIdx;
                        else if (currentClipIndex === toIdx) currentClipIndex = fromIdx;
                        renderEditor(); // перерендер
                    }
                });

                clipsList.appendChild(clipDiv);
            });

            // Добавить обработчики
            document.querySelectorAll('.speed-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.idx);
                    const newSpeed = parseFloat(prompt('Введите скорость (0.25 - 4.0):', currentProject.clips[idx].speed));
                    if (!isNaN(newSpeed) && newSpeed >= 0.25 && newSpeed <= 4) {
                        currentProject.clips[idx].speed = newSpeed;
                        if (currentClipIndex === idx && videoPlayer) {
                            videoPlayer.playbackRate = newSpeed;
                        }
                        renderEditor();
                    }
                };
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.idx);
                    const removed = currentProject.clips[idx];
                    if (removed.url && removed.url.startsWith('blob:')) {
                        URL.revokeObjectURL(removed.url);
                    }
                    currentProject.clips.splice(idx, 1);
                    if (currentProject.clips.length === 0) {
                        currentClipIndex = 0;
                        renderEditor();
                    } else {
                        if (currentClipIndex >= idx) currentClipIndex = Math.max(0, currentClipIndex - 1);
                        if (currentClipIndex >= currentProject.clips.length) currentClipIndex = currentProject.clips.length - 1;
                        renderEditor();
                    }
                };
            });

            document.querySelectorAll('.trim-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.idx);
                    const clip = currentProject.clips[idx];
                    const start = parseFloat(prompt(`Начало обрезки (0-${clip.duration.toFixed(1)}):`, '0'));
                    const end = parseFloat(prompt(`Конец обрезки (0-${clip.duration.toFixed(1)}):`, clip.duration.toFixed(1)));
                    if (!isNaN(start) && !isNaN(end) && start >= 0 && end <= clip.duration && start < end) {
                        clip.trimStart = start;
                        clip.trimEnd = end;
                        alert(`Клип обрезан! Будет воспроизводиться с ${start.toFixed(1)}с по ${end.toFixed(1)}с`);
                        if (currentClipIndex === idx && videoPlayer) {
                            videoPlayer.currentTime = start;
                        }
                        renderEditor();
                    } else {
                        alert('Некорректные значения');
                    }
                };
            });
        }

        renderClips();

        // Добавить видео
        if (addVideoBtn) {
            addVideoBtn.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/mp4,video/webm,video/quicktime';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const url = URL.createObjectURL(file);
                        const tempVideo = document.createElement('video');
                        tempVideo.preload = 'metadata';
                        tempVideo.onloadedmetadata = () => {
                            const newClip = {
                                id: Date.now(),
                                name: file.name,
                                url: url,
                                duration: tempVideo.duration,
                                speed: 1.0,
                                trimStart: 0,
                                trimEnd: tempVideo.duration
                            };
                            currentProject.clips.push(newClip);
                            if (currentProject.clips.length === 1) {
                                currentClipIndex = 0;
                            }
                            renderEditor();
                            tempVideo.remove();
                        };
                        tempVideo.src = url;
                        tempVideo.load();
                    }
                };
                input.click();
            };
        }

        // Если есть клипы и videoPlayer, обрабатываем обрезку в ontimeupdate
        if (videoPlayer && currentClip && currentClip.trimEnd !== undefined) {
            const start = currentClip.trimStart || 0;
            const end = currentClip.trimEnd || currentClip.duration;
            videoPlayer.currentTime = start;
            videoPlayer.ontimeupdate = () => {
                if (videoPlayer.currentTime >= end) {
                    videoPlayer.pause();
                    videoPlayer.currentTime = start;
                    const ppBtn = document.getElementById('playPauseBtn');
                    if (ppBtn) ppBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
                if (chronoDisplay) {
                    chronoDisplay.innerText = `${formatTime(videoPlayer.currentTime)} / ${formatTime(end - start)}`;
                }
            };
        }
    }

    // Создать проект
    function createProject(name) {
        if (currentProject && currentProject.clips) {
            currentProject.clips.forEach(c => {
                if (c.url && c.url.startsWith('blob:')) URL.revokeObjectURL(c.url);
            });
        }
        currentProject = {
            name: name,
            clips: []
        };
        currentClipIndex = 0;
        renderEditor();
    }

    // Экранирование
    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // Инициализация и splash screen
    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
            appContainer.style.display = 'block';
            renderEditor();
        }, 800);
    }, 1500);

    // Обработчики модалки
    newProjectBtn.onclick = () => projectModal.classList.add('active');
    confirmCreateBtn.onclick = () => {
        const name = projectNameInput.value.trim();
        if (name) {
            createProject(name);
            projectModal.classList.remove('active');
        } else {
            createProject('Мой проект');
            projectModal.classList.remove('active');
        }
    };

    // Закрытие модалки по клику вне
    projectModal.onclick = (e) => {
        if (e.target === projectModal) {
            projectModal.classList.remove('active');
        }
    };
</script>
</body>
</html>

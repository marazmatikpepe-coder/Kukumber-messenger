// SLICES (Слайсы) - социальная лента постов
var currentSlicesTab = 'feed';
var viewingSliceId = null;
var pendingSliceFiles = [];
var currentSliceIndex = 0;
var searchTimeout = null;

// Загрузка ленты
function loadSlices() {
    var feed = document.getElementById('slices-feed');
    feed.innerHTML = '<div class="empty-slices"><span>🍕</span><p>Загрузка...</p></div>';
    
    var query = database.ref('slices').orderByChild('createdAt').limitToLast(50);
    
    query.once('value').then(function(snapshot) {
        var slices = snapshot.val();
        feed.innerHTML = '';
        
        if (!slices) {
            feed.innerHTML = '<div class="empty-slices"><span>🍕</span><p>Пока нет постов</p><p>Будьте первым!</p></div>';
            return;
        }
        
        var slicesArray = [];
        for (var id in slices) {
            slicesArray.push({ id: id, data: slices[id] });
        }
        
        slicesArray.sort(function(a, b) {
            return (b.data.createdAt || 0) - (a.data.createdAt || 0);
        });
        
        slicesArray.forEach(function(slice) {
            var card = createSliceCard(slice.id, slice.data);
            feed.appendChild(card);
        });
    });
}

// Создание карточки поста
function createSliceCard(sliceId, sliceData) {
    var div = document.createElement('div');
    div.className = 'slice-card';
    div.setAttribute('data-slice-id', sliceId);
    
    // Шапка: аватар + имя + дата
    var avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
    var avatarContent = sliceData.authorAvatar ? '' : '👤';
    
    var mediaHtml = '';
    if (sliceData.mediaType === 'multiple') {
        // Несколько фото/гиф
        mediaHtml = '<div class="slice-media-multiple" id="slice-media-'+sliceId+'">';
        mediaHtml += '<div class="slice-media-slider">';
        sliceData.mediaUrls.forEach(function(url, idx) {
            var isGif = url.toLowerCase().endsWith('.gif');
            if (isGif) {
                mediaHtml += '<div class="slice-slide"><img src="'+url+'" class="slice-gif" loading="lazy" onclick="openSliceLightbox(\''+url+'\')"></div>';
            } else {
                mediaHtml += '<div class="slice-slide"><img src="'+url+'" class="slice-image" loading="lazy" onclick="openSliceLightbox(\''+url+'\')"></div>';
            }
        });
        mediaHtml += '</div>';
        if (sliceData.mediaUrls.length > 1) {
            mediaHtml += '<button class="slice-slider-prev" onclick="slideSlice(\''+sliceId+'\', -1)">←</button>';
            mediaHtml += '<button class="slice-slider-next" onclick="slideSlice(\''+sliceId+'\', 1)">→</button>';
            mediaHtml += '<div class="slice-slider-dots" id="slice-dots-'+sliceId+'"></div>';
        }
        mediaHtml += '</div>';
    } else {
        var isGif = sliceData.mediaUrl && sliceData.mediaUrl.toLowerCase().endsWith('.gif');
        if (isGif) {
            mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-gif" loading="lazy" onclick="openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
        } else {
            mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-image" loading="lazy" onclick="openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
        }
    }
    
    // Текст поста
    var textHtml = sliceData.text ? '<div class="slice-text">'+formatSliceText(sliceData.text)+'</div>' : '';
    
    // Хештеги
    var hashtagsHtml = '';
    if (sliceData.hashtags && sliceData.hashtags.length) {
        hashtagsHtml = '<div class="slice-hashtags">';
        sliceData.hashtags.forEach(function(tag) {
            hashtagsHtml += '<span class="slice-hashtag" onclick="searchByHashtag(\''+tag+'\')">#'+tag+'</span>';
        });
        hashtagsHtml += '</div>';
    }
    
    div.innerHTML = `
        <div class="slice-header">
            <div class="slice-author">
                <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="slice-author-info">
                    <span class="slice-author-name">${escapeHtml(sliceData.authorName)}</span>
                    <span class="slice-date">${formatSliceDate(sliceData.createdAt)}</span>
                </div>
            </div>
            <div class="slice-views">
                <span class="slice-views-count">👁️ ${sliceData.viewsCount || 0}</span>
            </div>
        </div>
        ${mediaHtml}
        ${textHtml}
        ${hashtagsHtml}
        <div class="slice-actions">
            <div class="slice-actions-left">
                <button class="slice-action-btn like-btn ${sliceData.userLiked ? 'liked' : ''}" onclick="likeSlice('${sliceId}')">
                    ❤️ <span class="like-count">${sliceData.likesCount || 0}</span>
                </button>
                <button class="slice-action-btn" onclick="showSliceComments('${sliceId}')">
                    💬 <span class="comment-count">${sliceData.commentsCount || 0}</span>
                </button>
                <button class="slice-action-btn" onclick="repostSlice('${sliceId}')">
                    🔁 <span class="repost-count">${sliceData.repostsCount || 0}</span>
                </button>
            </div>
            <div class="slice-actions-right">
                <button class="slice-action-btn" onclick="shareSlice('${sliceId}')">↗️</button>
            </div>
        </div>
    `;
    
    // Инициализация слайдера если несколько фото
    if (sliceData.mediaType === 'multiple' && sliceData.mediaUrls.length > 1) {
        setTimeout(function() {
            initSliceSlider(sliceId, sliceData.mediaUrls.length);
        }, 100);
    }
    
    return div;
}

// Инициализация слайдера
function initSliceSlider(sliceId, totalSlides) {
    var container = document.getElementById('slice-media-' + sliceId);
    if (!container) return;
    
    var slider = container.querySelector('.slice-media-slider');
    var dotsContainer = document.getElementById('slice-dots-' + sliceId);
    
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        for (var i = 0; i < totalSlides; i++) {
            var dot = document.createElement('span');
            dot.className = 'slice-dot' + (i === 0 ? ' active' : '');
            dot.onclick = (function(idx) { return function() { goToSlide(sliceId, idx); }; })(i);
            dotsContainer.appendChild(dot);
        }
    }
    
    window['sliceCurrentIndex_' + sliceId] = 0;
    window['sliceTotal_' + sliceId] = totalSlides;
}

function slideSlice(sliceId, direction) {
    var current = window['sliceCurrentIndex_' + sliceId] || 0;
    var total = window['sliceTotal_' + sliceId] || 1;
    var newIndex = current + direction;
    
    if (newIndex < 0) newIndex = total - 1;
    if (newIndex >= total) newIndex = 0;
    
    goToSlide(sliceId, newIndex);
}

function goToSlide(sliceId, index) {
    var container = document.getElementById('slice-media-' + sliceId);
    if (!container) return;
    
    var slider = container.querySelector('.slice-media-slider');
    var slides = slider.querySelectorAll('.slice-slide');
    var dots = document.querySelectorAll('#slice-dots-' + sliceId + ' .slice-dot');
    
    if (!slides.length) return;
    
    var slideWidth = slides[0].offsetWidth;
    slider.style.transform = 'translateX(-' + (index * slideWidth) + 'px)';
    
    dots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === index);
    });
    
    window['sliceCurrentIndex_' + sliceId] = index;
}

// Форматирование текста
function formatSliceText(text) {
    if (!text) return '';
    // Ссылки
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    // Упоминания
    text = text.replace(/@(\w+)/g, '<span class="slice-mention" onclick="searchByUser(\'$1\')">@$1</span>');
    return text;
}

// Форматирование даты
function formatSliceDate(timestamp) {
    if (!timestamp) return '';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' мин назад';
    if (diff < 86400) return 'сегодня в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    if (diff < 172800) return 'вчера в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    return date.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit', year:'2-digit'});
}

// Поиск по хештегу
function searchByHashtag(tag) {
    document.getElementById('slices-search-input').value = '#' + tag;
    searchSlices();
}

// Поиск по пользователю
function searchByUser(username) {
    document.getElementById('slices-search-input').value = '@' + username;
    searchSlices();
}

// Поиск в ленте
function searchSlices() {
    var query = document.getElementById('slices-search-input').value.trim().toLowerCase();
    
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        if (!query) {
            loadSlices();
            return;
        }
        
        var feed = document.getElementById('slices-feed');
        feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Поиск...</p></div>';
        
        database.ref('slices').orderByChild('createdAt').limitToLast(100).once('value').then(function(snapshot) {
            var slices = snapshot.val();
            var results = [];
            
            for (var id in slices) {
                var slice = slices[id];
                var match = false;
                
                // Поиск по тексту
                if (slice.text && slice.text.toLowerCase().includes(query)) match = true;
                
                // Поиск по хештегам
                if (slice.hashtags && slice.hashtags.some(function(tag) { return '#' + tag.toLowerCase().includes(query) || tag.toLowerCase().includes(query); })) match = true;
                
                // Поиск по автору
                if (slice.authorName && slice.authorName.toLowerCase().includes(query)) match = true;
                
                if (match) {
                    results.push({ id: id, data: slice });
                }
            }
            
            feed.innerHTML = '';
            if (results.length === 0) {
                feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Ничего не найдено</p></div>';
                return;
            }
            
            results.sort(function(a, b) { return (b.data.createdAt || 0) - (a.data.createdAt || 0); });
            results.forEach(function(result) {
                feed.appendChild(createSliceCard(result.id, result.data));
            });
        });
    }, 500);
}

// Лайк
function likeSlice(sliceId) {
    var likeRef = database.ref('sliceLikes/' + sliceId + '/' + currentUser.uid);
    var sliceRef = database.ref('slices/' + sliceId);
    
    likeRef.once('value').then(function(snap) {
        if (snap.exists()) {
            likeRef.remove();
            sliceRef.child('likesCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
        } else {
            likeRef.set(true);
            sliceRef.child('likesCount').transaction(function(c) { return (c || 0) + 1; });
        }
        // Обновляем UI
        var card = document.querySelector('.slice-card[data-slice-id="' + sliceId + '"]');
        if (card) {
            var likeBtn = card.querySelector('.like-btn');
            var likeCount = card.querySelector('.like-count');
            sliceRef.child('likesCount').once('value').then(function(s) {
                if (likeCount) likeCount.textContent = s.val() || 0;
                if (likeBtn) likeBtn.classList.toggle('liked', !snap.exists());
            });
        }
    });
}

// Показать комментарии
function showSliceComments(sliceId) {
    showNotification('Комментарии в разработке 📝', 'info');
}

// Репост
function repostSlice(sliceId) {
    database.ref('slices/' + sliceId).once('value').then(function(snapshot) {
        var originalSlice = snapshot.val();
        if (!originalSlice) return;
        
        var repostData = {
            type: 'repost',
            originalId: sliceId,
            originalAuthorId: originalSlice.authorId,
            originalAuthorName: originalSlice.authorName,
            originalText: originalSlice.text,
            originalMediaUrl: originalSlice.mediaUrl || (originalSlice.mediaUrls ? originalSlice.mediaUrls[0] : null),
            authorId: currentUser.uid,
            authorName: currentUserData.username,
            authorAvatar: currentUserData.avatar || '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            repostsCount: 0,
            likesCount: 0,
            viewsCount: 0
        };
        
        database.ref('slices/').push(repostData).then(function() {
            // Увеличиваем счетчик репостов у оригинала
            database.ref('slices/' + sliceId + '/repostsCount').transaction(function(c) { return (c || 0) + 1; });
            showNotification('Репостнуто!', 'success');
            loadSlices();
        });
    });
}

// Поделиться
function shareSlice(sliceId) {
    var url = window.location.href + '?slice=' + sliceId;
    if (navigator.share) {
        navigator.share({ title: 'Слайс', text: 'Посмотри пост!', url: url });
    } else {
        navigator.clipboard.writeText(url);
        showNotification('Ссылка скопирована!', 'success');
    }
}

// Открыть фото в лайтбоксе
function openSliceLightbox(url) {
    document.getElementById('lightbox-image').src = url;
    document.getElementById('image-lightbox').classList.remove('hidden');
}

// Открыть профиль пользователя в слайсах
function openSlicesProfile() {
    showNotification('Профиль в разработке 👤', 'info');
}

// ========== СОЗДАНИЕ ПОСТА ==========
function showCreateSliceModal() {
    document.getElementById('create-slice-modal').classList.remove('hidden');
    pendingSliceFiles = [];
    currentSliceIndex = 0;
    document.getElementById('slice-preview-area').innerHTML = '';
    document.getElementById('slice-text').value = '';
    document.getElementById('slice-hashtags-input').value = '';
    document.getElementById('slice-upload-area').style.display = '';
    document.getElementById('slice-preview-container').classList.add('hidden');
    updateSlicePreviewCounter();
}

function closeCreateSliceModal() {
    document.getElementById('create-slice-modal').classList.add('hidden');
}

function addSliceMedia() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(function(file) {
            if (file.size > 15 * 1024 * 1024) {
                showNotification('Файл слишком большой (макс. 15MB)', 'error');
                return;
            }
            pendingSliceFiles.push(file);
        });
        updateSlicePreview();
    };
    input.click();
}

function updateSlicePreview() {
    if (pendingSliceFiles.length === 0) {
        document.getElementById('slice-upload-area').style.display = '';
        document.getElementById('slice-preview-container').classList.add('hidden');
        return;
    }
    
    document.getElementById('slice-upload-area').style.display = 'none';
    document.getElementById('slice-preview-container').classList.remove('hidden');
    
    var previewArea = document.getElementById('slice-preview-area');
    previewArea.innerHTML = '';
    
    pendingSliceFiles.forEach(function(file, idx) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
            var div = document.createElement('div');
            div.className = 'slice-preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" class="slice-preview-img">
                <button class="slice-preview-remove" onclick="removeSliceMedia(${idx})">×</button>
                ${isGif ? '<span class="slice-preview-gif-badge">GIF</span>' : ''}
            `;
            previewArea.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    
    updateSlicePreviewCounter();
}

function updateSlicePreviewCounter() {
    var counter = document.getElementById('slice-preview-counter');
    if (counter) {
        counter.textContent = pendingSliceFiles.length + ' файла(ов)';
    }
}

function removeSliceMedia(index) {
    pendingSliceFiles.splice(index, 1);
    updateSlicePreview();
}

function extractHashtags(text) {
    var hashtags = text.match(/#[а-яА-Яa-zA-Z0-9_]+/g);
    if (!hashtags) return [];
    return hashtags.map(function(tag) { return tag.substring(1); });
}

async function publishSlice() {
    var text = document.getElementById('slice-text').value.trim();
    var hashtagsInput = document.getElementById('slice-hashtags-input').value.trim();
    
    if (pendingSliceFiles.length === 0 && !text) {
        showNotification('Добавьте текст или фото', 'error');
        return;
    }
    
    // Добавляем хештеги из отдельного поля
    if (hashtagsInput) {
        var extraTags = hashtagsInput.split(/[ ,]+/).filter(function(t) { return t; });
        if (text) text += ' ' + extraTags.map(function(t) { return '#' + t; }).join(' ');
        else text = extraTags.map(function(t) { return '#' + t; }).join(' ');
    }
    
    var hashtags = extractHashtags(text);
    
    showNotification('Публикация...', 'info');
    
    try {
        var mediaUrls = [];
        
        for (var i = 0; i < pendingSliceFiles.length; i++) {
            var url = await uploadToImgBB(pendingSliceFiles[i]);
            mediaUrls.push(url);
        }
        
        var sliceData = {
            authorId: currentUser.uid,
            authorName: currentUserData.username || 'Пользователь',
            authorAvatar: currentUserData.avatar || '',
            text: text,
            hashtags: hashtags,
            mediaType: mediaUrls.length > 1 ? 'multiple' : (mediaUrls.length === 1 ? 'single' : 'none'),
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
            mediaUrl: mediaUrls.length === 1 ? mediaUrls[0] : null,
            likesCount: 0,
            commentsCount: 0,
            repostsCount: 0,
            viewsCount: 0,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref('slices/').push(sliceData);
        
        showNotification('Пост опубликован! 🍕', 'success');
        closeCreateSliceModal();
        loadSlices();
        
    } catch (error) {
        console.error(error);
        showNotification('Ошибка публикации', 'error');
    }
}

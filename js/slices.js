// KUKUMBER SLICES - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ
// Посты, лайки, комментарии, репосты, поиск

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var slicesListener = null;
var slicesCache = {};
var pendingLikeRequests = {};

// ========== ЗАГРУЗКА ЛЕНТЫ ==========
function loadSlices() {
    var feed = document.getElementById('slices-feed');
    if (!feed) return;
    
    var searchInput = document.getElementById('slices-search-input');
    if (searchInput) searchInput.value = '';
    
    // Отключаем старый слушатель
    if (slicesListener) {
        slicesListener.off();
    }
    
    feed.innerHTML = '<div class="empty-slices"><span>🍕</span><p>Загрузка...</p></div>';
    
    slicesListener = database.ref('slices').orderByChild('createdAt').limitToLast(50);
    slicesListener.on('value', function(snapshot) {
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
            if (a.data.pinned && !b.data.pinned) return -1;
            if (!a.data.pinned && b.data.pinned) return 1;
            return (b.data.createdAt || 0) - (a.data.createdAt || 0);
        });
        
        slicesArray.forEach(function(slice) {
            database.ref('sliceLikes/' + slice.id + '/' + currentUser.uid).once('value').then(function(snap) {
                slice.data.userLiked = snap.exists();
                var card = createSliceCard(slice.id, slice.data);
                feed.appendChild(card);
            });
        });
        
        if (slicesArray.length === 0) {
            feed.innerHTML = '<div class="empty-slices"><span>🍕</span><p>Пока нет постов</p><p>Будьте первым!</p></div>';
        }
    });
}

// ========== СОЗДАНИЕ КАРТОЧКИ ПОСТА ==========
function createSliceCard(sliceId, sliceData) {
    var div = document.createElement('div');
    div.className = 'slice-card';
    div.setAttribute('data-slice-id', sliceId);
    
    // Аватар автора
    var avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
    var avatarContent = sliceData.authorAvatar ? '' : '👤';
    
    // Медиа контент
    var mediaHtml = '';
    if (sliceData.mediaType === 'multiple' && sliceData.mediaUrls && sliceData.mediaUrls.length > 0) {
        mediaHtml = '<div class="slice-media-multiple" id="slice-media-'+sliceId+'">';
        mediaHtml += '<div class="slice-media-slider">';
        sliceData.mediaUrls.forEach(function(url, idx) {
            var isGif = url.toLowerCase().endsWith('.gif');
            if (isGif) {
                mediaHtml += '<div class="slice-slide"><img src="'+url+'" class="slice-gif" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+url+'\')"></div>';
            } else {
                mediaHtml += '<div class="slice-slide"><img src="'+url+'" class="slice-image" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+url+'\')"></div>';
            }
        });
        mediaHtml += '</div>';
        if (sliceData.mediaUrls.length > 1) {
            mediaHtml += '<button class="slice-slider-prev" onclick="event.stopPropagation(); slideSlice(\''+sliceId+'\', -1)">←</button>';
            mediaHtml += '<button class="slice-slider-next" onclick="event.stopPropagation(); slideSlice(\''+sliceId+'\', 1)">→</button>';
            mediaHtml += '<div class="slice-slider-dots" id="slice-dots-'+sliceId+'"></div>';
        }
        mediaHtml += '</div>';
    } else if (sliceData.mediaUrl) {
        var isGif = sliceData.mediaUrl.toLowerCase().endsWith('.gif');
        if (isGif) {
            mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-gif" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
        } else {
            mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-image" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
        }
    }
    
    var textHtml = '';
    if (sliceData.text) {
        var displayText = sliceData.text;
        if (sliceData.edited) displayText += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        textHtml = '<div class="slice-text">'+formatSliceText(displayText)+'</div>';
    }
    
    var hashtagsHtml = '';
    if (sliceData.hashtags && sliceData.hashtags.length) {
        hashtagsHtml = '<div class="slice-hashtags">';
        sliceData.hashtags.forEach(function(tag) {
            hashtagsHtml += '<span class="slice-hashtag" onclick="searchByHashtag(\''+tag+'\')">#'+tag+'</span>';
        });
        hashtagsHtml += '</div>';
    }
    
    var pinnedBadge = sliceData.pinned ? '<span class="slice-pinned-badge">📌 Закреплено</span>' : '';
    
    // Иконки лайков
    var likeIcon = sliceData.userLiked ? 
        '<img src="https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png" style="width:24px; height:24px;">' : 
        '<img src="https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png" style="width:24px; height:24px;">';
    
    var commentIcon = '<img src="https://i.ibb.co/PzVWZ3dd/980-E0-C70-E93-B-4-AA0-80-AD-883-AD22-EB40-C.png" style="width:24px; height:24px;">';
    var repostIcon = '<img src="https://i.ibb.co/BHzJVy1L/3545-DF6-B-CA20-410-D-8837-DB9-EC1-B2-A080.png" style="width:24px; height:24px;">';
    
    div.innerHTML = `
        <div class="slice-header">
            <div class="slice-author" onclick="openUserProfile('${sliceData.authorId}')" style="cursor:pointer;">
                <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="slice-author-info">
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span class="slice-author-name">${escapeHtml(sliceData.authorName)}</span>
                    </div>
                    <span class="slice-date">${formatSliceDate(sliceData.createdAt)}</span>
                </div>
            </div>
            <div class="slice-views">
                <span class="slice-views-count">👁️ ${sliceData.viewsCount || 0}</span>
            </div>
        </div>
        ${pinnedBadge}
        ${mediaHtml}
        ${textHtml}
        ${hashtagsHtml}
        <div class="slice-actions">
            <div class="slice-actions-left">
                <button class="slice-action-btn like-btn ${sliceData.userLiked ? 'liked' : ''}" onclick="likeSlice('${sliceId}')">
                    ${likeIcon} <span class="like-count">${sliceData.likesCount || 0}</span>
                </button>
                <button class="slice-action-btn" onclick="toggleComments('${sliceId}')">
                    ${commentIcon} <span class="comment-count">${sliceData.commentsCount || 0}</span>
                </button>
                <button class="slice-action-btn" onclick="repostSlice('${sliceId}')">
                    ${repostIcon} <span class="repost-count">${sliceData.repostsCount || 0}</span>
                </button>
            </div>
            <div class="slice-actions-right">
                <button class="slice-action-btn" onclick="shareSlice('${sliceId}')">↗️</button>
            </div>
        </div>
        <div id="comments-block-${sliceId}" class="comments-block" style="display: none;">
            <div class="comments-loading">Загрузка комментариев...</div>
        </div>
    `;
    
    // Инициализация слайдера для множественных фото
    if (sliceData.mediaType === 'multiple' && sliceData.mediaUrls && sliceData.mediaUrls.length > 1) {
        setTimeout(function() { initSliceSlider(sliceId, sliceData.mediaUrls.length); }, 100);
    }
    
    // Увеличиваем счётчик просмотров
    var viewedKey = 'viewed_slice_' + sliceId;
    if (!sessionStorage.getItem(viewedKey)) {
        sessionStorage.setItem(viewedKey, 'true');
        database.ref('slices/' + sliceId + '/viewsCount').transaction(function(v) { return (v || 0) + 1; });
    }
    
    return div;
}

// ========== ЛАЙКИ ==========
function likeSlice(sliceId) {
    if (pendingLikeRequests[sliceId]) return;
    pendingLikeRequests[sliceId] = true;
    
    var likeRef = database.ref('sliceLikes/' + sliceId + '/' + currentUser.uid);
    var sliceRef = database.ref('slices/' + sliceId);
    var card = document.querySelector('.slice-card[data-slice-id="' + sliceId + '"]');
    
    likeRef.once('value').then(function(snap) {
        var isLiked = snap.exists();
        
        if (isLiked) {
            likeRef.remove();
            sliceRef.transaction(function(currentData) {
                if (currentData) currentData.likesCount = Math.max((currentData.likesCount || 1) - 1, 0);
                return currentData;
            });
            if (card) {
                var likeBtn = card.querySelector('.like-btn');
                var likeCountSpan = card.querySelector('.like-count');
                var currentCount = parseInt(likeCountSpan.textContent) || 0;
                likeCountSpan.textContent = Math.max(currentCount - 1, 0);
                likeBtn.innerHTML = '<img src="https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png" style="width:24px; height:24px;"> <span class="like-count">' + Math.max(currentCount - 1, 0) + '</span>';
                likeBtn.classList.remove('liked');
            }
        } else {
            likeRef.set(true);
            sliceRef.transaction(function(currentData) {
                if (currentData) currentData.likesCount = (currentData.likesCount || 0) + 1;
                return currentData;
            });
            if (card) {
                var likeBtn = card.querySelector('.like-btn');
                var likeCountSpan = card.querySelector('.like-count');
                var currentCount = parseInt(likeCountSpan.textContent) || 0;
                likeCountSpan.textContent = currentCount + 1;
                likeBtn.innerHTML = '<img src="https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png" style="width:24px; height:24px;"> <span class="like-count">' + (currentCount + 1) + '</span>';
                likeBtn.classList.add('liked');
            }
        }
        setTimeout(function() { delete pendingLikeRequests[sliceId]; }, 500);
    }).catch(function() { delete pendingLikeRequests[sliceId]; });
}

// ========== РЕПОСТЫ ==========
function repostSlice(sliceId) {
    showNotification('Репост: копирование ссылки', 'info');
    shareSlice(sliceId);
}

// ========== КОММЕНТАРИИ ==========
function toggleComments(sliceId) {
    var commentsBlock = document.getElementById('comments-block-' + sliceId);
    if (!commentsBlock) return;
    
    if (commentsBlock.style.display === 'none') {
        commentsBlock.style.display = 'block';
        loadComments(sliceId);
    } else {
        commentsBlock.style.display = 'none';
    }
}

function loadComments(sliceId) {
    var container = document.getElementById('comments-block-' + sliceId);
    if (!container) return;
    
    container.innerHTML = '<div class="comments-loading">Загрузка комментариев...</div>';
    
    database.ref('sliceComments/' + sliceId).orderByChild('createdAt').once('value').then(function(snapshot) {
        var comments = snapshot.val();
        var commentsHtml = '<div class="comments-list">';
        
        if (!comments) {
            commentsHtml += '<div class="no-comments">Комментариев пока нет. Будьте первым!</div>';
        } else {
            var commentsArray = [];
            for (var id in comments) {
                if (!comments[id].parentId) {
                    commentsArray.push({ id: id, data: comments[id] });
                }
            }
            commentsArray.sort(function(a, b) { return (a.data.createdAt || 0) - (b.data.createdAt || 0); });
            
            commentsArray.forEach(function(comment) {
                commentsHtml += renderComment(comment.id, comment.data, sliceId);
            });
        }
        
        commentsHtml += '</div>';
        commentsHtml += '<div class="add-comment">';
        commentsHtml += '<textarea id="comment-text-' + sliceId + '" placeholder="Написать комментарий..." rows="2"></textarea>';
        commentsHtml += '<button onclick="addComment(\'' + sliceId + '\')">Отправить</button>';
        commentsHtml += '</div>';
        
        container.innerHTML = commentsHtml;
    });
}

function renderComment(commentId, comment, sliceId, level) {
    if (!level) level = 0;
    
    var avatarStyle = comment.authorAvatar ? 'background-image:url('+comment.authorAvatar+');background-size:cover;' : '';
    var avatarContent = comment.authorAvatar ? '' : '👤';
    var marginLeft = level * 40;
    
    return `
        <div class="comment-item" data-comment-id="${commentId}" style="margin-left: ${marginLeft}px;">
            <div class="comment-header">
                <div class="comment-author-avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="comment-author-info">
                    <span class="comment-author-name">${escapeHtml(comment.authorName)}</span>
                    <span class="comment-date">${formatSliceDate(comment.createdAt)}</span>
                </div>
                <button class="comment-like-btn" onclick="likeComment('${sliceId}', '${commentId}')">
                    🤍 <span class="comment-like-count">${comment.likesCount || 0}</span>
                </button>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
            <div class="comment-actions">
                <button class="comment-reply-btn" onclick="showReplyForm('${sliceId}', '${commentId}')">Ответить</button>
            </div>
            <div id="replies-container-${commentId}" class="replies-container"></div>
        </div>
    `;
}

function addComment(sliceId, parentId) {
    var textInput, text;
    
    if (parentId) {
        textInput = document.getElementById('reply-text-' + parentId);
        text = textInput ? textInput.value.trim() : '';
    } else {
        textInput = document.getElementById('comment-text-' + sliceId);
        text = textInput ? textInput.value.trim() : '';
    }
    
    if (!text) {
        showNotification('Введите текст комментария', 'error');
        return;
    }
    
    var commentData = {
        authorId: currentUser.uid,
        authorName: currentUserData.username || 'Пользователь',
        authorAvatar: currentUserData.avatar || '',
        text: text,
        parentId: parentId || null,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        likesCount: 0
    };
    
    var newCommentRef = database.ref('sliceComments/' + sliceId).push();
    newCommentRef.set(commentData).then(function() {
        if (textInput) textInput.value = '';
        database.ref('slices/' + sliceId + '/commentsCount').transaction(function(c) { return (c || 0) + 1; });
        loadComments(sliceId);
        showNotification('Комментарий добавлен', 'success');
    });
}

function showReplyForm(sliceId, parentId) {
    var container = document.getElementById('replies-container-' + parentId);
    if (!container) return;
    
    if (container.querySelector('.reply-form')) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div class="reply-form">
            <textarea id="reply-text-${parentId}" placeholder="Написать ответ..." rows="2"></textarea>
            <button onclick="addComment('${sliceId}', '${parentId}')">Ответить</button>
            <button onclick="cancelReply('${parentId}')" class="cancel-reply-btn">Отмена</button>
        </div>
    `;
    
    loadReplies(sliceId, parentId);
}

function cancelReply(parentId) {
    var container = document.getElementById('replies-container-' + parentId);
    if (container) container.innerHTML = '';
}

function loadReplies(sliceId, parentId) {
    var container = document.getElementById('replies-container-' + parentId);
    if (!container) return;
    
    database.ref('sliceComments/' + sliceId).orderByChild('parentId').equalTo(parentId).once('value').then(function(snapshot) {
        var replies = snapshot.val();
        if (!replies) return;
        
        var repliesHtml = '<div class="replies-list">';
        var repliesArray = [];
        for (var id in replies) {
            repliesArray.push({ id: id, data: replies[id] });
        }
        repliesArray.sort(function(a, b) { return (a.data.createdAt || 0) - (b.data.createdAt || 0); });
        
        repliesArray.forEach(function(reply) {
            var avatarStyle = reply.data.authorAvatar ? 'background-image:url('+reply.data.authorAvatar+');background-size:cover;' : '';
            var avatarContent = reply.data.authorAvatar ? '' : '👤';
            
            repliesHtml += `
                <div class="comment-item reply-item">
                    <div class="comment-header">
                        <div class="comment-author-avatar" style="${avatarStyle}">${avatarContent}</div>
                        <div class="comment-author-info">
                            <span class="comment-author-name">${escapeHtml(reply.data.authorName)}</span>
                            <span class="comment-date">${formatSliceDate(reply.data.createdAt)}</span>
                        </div>
                        <button class="comment-like-btn" onclick="likeComment('${sliceId}', '${reply.id}')">
                            🤍 <span>${reply.data.likesCount || 0}</span>
                        </button>
                    </div>
                    <div class="comment-text">${escapeHtml(reply.data.text)}</div>
                </div>
            `;
        });
        repliesHtml += '</div>';
        
        var existingForm = container.querySelector('.reply-form');
        if (existingForm) {
            container.innerHTML = repliesHtml;
            container.appendChild(existingForm);
        } else {
            container.innerHTML = repliesHtml;
        }
    });
}

function likeComment(sliceId, commentId) {
    var likeRef = database.ref('commentLikes/' + commentId + '/' + currentUser.uid);
    var commentRef = database.ref('sliceComments/' + sliceId + '/' + commentId);
    var commentElement = document.querySelector('.comment-item[data-comment-id="' + commentId + '"]');
    var likeBtn = commentElement ? commentElement.querySelector('.comment-like-btn') : null;
    
    likeRef.once('value').then(function(snap) {
        if (snap.exists()) {
            likeRef.remove();
            commentRef.child('likesCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
            if (likeBtn) {
                likeBtn.innerHTML = '🤍 <span>' + (parseInt(likeBtn.querySelector('span').textContent) - 1) + '</span>';
            }
        } else {
            likeRef.set(true);
            commentRef.child('likesCount').transaction(function(c) { return (c || 0) + 1; });
            if (likeBtn) {
                likeBtn.innerHTML = '❤️ <span>' + (parseInt(likeBtn.querySelector('span').textContent) + 1) + '</span>';
            }
        }
    });
}

// ========== СЛАЙДЕР ==========
function initSliceSlider(sliceId, totalSlides) {
    var container = document.getElementById('slice-media-' + sliceId);
    if (!container) return;
    
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
    dots.forEach(function(dot, i) { dot.classList.toggle('active', i === index); });
    window['sliceCurrentIndex_' + sliceId] = index;
}

// ========== ФОРМАТИРОВАНИЕ ==========
function formatSliceText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #228B22; text-decoration: none;">$1</a>');
    text = text.replace(/@(\w+)/g, '<span class="slice-mention" onclick="searchByUser(\'$1\')">@$1</span>');
    return text;
}

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

// ========== ПОИСК ==========
function searchByHashtag(tag) {
    var input = document.getElementById('slices-search-input');
    if (input) input.value = '#' + tag;
    performSearch();
}

function searchByUser(username) {
    var input = document.getElementById('slices-search-input');
    if (input) input.value = '@' + username;
    performSearch();
}

function performSearch() {
    var query = document.getElementById('slices-search-input').value.trim().toLowerCase();
    var feed = document.getElementById('slices-feed');
    if (!feed) return;
    
    if (!query) {
        loadSlices();
        return;
    }
    
    feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Поиск...</p></div>';
    
    database.ref('slices').orderByChild('createdAt').limitToLast(200).once('value').then(function(snapshot) {
        var slices = snapshot.val();
        var results = [];
        
        for (var id in slices) {
            var slice = slices[id];
            var match = false;
            if (slice.text && slice.text.toLowerCase().includes(query)) match = true;
            if (slice.hashtags && slice.hashtags.some(function(tag) { 
                return '#' + tag.toLowerCase().includes(query) || tag.toLowerCase().includes(query.replace('#', '')); 
            })) match = true;
            if (slice.authorName && slice.authorName.toLowerCase().includes(query.replace('@', ''))) match = true;
            if (match) results.push({ id: id, data: slice });
        }
        
        feed.innerHTML = '';
        if (results.length === 0) {
            feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Ничего не найдено</p></div>';
            return;
        }
        
        results.sort(function(a, b) { return (b.data.createdAt || 0) - (a.data.createdAt || 0); });
        
        results.forEach(function(result) {
            database.ref('sliceLikes/' + result.id + '/' + currentUser.uid).once('value').then(function(snap) {
                result.data.userLiked = snap.exists();
                feed.appendChild(createSliceCard(result.id, result.data));
            });
        });
    });
}

function searchSlices() {
    performSearch();
}

// ========== ОБЩИЕ ФУНКЦИИ ==========
function shareSlice(sliceId) {
    var url = window.location.href + '?slice=' + sliceId;
    if (navigator.share) {
        navigator.share({ title: 'Слайс', text: 'Посмотри пост!', url: url });
    } else {
        navigator.clipboard.writeText(url);
        showNotification('Ссылка скопирована!', 'success');
    }
}

function openSliceLightbox(url) {
    var lightbox = document.getElementById('image-lightbox');
    var lightboxImg = document.getElementById('lightbox-image');
    if (lightbox && lightboxImg) {
        lightboxImg.src = url;
        lightbox.classList.remove('hidden');
    }
}

function openSlicesProfile() {
    if (currentUser && typeof openUserProfile === 'function') {
        openUserProfile(currentUser.uid);
    }
}

// ========== КОНТЕКСТНОЕ МЕНЮ ДЛЯ АДМИНОВ ==========
function showSliceContextMenu(event, sliceId, sliceData) {
    event.preventDefault();
    event.stopPropagation();
    
    var isOwner = sliceData.authorId === currentUser.uid;
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwner && !isAdmin) return;
    
    var oldMenu = document.getElementById('slice-context-menu');
    if (oldMenu) oldMenu.remove();
    
    var menu = document.createElement('div');
    menu.id = 'slice-context-menu';
    menu.style.cssText = 'position:fixed; z-index:10008; background:white; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.2); min-width:180px; overflow:hidden;';
    
    var menuHtml = '';
    if (isOwner || isAdmin) {
        menuHtml += '<div class="context-menu-item" onclick="editSlice(\''+sliceId+'\')">✏️ Редактировать пост</div>';
        menuHtml += '<div class="context-menu-item" onclick="deleteSlice(\''+sliceId+'\')">🗑️ Удалить пост</div>';
    }
    if (isAdmin && !isOwner) {
        menuHtml += '<div class="context-menu-item" onclick="pinSlice(\''+sliceId+'\')">📌 Закрепить</div>';
        menuHtml += '<div class="context-menu-item" onclick="unpinSlice(\''+sliceId+'\')">📌 Открепить</div>';
    }
    
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    var x = event.clientX, y = event.clientY;
    if (event.touches) { x = event.touches[0].clientX; y = event.touches[0].clientY; }
    
    var menuRect = menu.getBoundingClientRect();
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    if (x + menuRect.width > windowWidth) x = windowWidth - menuRect.width - 10;
    if (y + menuRect.height > windowHeight) y = windowHeight - menuRect.height - 10;
    if (x < 10) x = 10; if (y < 10) y = 10;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    
    setTimeout(function() {
        document.addEventListener('click', function closeSliceMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeSliceMenu);
            }
        });
    }, 10);
}

function editSlice(sliceId) {
    database.ref('slices/' + sliceId).once('value').then(function(snapshot) {
        var slice = snapshot.val();
        if (!slice) { showNotification('Пост не найден', 'error'); return; }
        var newText = prompt('Редактировать текст поста:', slice.text || '');
        if (newText === null) return;
        database.ref('slices/' + sliceId).update({ 
            text: newText, 
            edited: true,
            editedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(function() { 
            showNotification('Пост отредактирован!', 'success'); 
            loadSlices(); 
        }).catch(function() { 
            showNotification('Ошибка редактирования', 'error'); 
        });
    });
    closeSliceContextMenu();
}

function deleteSlice(sliceId) {
    if (!confirm('Удалить этот пост? Действие необратимо.')) return;
    database.ref('slices/' + sliceId).remove().then(function() {
        database.ref('sliceLikes/' + sliceId).remove();
        database.ref('sliceComments/' + sliceId).remove();
        showNotification('Пост удалён', 'success');
        loadSlices();
    }).catch(function() { 
        showNotification('Ошибка удаления', 'error'); 
    });
    closeSliceContextMenu();
}

function pinSlice(sliceId) {
    database.ref('slices/' + sliceId').update({ pinned: true }).then(function() {
        showNotification('Пост закреплён!', 'success');
        loadSlices();
    });
    closeSliceContextMenu();
}

function unpinSlice(sliceId) {
    database.ref('slices/' + sliceId').update({ pinned: false }).then(function() {
        showNotification('Пост откреплён', 'info');
        loadSlices();
    });
    closeSliceContextMenu();
}

function closeSliceContextMenu() { 
    var menu = document.getElementById('slice-context-menu'); 
    if (menu) menu.remove(); 
}

// ========== СОЗДАНИЕ ПОСТА ==========
var pendingSliceFiles = [];

function showCreateSliceModal() {
    // Создаём input для выбора файлов
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.multiple = true;
    input.onchange = async function(e) {
        var files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        showNotification('Публикация...', 'info');
        
        try {
            var mediaUrls = [];
            for (var i = 0; i < files.length; i++) {
                if (typeof uploadToImgBB === 'function') {
                    var url = await uploadToImgBB(files[i]);
                    mediaUrls.push(url);
                } else {
                    showNotification('Функция загрузки не найдена', 'error');
                    return;
                }
            }
            
            var text = prompt('Добавьте описание (необязательно):', '');
            
            var sliceData = {
                authorId: currentUser.uid,
                authorName: currentUserData.username || 'Пользователь',
                authorAvatar: currentUserData.avatar || '',
                text: text || '',
                mediaType: mediaUrls.length > 1 ? 'multiple' : (mediaUrls.length === 1 ? 'single' : 'none'),
                mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
                mediaUrl: mediaUrls.length === 1 ? mediaUrls[0] : null,
                likesCount: 0,
                commentsCount: 0,
                repostsCount: 0,
                viewsCount: 0,
                pinned: false,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            await database.ref('slices/').push(sliceData);
            showNotification('Пост опубликован! 🍕', 'success');
            loadSlices();
            
        } catch (error) {
            console.error(error);
            showNotification('Ошибка публикации', 'error');
        }
    };
    input.click();
}

function closeCreateSliceModal() {}

// Звук при создании
var sliceCreateSound = null;
function initSliceSound() {}

// Инициализация
initSliceSound();

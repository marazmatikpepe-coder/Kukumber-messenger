// SLICES (Слайсы) - полная версия с работающими комментариями
var currentSlicesTab = 'feed';
var pendingSliceFiles = [];
var searchTimeout = null;
var slicesListener = null;
var openCommentsSliceId = null;

// Загрузка ленты
function loadSlices() {
    var feed = document.getElementById('slices-feed');
    if (!feed) return;
    
    var searchInput = document.getElementById('slices-search-input');
    if (searchInput) searchInput.value = '';
    
    feed.innerHTML = '<div class="empty-slices"><span>🍕</span><p>Загрузка...</p></div>';
    
    if (slicesListener) slicesListener.off();
    
    slicesListener = database.ref('slices').orderByChild('createdAt').limitToLast(100);
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
            // Проверяем, лайкнул ли текущий пользователь этот пост
            var likeRef = database.ref('sliceLikes/' + slice.id + '/' + currentUser.uid);
            likeRef.once('value').then(function(snap) {
                slice.data.userLiked = snap.exists();
                var card = createSliceCard(slice.id, slice.data);
                feed.appendChild(card);
            });
        });
    });
}

// Создание карточки поста
function createSliceCard(sliceId, sliceData) {
    var div = document.createElement('div');
    div.className = 'slice-card';
    div.setAttribute('data-slice-id', sliceId);
    
    // Контекстное меню
    div.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showSliceContextMenu(e, sliceId, sliceData);
    });
    
    // Долгое нажатие для мобильных
    var touchTimer = null;
    div.addEventListener('touchstart', function(e) {
        touchTimer = setTimeout(function() {
            showSliceContextMenu(e, sliceId, sliceData);
        }, 500);
    });
    div.addEventListener('touchend', function() {
        if (touchTimer) clearTimeout(touchTimer);
    });
    div.addEventListener('touchmove', function() {
        if (touchTimer) clearTimeout(touchTimer);
    });
    
    // Шапка
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
    
    // Текст поста
    var textHtml = '';
    if (sliceData.text) {
        var displayText = sliceData.text;
        if (sliceData.edited) displayText += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        textHtml = '<div class="slice-text">'+formatSliceText(displayText)+'</div>';
    }
    
    // Хештеги
    var hashtagsHtml = '';
    if (sliceData.hashtags && sliceData.hashtags.length) {
        hashtagsHtml = '<div class="slice-hashtags">';
        sliceData.hashtags.forEach(function(tag) {
            hashtagsHtml += '<span class="slice-hashtag" onclick="searchByHashtag(\''+tag+'\')">#'+tag+'</span>';
        });
        hashtagsHtml += '</div>';
    }
    
    // Закреплённый значок
    var pinnedBadge = sliceData.pinned ? '<span class="slice-pinned-badge">📌 Закреплено</span>' : '';
    
    // КНОПКИ ДЕЙСТВИЙ
    var likeIcon = sliceData.userLiked ? 
        '<img src="https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png" style="width:24px; height:24px;">' : 
        '<img src="https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png" style="width:24px; height:24px;">';
    
    var commentIcon = '<img src="https://i.ibb.co/PzVWZ3dd/980-E0-C70-E93-B-4-AA0-80-AD-883-AD22-EB40-C.png" style="width:24px; height:24px;">';
    
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
                    🔁 <span class="repost-count">${sliceData.repostsCount || 0}</span>
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
    
    // Инициализация слайдера
    if (sliceData.mediaType === 'multiple' && sliceData.mediaUrls && sliceData.mediaUrls.length > 1) {
        setTimeout(function() {
            initSliceSlider(sliceId, sliceData.mediaUrls.length);
        }, 100);
    }
    
    // Увеличиваем просмотры
    var viewedKey = 'viewed_slice_' + sliceId;
    if (!sessionStorage.getItem(viewedKey)) {
        sessionStorage.setItem(viewedKey, 'true');
        database.ref('slices/' + sliceId + '/viewsCount').transaction(function(v) { return (v || 0) + 1; });
    }
    
    return div;
}

// Лайк поста
function likeSlice(sliceId) {
    var likeRef = database.ref('sliceLikes/' + sliceId + '/' + currentUser.uid);
    var sliceRef = database.ref('slices/' + sliceId);
    var card = document.querySelector('.slice-card[data-slice-id="' + sliceId + '"]');
    
    likeRef.once('value').then(function(snap) {
        if (snap.exists()) {
            likeRef.remove();
            sliceRef.child('likesCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
            if (card) {
                var likeBtn = card.querySelector('.like-btn');
                var likeCount = card.querySelector('.like-count');
                if (likeBtn) {
                    likeBtn.innerHTML = '<img src="https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png" style="width:24px; height:24px;"> <span class="like-count">' + (parseInt(likeCount.textContent) - 1) + '</span>';
                }
            }
        } else {
            likeRef.set(true);
            sliceRef.child('likesCount').transaction(function(c) { return (c || 0) + 1; });
            if (card) {
                var likeBtn = card.querySelector('.like-btn');
                var likeCount = card.querySelector('.like-count');
                if (likeBtn) {
                    likeBtn.innerHTML = '<img src="https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png" style="width:24px; height:24px;"> <span class="like-count">' + (parseInt(likeCount.textContent) + 1) + '</span>';
                }
            }
        }
    });
}

// ========== КОММЕНТАРИИ (рабочая версия) ==========
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
                commentsArray.push({ id: id, data: comments[id] });
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
    
    // Проверяем, лайкнут ли комментарий
    var isLiked = comment.userLiked === true;
    var likeIcon = isLiked ? '❤️' : '🤍';
    var likeClass = isLiked ? 'liked' : '';
    
    var marginLeft = level * 40;
    
    var html = `
        <div class="comment-item" data-comment-id="${commentId}" style="margin-left: ${marginLeft}px;">
            <div class="comment-header">
                <div class="comment-author-avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="comment-author-info">
                    <span class="comment-author-name">${escapeHtml(comment.authorName)}</span>
                    <span class="comment-date">${formatSliceDate(comment.createdAt)}</span>
                </div>
                <button class="comment-like-btn ${likeClass}" onclick="likeComment('${sliceId}', '${commentId}')">
                    ${likeIcon} <span class="comment-like-count">${comment.likesCount || 0}</span>
                </button>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
            <div class="comment-actions">
                <button class="comment-reply-btn" onclick="showReplyForm('${sliceId}', '${commentId}')">Ответить</button>
            </div>
            <div id="replies-container-${commentId}" class="replies-container"></div>
        </div>
    `;
    
    return html;
}

function addComment(sliceId, parentId) {
    var textInput;
    var text;
    
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
        likesCount: 0,
        repliesCount: 0
    };
    
    var newCommentRef = database.ref('sliceComments/' + sliceId).push();
    newCommentRef.set(commentData).then(function() {
        if (textInput) textInput.value = '';
        // Обновляем счетчик комментариев у поста
        database.ref('slices/' + sliceId + '/commentsCount').transaction(function(c) { return (c || 0) + 1; });
        loadComments(sliceId);
        showNotification('Комментарий добавлен', 'success');
    }).catch(function(err) {
        showNotification('Ошибка: ' + err.message, 'error');
    });
}

function showReplyForm(sliceId, parentId) {
    var container = document.getElementById('replies-container-' + parentId);
    if (!container) return;
    
    // Проверяем, не открыта ли уже форма
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
    
    // Загружаем существующие ответы
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
                <div class="comment-item reply-item" data-comment-id="${reply.id}">
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
        
        // Вставляем ответы перед формой
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
                likeBtn.classList.remove('liked');
            }
        } else {
            likeRef.set(true);
            commentRef.child('likesCount').transaction(function(c) { return (c || 0) + 1; });
            if (likeBtn) {
                likeBtn.innerHTML = '❤️ <span>' + (parseInt(likeBtn.querySelector('span').textContent) + 1) + '</span>';
                likeBtn.classList.add('liked');
            }
        }
    });
}

// ========== ОСТАЛЬНЫЕ ФУНКЦИИ (слайдер, поиск, контекстное меню, создание поста) ==========

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

function formatSliceText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
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

function searchByHashtag(tag) {
    var input = document.getElementById('slices-search-input');
    if (input) input.value = '#' + tag;
    searchSlices();
}

function searchByUser(username) {
    var input = document.getElementById('slices-search-input');
    if (input) input.value = '@' + username;
    searchSlices();
}

function searchSlices() {
    var query = document.getElementById('slices-search-input').value.trim().toLowerCase();
    
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        var feed = document.getElementById('slices-feed');
        if (!feed) return;
        
        if (!query) {
            loadSlices();
            return;
        }
        
        feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Поиск...</p></div>';
        
        database.ref('slices').orderByChild('createdAt').limitToLast(100).once('value').then(function(snapshot) {
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
                var likeRef = database.ref('sliceLikes/' + result.id + '/' + currentUser.uid);
                likeRef.once('value').then(function(snap) {
                    result.data.userLiked = snap.exists();
                    feed.appendChild(createSliceCard(result.id, result.data));
                });
            });
        });
    }, 500);
}

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
            database.ref('slices/' + sliceId + '/repostsCount').transaction(function(c) { return (c || 0) + 1; });
            showNotification('Репостнуто!', 'success');
            loadSlices();
        });
    });
}

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
    switchToTab('settings');
}

// ========== КОНТЕКСТНОЕ МЕНЮ ==========
function showSliceContextMenu(event, sliceId, sliceData) {
    event.preventDefault();
    event.stopPropagation();
    
    var oldMenu = document.getElementById('slice-context-menu');
    if (oldMenu) oldMenu.remove();
    
    var isOwner = sliceData.authorId === currentUser.uid;
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwner && !isAdmin) return;
    
    var menu = document.createElement('div');
    menu.id = 'slice-context-menu';
    menu.style.cssText = 'position:fixed; z-index:10001; background:white; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.2); min-width:180px; overflow:hidden;';
    
    var menuHtml = '';
    
    if (isOwner || isAdmin) {
        menuHtml += '<div class="context-menu-item" onclick="editSlice(\''+sliceId+'\')">✏️ Редактировать пост</div>';
        menuHtml += '<div class="context-menu-item" onclick="deleteSlice(\''+sliceId+'\')">🗑️ Удалить пост</div>';
    }
    
    if (isAdmin && !isOwner) {
        menuHtml += '<div style="border-top:1px solid #eee; margin:5px 0;"></div>';
        if (!sliceData.pinned) {
            menuHtml += '<div class="context-menu-item" onclick="pinSlice(\''+sliceId+'\')">📌 Закрепить в ленте</div>';
        } else {
            menuHtml += '<div class="context-menu-item" onclick="unpinSlice(\''+sliceId+'\')">📌 Открепить</div>';
        }
        menuHtml += '<div class="context-menu-item" onclick="reportSlice(\''+sliceId+'\')">⚠️ Пожаловаться</div>';
    }
    
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    var x, y;
    if (event.touches) {
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
    } else {
        x = event.clientX;
        y = event.clientY;
    }
    
    var menuRect = menu.getBoundingClientRect();
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    
    if (x + menuRect.width > windowWidth) x = windowWidth - menuRect.width - 10;
    if (y + menuRect.height > windowHeight) y = windowHeight - menuRect.height - 10;
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
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
        if (!slice) {
            showNotification('Пост не найден', 'error');
            return;
        }
        
        var newText = prompt('Редактировать текст поста:', slice.text || '');
        if (newText === null) return;
        
        var newHashtags = extractHashtags(newText);
        
        database.ref('slices/' + sliceId).update({
            text: newText,
            hashtags: newHashtags,
            editedAt: firebase.database.ServerValue.TIMESTAMP,
            edited: true
        }).then(function() {
            showNotification('Пост отредактирован!', 'success');
            loadSlices();
        }).catch(function(err) {
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
    }).catch(function(err) {
        showNotification('Ошибка удаления', 'error');
    });
    
    closeSliceContextMenu();
}

function pinSlice(sliceId) {
    database.ref('slices/' + sliceId).update({
        pinned: true,
        pinnedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function() {
        showNotification('Пост закреплён!', 'success');
        loadSlices();
    }).catch(function(err) {
        showNotification('Ошибка', 'error');
    });
    closeSliceContextMenu();
}

function unpinSlice(sliceId) {
    database.ref('slices/' + sliceId).update({
        pinned: false,
        pinnedAt: null
    }).then(function() {
        showNotification('Пост откреплён', 'info');
        loadSlices();
    }).catch(function(err) {
        showNotification('Ошибка', 'error');
    });
    closeSliceContextMenu();
}

function reportSlice(sliceId) {
    var reason = prompt('Укажите причину жалобы:');
    if (!reason) return;
    
    database.ref('reports/slices/' + sliceId).push({
        userId: currentUser.uid,
        userName: currentUserData?.username || 'Пользователь',
        reason: reason,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(function() {
        showNotification('Жалоба отправлена администрации', 'success');
    }).catch(function(err) {
        showNotification('Ошибка', 'error');
    });
    closeSliceContextMenu();
}

function closeSliceContextMenu() {
    var menu = document.getElementById('slice-context-menu');
    if (menu) menu.remove();
}

// ========== СОЗДАНИЕ ПОСТА ==========
function showCreateSliceModal() {
    var modal = document.getElementById('create-slice-modal');
    if (modal) modal.classList.remove('hidden');
    pendingSliceFiles = [];
    
    var previewArea = document.getElementById('slice-preview-area');
    if (previewArea) previewArea.innerHTML = '';
    
    var textInput = document.getElementById('slice-text');
    if (textInput) textInput.value = '';
    
    var hashtagsInput = document.getElementById('slice-hashtags-input');
    if (hashtagsInput) hashtagsInput.value = '';
    
    var uploadArea = document.getElementById('slice-upload-area');
    if (uploadArea) uploadArea.style.display = '';
    
    var previewContainer = document.getElementById('slice-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');
    
    updateSlicePreviewCounter();
}

function closeCreateSliceModal() {
    var modal = document.getElementById('create-slice-modal');
    if (modal) modal.classList.add('hidden');
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
        var uploadArea = document.getElementById('slice-upload-area');
        if (uploadArea) uploadArea.style.display = '';
        var previewContainer = document.getElementById('slice-preview-container');
        if (previewContainer) previewContainer.classList.add('hidden');
        return;
    }
    
    var uploadArea = document.getElementById('slice-upload-area');
    if (uploadArea) uploadArea.style.display = 'none';
    
    var previewContainer = document.getElementById('slice-preview-container');
    if (previewContainer) previewContainer.classList.remove('hidden');
    
    var previewArea = document.getElementById('slice-preview-area');
    if (previewArea) {
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
    }
    
    updateSlicePreviewCounter();
}

function updateSlicePreviewCounter() {
    var counter = document.getElementById('slice-preview-counter');
    if (counter) {
        counter.textContent = pendingSliceFiles.length;
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
            pinned: false,
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

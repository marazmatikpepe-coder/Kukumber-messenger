// SLICES (Слайсы) - полная версия с лайками и комментариями
var currentSlicesTab = 'feed';
var pendingSliceFiles = [];
var searchTimeout = null;
var slicesListener = null;
var openCommentsSliceId = null; // ID поста, у которого открыты комментарии

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
    
    // КНОПКИ ДЕЙСТВИЙ С ВАШИМИ ИКОНКАМИ
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
    var likeBtn = card ? card.querySelector('.like-btn') : null;
    
    likeRef.once('value').then(function(snap) {
        if (snap.exists()) {
            // Убираем лайк
            likeRef.remove();
            sliceRef.child('likesCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
            if (likeBtn) {
                likeBtn.classList.remove('liked');
                likeBtn.innerHTML = '<img src="https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png" style="width:24px; height:24px;"> <span class="like-count">' + ((card.querySelector('.like-count')?.textContent || 1) - 1) + '</span>';
            }
        } else {
            // Ставим лайк
            likeRef.set(true);
            sliceRef.child('likesCount').transaction(function(c) { return (c || 0) + 1; });
            if (likeBtn) {
                likeBtn.classList.add('liked');
                likeBtn.innerHTML = '<img src="https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png" style="width:24px; height:24px;"> <span class="like-count">' + ((card.querySelector('.like-count')?.textContent || 0) + 1) + '</span>';
            }
        }
    });
}

// ========== КОММЕНТАРИИ (как в ВК) ==========
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

function loadComments(sliceId, parentId, level, limit, lastKey) {
    if (!parentId) parentId = null;
    if (!level) level = 0;
    if (!limit) limit = 3;
    
    var container = document.getElementById('comments-block-' + sliceId);
    if (!container) return;
    
    var query = database.ref('sliceComments/' + sliceId);
    if (parentId) {
        query = query.child(parentId).child('replies');
    } else {
        query = query.orderByChild('parentId').equalTo(null);
    }
    query = query.orderByChild('createdAt').limitToLast(limit);
    
    if (lastKey) {
        query = query.endAt(null, lastKey);
    }
    
    query.once('value').then(function(snapshot) {
        var comments = snapshot.val();
        if (!comments) {
            if (!parentId && level === 0) {
                container.innerHTML = '<div class="no-comments">Комментариев пока нет. Будьте первым!</div><div class="add-comment"><textarea placeholder="Написать комментарий..." id="comment-text-' + sliceId + '"></textarea><button onclick="addComment(\'' + sliceId + '\')">Отправить</button></div>';
            }
            return;
        }
        
        var commentsHtml = '';
        var commentIds = Object.keys(comments);
        commentIds.reverse(); // новые сверху
        
        commentIds.forEach(function(commentId) {
            var comment = comments[commentId];
            commentsHtml += renderComment(commentId, comment, sliceId, level, parentId);
        });
        
        if (level === 0 && !parentId) {
            container.innerHTML = '<div class="comments-list">' + commentsHtml + '</div><div class="add-comment"><textarea placeholder="Написать комментарий..." id="comment-text-' + sliceId + '"></textarea><button onclick="addComment(\'' + sliceId + '\')">Отправить</button></div>';
        } else {
            container.innerHTML = commentsHtml;
        }
    });
}

function renderComment(commentId, comment, sliceId, level, parentId, showReplyForm) {
    var replyFormHtml = showReplyForm ? 
        '<div class="reply-form"><textarea placeholder="Ответить..." id="reply-text-' + commentId + '"></textarea><button onclick="addComment(\'' + sliceId + '\', \'' + commentId + '\')">Ответить</button></div>' : '';
    
    var repliesHtml = '';
    if (comment.repliesCount > 0) {
        repliesHtml = '<div class="comment-replies" id="replies-' + commentId + '" style="margin-left: 40px;"><button class="load-replies-btn" onclick="loadReplies(\'' + sliceId + '\', \'' + commentId + '\')">Показать ответы (' + comment.repliesCount + ')</button></div>';
    }
    
    var avatarStyle = comment.authorAvatar ? 'background-image:url('+comment.authorAvatar+');background-size:cover;' : '';
    var avatarContent = comment.authorAvatar ? '' : '👤';
    var onlineStatus = comment.isOnline ? 'в сети' : (comment.lastSeen ? 'был ' + formatLastSeen(comment.lastSeen) : '');
    
    return `
        <div class="comment-item" data-comment-id="${commentId}">
            <div class="comment-header">
                <div class="comment-author-avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="comment-author-info">
                    <span class="comment-author-name">${escapeHtml(comment.authorName)}</span>
                    <span class="comment-status">${onlineStatus}</span>
                </div>
                <button class="comment-like-btn" onclick="likeComment('${sliceId}', '${commentId}')">
                    ${comment.userLiked ? '❤️' : '🤍'} <span class="comment-like-count">${comment.likesCount || 0}</span>
                </button>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
            <div class="comment-actions">
                <button class="comment-reply-btn" onclick="toggleReplyForm('${commentId}')">Ответить</button>
            </div>
            ${replyFormHtml}
            ${repliesHtml}
        </div>
    `;
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
        repliesCount: 0,
        isOnline: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    };
    
    var newCommentRef = database.ref('sliceComments/' + sliceId).push();
    newCommentRef.set(commentData).then(function() {
        if (textInput) textInput.value = '';
        // Обновляем счетчик комментариев у поста
        database.ref('slices/' + sliceId + '/commentsCount').transaction(function(c) { return (c || 0) + 1; });
        if (parentId) {
            database.ref('sliceComments/' + sliceId + '/' + parentId + '/repliesCount').transaction(function(c) { return (c || 0) + 1; });
        }
        loadComments(sliceId);
        showNotification('Комментарий добавлен', 'success');
    });
}

function loadReplies(sliceId, commentId) {
    var container = document.getElementById('replies-' + commentId);
    if (!container) return;
    
    database.ref('sliceComments/' + sliceId + '/' + commentId + '/replies').orderByChild('createdAt').limitToLast(5).once('value').then(function(snapshot) {
        var replies = snapshot.val();
        if (!replies) return;
        
        var repliesHtml = '';
        var replyIds = Object.keys(replies);
        replyIds.reverse();
        
        replyIds.forEach(function(replyId) {
            var reply = replies[replyId];
            var avatarStyle = reply.authorAvatar ? 'background-image:url('+reply.authorAvatar+');background-size:cover;' : '';
            var avatarContent = reply.authorAvatar ? '' : '👤';
            repliesHtml += `
                <div class="comment-item reply-item">
                    <div class="comment-header">
                        <div class="comment-author-avatar" style="${avatarStyle}">${avatarContent}</div>
                        <div class="comment-author-info">
                            <span class="comment-author-name">${escapeHtml(reply.authorName)}</span>
                        </div>
                        <button class="comment-like-btn" onclick="likeComment('${sliceId}', '${replyId}')">
                            ${reply.userLiked ? '❤️' : '🤍'} <span>${reply.likesCount || 0}</span>
                        </button>
                    </div>
                    <div class="comment-text">${escapeHtml(reply.text)}</div>
                </div>
            `;
        });
        
        container.innerHTML = '<div class="replies-list">' + repliesHtml + '</div>';
    });
}

function likeComment(sliceId, commentId) {
    var likeRef = database.ref('commentLikes/' + commentId + '/' + currentUser.uid);
    var commentRef = database.ref('sliceComments/' + sliceId + '/' + commentId);
    
    likeRef.once('value').then(function(snap) {
        if (snap.exists()) {
            likeRef.remove();
            commentRef.child('likesCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
        } else {
            likeRef.set(true);
            commentRef.child('likesCount').transaction(function(c) { return (c || 0) + 1; });
        }
    });
}

function toggleReplyForm(commentId) {
    var replyForm = document.querySelector('#replies-' + commentId + ' .reply-form');
    if (replyForm) {
        replyForm.remove();
    } else {
        var commentItem = document.querySelector('.comment-item[data-comment-id="' + commentId + '"]');
        if (commentItem) {
            var formHtml = '<div class="reply-form"><textarea placeholder="Ответить..." id="reply-text-' + commentId + '"></textarea><button onclick="addComment(\'' + window.currentSliceId + '\', \'' + commentId + '\')">Ответить</button></div>';
            commentItem.insertAdjacentHTML('beforeend', formHtml);
        }
    }
}

// Остальные функции (слайдер, поиск, создание поста и т.д.) остаются без изменений
// ... (formatSliceText, formatSliceDate, searchByHashtag, searchByUser, searchSlices, 
//      showSliceContextMenu, editSlice, deleteSlice, pinSlice, unpinSlice, reportSlice,
//      showCreateSliceModal, closeCreateSliceModal, addSliceMedia, updateSlicePreview,
//      publishSlice и т.д. - они уже есть в предыдущей версии)

function initSliceSlider(sliceId, totalSlides) { /* ... */ }
function slideSlice(sliceId, direction) { /* ... */ }
function goToSlide(sliceId, index) { /* ... */ }
function formatSliceText(text) { /* ... */ }
function formatSliceDate(timestamp) { /* ... */ }
function searchByHashtag(tag) { /* ... */ }
function searchByUser(username) { /* ... */ }
function searchSlices() { /* ... */ }
function repostSlice(sliceId) { /* ... */ }
function shareSlice(sliceId) { /* ... */ }
function openSliceLightbox(url) { /* ... */ }
function openSlicesProfile() { /* ... */ }
// ... и все функции контекстного меню и создания поста

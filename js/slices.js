// SLICES (Слайсы) - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ 5.1
// Лайки, репосты, комментарии, профиль (только посты и репосты)
// Баннер (цвета, картинка, GIF) - ИСПРАВЛЕН
// Подписчики, колокольчик, верификация
// Звук при создании слайса
// Модальные окна не перекрываются - ИСПРАВЛЕНО

var currentSlicesTab = 'feed';
var pendingSliceFiles = [];
var searchTimeout = null;
var slicesListener = null;
var openCommentsSliceId = null;
var pendingLikeRequests = {};
var pendingRepostRequests = {};

// Звук при создании слайса
var sliceCreateSound = null;
function initSliceSound() {
    sliceCreateSound = new Audio('https://s33.aconvert.com/convert/p3r68-cdx67/rvt3w-3afhb.mp3');
    sliceCreateSound.load();
}
function playSliceCreateSound() {
    if (sliceCreateSound && (typeof getSoundsEnabled === 'function' ? getSoundsEnabled() : true)) {
        try {
            sliceCreateSound.currentTime = 0;
            sliceCreateSound.play().catch(function(e) { console.log('Звук не воспроизведён:', e); });
        } catch(e) { console.log('Ошибка звука:', e); }
    }
}

// ========== ЗАГРУЗКА ЛЕНТЫ ==========
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
            var likeRef = database.ref('sliceLikes/' + slice.id + '/' + currentUser.uid);
            likeRef.once('value').then(function(snap) {
                slice.data.userLiked = snap.exists();
                var card = createSliceCard(slice.id, slice.data);
                feed.appendChild(card);
            });
        });
    });
}

// ========== СОЗДАНИЕ КАРТОЧКИ ПОСТА ==========
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
    
    var touchTimer = null;
    div.addEventListener('touchstart', function(e) {
        touchTimer = setTimeout(function() {
            showSliceContextMenu(e, sliceId, sliceData);
        }, 500);
    });
    div.addEventListener('touchend', function() { if (touchTimer) clearTimeout(touchTimer); });
    div.addEventListener('touchmove', function() { if (touchTimer) clearTimeout(touchTimer); });
    
    // Шапка с кликабельной аватаркой
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
    
    // Получаем данные о верификации автора
    database.ref('users/' + sliceData.authorId + '/verified').once('value').then(function(snap) {
        if (snap.val() === true) {
            var badgeSpan = div.querySelector('.verified-badge-placeholder');
            if (badgeSpan) {
                badgeSpan.innerHTML = '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:16px; height:16px; cursor:pointer;" onclick="event.stopPropagation(); showVerifiedInfo()">';
            }
        }
    });
    
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
                        <span class="verified-badge-placeholder"></span>
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
    
    if (sliceData.mediaType === 'multiple' && sliceData.mediaUrls && sliceData.mediaUrls.length > 1) {
        setTimeout(function() { initSliceSlider(sliceId, sliceData.mediaUrls.length); }, 100);
    }
    
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
            }
        }
        setTimeout(function() { delete pendingLikeRequests[sliceId]; }, 500);
    }).catch(function() { delete pendingLikeRequests[sliceId]; });
}

// ========== РЕПОСТЫ ==========
function repostSlice(sliceId) {
    if (pendingRepostRequests[sliceId]) return;
    pendingRepostRequests[sliceId] = true;
    
    var repostRef = database.ref('userReposts/' + currentUser.uid + '/' + sliceId);
    
    repostRef.once('value').then(function(snap) {
        if (snap.exists()) {
            repostRef.remove();
            database.ref('slices/' + sliceId + '/repostsCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
            var userRepostQuery = database.ref('slices').orderByChild('originalId').equalTo(sliceId);
            userRepostQuery.once('value').then(function(repostSnap) {
                repostSnap.forEach(function(child) {
                    if (child.val().authorId === currentUser.uid && child.val().type === 'repost') {
                        child.ref.remove();
                    }
                });
            });
            showNotification('Репост удалён', 'info');
            loadSlices();
        } else {
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
                    repostRef.set(true);
                    database.ref('slices/' + sliceId + '/repostsCount').transaction(function(c) { return (c || 0) + 1; });
                    showNotification('Репостнуто!', 'success');
                    loadSlices();
                });
            });
        }
        setTimeout(function() { delete pendingRepostRequests[sliceId]; }, 1000);
    }).catch(function() { delete pendingRepostRequests[sliceId]; });
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

// ========== ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (ИСПРАВЛЕН - БАННЕР РАБОТАЕТ) ==========
function openUserProfile(userId) {
    window.viewingProfileUserId = userId;
    
    // Закрываем предыдущее окно профиля
    var oldModal = document.getElementById('user-profile-modal');
    if (oldModal) oldModal.remove();
    
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    var canEdit = isOwnProfile || isAdmin;
    
    database.ref('users/' + userId).once('value').then(function(userSnap) {
        var userData = userSnap.val();
        if (!userData) return;
        
        var userName = userData.username || 'Пользователь';
        var userAvatar = userData.avatar || '';
        var userBio = userData.bio || 'Нет описания';
        var userVerified = userData.verified === true;
        var userBanner = userData.banner || null;
        var userStatus = userData.status || {};
        var isOnline = userStatus.online === true;
        var lastSeen = userStatus.lastSeen;
        
        window.viewingProfileUserName = userName;
        window.viewingProfileUserAvatar = userAvatar;
        window.viewingProfileUserData = userData;
        
        database.ref('subscriptions/').orderByChild(userId).equalTo(true).once('value').then(function(subsSnap) {
            var subscribersCount = subsSnap.val() ? Object.keys(subsSnap.val()).length : 0;
            
            var bannerStyle = '';
            if (userBanner) {
                if (userBanner.startsWith('#')) {
                    bannerStyle = 'background: ' + userBanner + ';';
                } else {
                    bannerStyle = 'background-image: url(' + userBanner + '); background-size: cover; background-position: center;';
                }
            } else {
                bannerStyle = 'background: linear-gradient(135deg, #228B22, #556B2F);';
            }
            
            var statusText = isOnline ? '<span style="color: #32CD32;">● В сети</span>' : (lastSeen ? 'Был(а) ' + formatLastSeen(lastSeen) : 'Неизвестно');
            
            var modal = document.createElement('div');
            modal.id = 'user-profile-modal';
            modal.className = 'modal';
            modal.style.zIndex = '10001';
            modal.innerHTML = `
                <div class="profile-modal-content">
                    <div class="profile-banner" id="profile-banner" style="${bannerStyle}">
                        ${canEdit ? '<button class="profile-banner-edit-btn" onclick="editProfileBanner()">✏️</button>' : ''}
                        <button class="profile-close-btn" onclick="closeProfileModal()">×</button>
                    </div>
                    <div class="profile-avatar-wrapper">
                        <div class="profile-avatar" id="profile-avatar" style="background-image: url(${userAvatar}); background-size: cover;">
                            ${!userAvatar ? '👤' : ''}
                            ${canEdit ? '<button class="profile-avatar-edit-btn" onclick="editProfileAvatar()">✏️</button>' : ''}
                        </div>
                    </div>
                    <div class="profile-info">
                        <div class="profile-name-row">
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <h2 class="profile-name" id="profile-name" ${canEdit ? 'ondblclick="editProfileName()" style="cursor:pointer;"' : ''}>${escapeHtml(userName)}</h2>
                                ${userVerified ? '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:18px; height:18px; cursor:pointer;" onclick="showVerifiedInfo()">' : ''}
                                ${isAdmin ? '<button onclick="toggleUserVerification(\''+userId+'\')" style="background:none; border:none; cursor:pointer; font-size:14px;">🔘 ' + (userVerified ? 'Снять галочку' : 'Выдать галочку') + '</button>' : ''}
                            </div>
                            ${isOwnProfile ? '' : `
                                <button class="profile-subscribe-btn" id="profile-subscribe-btn" onclick="toggleSubscription()">Подписаться</button>
                                <button class="profile-notify-btn" id="profile-notify-btn" onclick="toggleNotifications()">🔔</button>
                            `}
                        </div>
                        <div class="profile-subscribers">👥 ${subscribersCount} подписчиков</div>
                        <div class="profile-status">${statusText}</div>
                        <p class="profile-bio" id="profile-bio" ${canEdit ? 'ondblclick="editProfileBio()" style="cursor:pointer;"' : ''}>${escapeHtml(userBio)}</p>
                    </div>
                    <div class="profile-tabs">
                        <button class="profile-tab-btn active" onclick="switchProfileTab('posts', '${userId}')">📷 Посты</button>
                        <button class="profile-tab-btn" onclick="switchProfileTab('reposts', '${userId}')">🔄 Репосты</button>
                    </div>
                    <div id="profile-content" class="profile-content">
                        <div class="profile-loading">Загрузка...</div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.classList.remove('hidden');
            
            if (!isOwnProfile) {
                checkSubscriptionStatus(userId);
                checkNotificationStatus(userId);
            }
            
            switchProfileTab('posts', userId);
        });
    });
}

function checkSubscriptionStatus(userId) {
    database.ref('subscriptions/' + currentUser.uid + '/' + userId).once('value').then(function(snap) {
        var isSubscribed = snap.exists();
        var btn = document.getElementById('profile-subscribe-btn');
        if (btn) {
            btn.textContent = isSubscribed ? 'Отписаться' : 'Подписаться';
            btn.style.background = isSubscribed ? '#555' : '#1a1a1a';
        }
    });
}

function checkNotificationStatus(userId) {
    database.ref('subscriptionNotifications/' + currentUser.uid + '/' + userId).once('value').then(function(snap) {
        var notifBtn = document.getElementById('profile-notify-btn');
        if (notifBtn) {
            notifBtn.style.opacity = snap.val() === true ? '1' : '0.5';
            notifBtn.setAttribute('data-enabled', snap.val() === true ? 'true' : 'false');
        }
    });
}

function toggleSubscription() {
    var userId = window.viewingProfileUserId;
    if (!userId || userId === currentUser.uid) return;
    
    var subRef = database.ref('subscriptions/' + currentUser.uid + '/' + userId);
    subRef.once('value').then(function(snap) {
        if (snap.exists()) {
            subRef.remove();
            showNotification('Вы отписались', 'info');
        } else {
            subRef.set(true);
            showNotification('Вы подписались', 'success');
        }
        checkSubscriptionStatus(userId);
        database.ref('subscriptions/').orderByChild(userId).equalTo(true).once('value').then(function(subsSnap) {
            var count = subsSnap.val() ? Object.keys(subsSnap.val()).length : 0;
            var subsDiv = document.querySelector('.profile-subscribers');
            if (subsDiv) subsDiv.textContent = '👥 ' + count + ' подписчиков';
        });
    });
}

function toggleNotifications() {
    var userId = window.viewingProfileUserId;
    if (!userId || userId === currentUser.uid) return;
    
    var notifRef = database.ref('subscriptionNotifications/' + currentUser.uid + '/' + userId);
    notifRef.once('value').then(function(snap) {
        var currentState = snap.val() === true;
        if (currentState) {
            notifRef.remove();
            showNotification('Уведомления выключены', 'info');
        } else {
            notifRef.set(true);
            showNotification('Уведомления включены', 'success');
        }
        var notifBtn = document.getElementById('profile-notify-btn');
        if (notifBtn) notifBtn.style.opacity = !currentState ? '1' : '0.5';
    });
}

function switchProfileTab(tab, userId) {
    var content = document.getElementById('profile-content');
    if (!content) return;
    
    var btns = document.querySelectorAll('.profile-tab-btn');
    btns.forEach(function(btn) { btn.classList.remove('active'); });
    if (tab === 'posts') {
        if (btns[0]) btns[0].classList.add('active');
    } else {
        if (btns[1]) btns[1].classList.add('active');
    }
    
    content.innerHTML = '<div class="profile-loading">Загрузка...</div>';
    
    var query = database.ref('slices').orderByChild('authorId').equalTo(userId);
    query.once('value').then(function(snapshot) {
        var slices = snapshot.val();
        content.innerHTML = '';
        
        if (!slices) {
            content.innerHTML = '<div class="profile-empty">Нет постов</div>';
            return;
        }
        
        var slicesArray = [];
        for (var id in slices) {
            var slice = slices[id];
            if (tab === 'reposts' && slice.type !== 'repost') continue;
            if (tab === 'posts' && slice.type === 'repost') continue;
            slicesArray.push({ id: id, data: slice });
        }
        
        slicesArray.sort(function(a, b) { return (b.data.createdAt || 0) - (a.data.createdAt || 0); });
        
        slicesArray.forEach(function(slice) {
            var card = createProfileSliceCard(slice.id, slice.data);
            content.appendChild(card);
        });
    });
}

function createProfileSliceCard(sliceId, sliceData) {
    var div = document.createElement('div');
    div.className = 'slice-card profile-slice-card';
    div.setAttribute('data-slice-id', sliceId);
    
    var avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
    var avatarContent = sliceData.authorAvatar ? '' : '👤';
    
    var mediaHtml = '';
    if (sliceData.mediaUrl) {
        mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-image" onclick="openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
    } else if (sliceData.mediaUrls && sliceData.mediaUrls.length) {
        mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrls[0]+'" class="slice-image" onclick="openSliceLightbox(\''+sliceData.mediaUrls[0]+'\')"></div>';
    }
    
    var textHtml = sliceData.text ? '<div class="slice-text">'+formatSliceText(sliceData.text)+'</div>' : '';
    var repostBadge = sliceData.type === 'repost' ? '<div class="repost-badge">🔄 Репостнуто с @' + escapeHtml(sliceData.originalAuthorName) + '</div>' : '';
    
    div.innerHTML = `
        <div class="slice-header">
            <div class="slice-author">
                <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="slice-author-info">
                    <span class="slice-author-name">${escapeHtml(sliceData.authorName)}</span>
                    <span class="slice-date">${formatSliceDate(sliceData.createdAt)}</span>
                </div>
            </div>
        </div>
        ${repostBadge}
        ${mediaHtml}
        ${textHtml}
        <div class="slice-actions">
            <button class="slice-action-btn" onclick="likeSlice('${sliceId}')">❤️ <span>${sliceData.likesCount || 0}</span></button>
            <button class="slice-action-btn" onclick="toggleComments('${sliceId}')">💬 <span>${sliceData.commentsCount || 0}</span></button>
            <button class="slice-action-btn" onclick="repostSlice('${sliceId}')">🔄 <span>${sliceData.repostsCount || 0}</span></button>
        </div>
    `;
    
    return div;
}

function closeProfileModal() {
    var modal = document.getElementById('user-profile-modal');
    if (modal) modal.remove();
    // Закрываем палитру цветов, если она открыта
    closeColorPickerModal();
}

// ========== РЕДАКТИРОВАНИЕ ПРОФИЛЯ (ИСПРАВЛЕНО - МОДАЛКИ НЕ ПЕРЕКРЫВАЮТСЯ) ==========
function editProfileBanner() {
    var userId = window.viewingProfileUserId;
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) return;
    
    var colors = ['#228B22', '#556B2F', '#1a5c1a', '#32CD32', '#6b8e6b', '#000000', '#1E90FF', '#FFD700', '#FFA500', '#FF69B4', '#87CEEB', '#9370DB'];
    
    // Закрываем предыдущее окно выбора цвета
    var oldColorModal = document.getElementById('color-picker-modal');
    if (oldColorModal) oldColorModal.remove();
    
    var modal = document.createElement('div');
    modal.id = 'color-picker-modal';
    modal.className = 'modal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px;">
            <div class="modal-header">
                <h3>Выберите баннер</h3>
                <button onclick="closeColorPickerModal()" class="btn-close">×</button>
            </div>
            <div class="banner-color-picker" style="display:flex; flex-wrap:wrap; gap:10px; padding:15px; justify-content:center;">
                ${colors.map(c => `<div class="banner-color-option" style="background:${c}; width:40px; height:40px; border-radius:50%; cursor:pointer; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="setProfileBanner('${c}')"></div>`).join('')}
            </div>
            <div style="padding:10px; text-align:center;">
                <button onclick="uploadProfileBannerImage()" class="btn-primary" style="width: auto; padding: 8px 20px;">📷 Загрузить картинку/GIF</button>
            </div>
            <div style="padding:10px; text-align:center;">
                <button onclick="setProfileBanner('')" class="btn-secondary">Сбросить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
}

function closeColorPickerModal() {
    var modal = document.getElementById('color-picker-modal');
    if (modal) modal.remove();
}

function setProfileBanner(colorOrUrl) {
    var userId = window.viewingProfileUserId;
    if (!userId) return;
    
    var updateData = {};
    if (colorOrUrl) {
        updateData.banner = colorOrUrl;
    } else {
        updateData.banner = null;
    }
    
    database.ref('users/' + userId).update(updateData).then(function() {
        showNotification('Баннер обновлён', 'success');
        closeColorPickerModal();
        
        // Обновляем баннер в открытом профиле без перезагрузки
        var bannerDiv = document.getElementById('profile-banner');
        if (bannerDiv) {
            if (colorOrUrl) {
                if (colorOrUrl.startsWith('#')) {
                    bannerDiv.style.background = colorOrUrl;
                    bannerDiv.style.backgroundImage = 'none';
                } else {
                    bannerDiv.style.backgroundImage = 'url(' + colorOrUrl + ')';
                    bannerDiv.style.backgroundSize = 'cover';
                    bannerDiv.style.backgroundPosition = 'center';
                }
            } else {
                bannerDiv.style.background = 'linear-gradient(135deg, #228B22, #556B2F)';
                bannerDiv.style.backgroundImage = 'none';
            }
        }
        
        if (window.viewingProfileUserData) {
            window.viewingProfileUserData.banner = colorOrUrl || null;
        }
    }).catch(function(err) {
        showNotification('Ошибка: ' + err.message, 'error');
        closeColorPickerModal();
    });
}

function uploadProfileBannerImage() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            showNotification('Загрузка...', 'info');
            if (typeof uploadToImgBB === 'function') {
                uploadToImgBB(file).then(function(data) {
                    setProfileBanner(data.url);
                }).catch(function(err) {
                    showNotification('Ошибка загрузки: ' + err.message, 'error');
                });
            } else {
                showNotification('Функция загрузки не найдена', 'error');
            }
        }
    };
    input.click();
}

function editProfileAvatar() {
    var userId = window.viewingProfileUserId;
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) return;
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            showNotification('Загрузка...', 'info');
            if (typeof uploadToImgBB === 'function') {
                uploadToImgBB(file).then(function(data) {
                    database.ref('users/' + userId + '/avatar').set(data.url).then(function() {
                        showNotification('Аватар обновлён', 'success');
                        if (window.viewingProfileUserId === currentUser.uid && typeof updateUserDisplay === 'function') {
                            updateUserDisplay();
                        }
                        openUserProfile(userId);
                    });
                }).catch(function(err) {
                    showNotification('Ошибка загрузки: ' + err.message, 'error');
                });
            } else {
                showNotification('Функция загрузки не найдена', 'error');
            }
        }
    };
    input.click();
}

function editProfileName() {
    var userId = window.viewingProfileUserId;
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) return;
    
    var newName = prompt('Введите новое имя:', window.viewingProfileUserName);
    if (newName && newName.trim()) {
        database.ref('users/' + userId + '/username').set(newName.trim()).then(function() {
            showNotification('Имя обновлено', 'success');
            if (window.viewingProfileUserId === currentUser.uid && typeof updateUserDisplay === 'function') {
                updateUserDisplay();
            }
            openUserProfile(userId);
        });
    }
}

function editProfileBio() {
    var userId = window.viewingProfileUserId;
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) return;
    
    var currentBio = document.getElementById('profile-bio')?.textContent || '';
    var newBio = prompt('Введите новое описание:', currentBio === 'Нет описания' ? '' : currentBio);
    if (newBio !== null) {
        database.ref('users/' + userId + '/bio').set(newBio.trim()).then(function() {
            showNotification('Описание обновлено', 'success');
            openUserProfile(userId);
        });
    }
}

function toggleUserVerification(userId) {
    if (!window.isSuperAdmin) return;
    
    database.ref('users/' + userId + '/verified').once('value').then(function(snap) {
        var isVerified = snap.val() === true;
        database.ref('users/' + userId + '/verified').set(!isVerified).then(function() {
            showNotification(isVerified ? 'Галочка снята' : 'Галочка выдана', 'success');
            if (userId === currentUser.uid && currentUserData) {
                currentUserData.verified = !isVerified;
            }
            openUserProfile(userId);
        });
    });
}

function showVerifiedInfo() {
    alert('Этот пользователь имеет подтверждённый, верифицированный аккаунт, подтверждённый администрацией Kukumber 🌟');
}

// ========== СЛАЙДЕР ==========
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
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        var feed = document.getElementById('slices-feed');
        if (!feed) return;
        if (!query) { loadSlices(); return; }
        
        feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Поиск...</p></div>';
        
        database.ref('slices').orderByChild('createdAt').limitToLast(100).once('value').then(function(snapshot) {
            var slices = snapshot.val();
            var results = [];
            for (var id in slices) {
                var slice = slices[id];
                var match = false;
                if (slice.text && slice.text.toLowerCase().includes(query)) match = true;
                if (slice.hashtags && slice.hashtags.some(function(tag) { return '#' + tag.toLowerCase().includes(query) || tag.toLowerCase().includes(query.replace('#', '')); })) match = true;
                if (slice.authorName && slice.authorName.toLowerCase().includes(query.replace('@', ''))) match = true;
                if (match) results.push({ id: id, data: slice });
            }
            
            feed.innerHTML = '';
            if (results.length === 0) { feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Ничего не найдено</p></div>'; return; }
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
    if (currentUser) {
        openUserProfile(currentUser.uid);
    }
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
        if (!sliceData.pinned) menuHtml += '<div class="context-menu-item" onclick="pinSlice(\''+sliceId+'\')">📌 Закрепить в ленте</div>';
        else menuHtml += '<div class="context-menu-item" onclick="unpinSlice(\''+sliceId+'\')">📌 Открепить</div>';
        menuHtml += '<div class="context-menu-item" onclick="reportSlice(\''+sliceId+'\')">⚠️ Пожаловаться</div>';
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
        var newHashtags = extractHashtags(newText);
        database.ref('slices/' + sliceId).update({ text: newText, hashtags: newHashtags, editedAt: firebase.database.ServerValue.TIMESTAMP, edited: true })
            .then(function() { showNotification('Пост отредактирован!', 'success'); loadSlices(); })
            .catch(function() { showNotification('Ошибка редактирования', 'error'); });
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
    }).catch(function() { showNotification('Ошибка удаления', 'error'); });
    closeSliceContextMenu();
}

function pinSlice(sliceId) {
    database.ref('slices/' + sliceId).update({ pinned: true, pinnedAt: firebase.database.ServerValue.TIMESTAMP })
        .then(function() { showNotification('Пост закреплён!', 'success'); loadSlices(); });
    closeSliceContextMenu();
}

function unpinSlice(sliceId) {
    database.ref('slices/' + sliceId).update({ pinned: false, pinnedAt: null })
        .then(function() { showNotification('Пост откреплён', 'info'); loadSlices(); });
    closeSliceContextMenu();
}

function reportSlice(sliceId) {
    var reason = prompt('Укажите причину жалобы:');
    if (!reason) return;
    database.ref('reports/slices/' + sliceId).push({
        userId: currentUser.uid, userName: currentUserData?.username || 'Пользователь',
        reason: reason, timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(function() { showNotification('Жалоба отправлена администрации', 'success'); });
    closeSliceContextMenu();
}

function closeSliceContextMenu() { var menu = document.getElementById('slice-context-menu'); if (menu) menu.remove(); }

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

function closeCreateSliceModal() { var modal = document.getElementById('create-slice-modal'); if (modal) modal.classList.add('hidden'); }

function addSliceMedia() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(function(file) {
            if (file.size > 15 * 1024 * 1024) { showNotification('Файл слишком большой (макс. 15MB)', 'error'); return; }
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
                div.innerHTML = `<img src="${e.target.result}" class="slice-preview-img"><button class="slice-preview-remove" onclick="removeSliceMedia(${idx})">×</button>${isGif ? '<span class="slice-preview-gif-badge">GIF</span>' : ''}`;
                previewArea.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    }
    updateSlicePreviewCounter();
}

function updateSlicePreviewCounter() { var counter = document.getElementById('slice-preview-counter'); if (counter) counter.textContent = pendingSliceFiles.length; }

function removeSliceMedia(index) { pendingSliceFiles.splice(index, 1); updateSlicePreview(); }

function extractHashtags(text) { var hashtags = text.match(/#[а-яА-Яa-zA-Z0-9_]+/g); if (!hashtags) return []; return hashtags.map(function(tag) { return tag.substring(1); }); }

async function publishSlice() {
    var text = document.getElementById('slice-text').value.trim();
    var hashtagsInput = document.getElementById('slice-hashtags-input').value.trim();
    if (pendingSliceFiles.length === 0 && !text) { showNotification('Добавьте текст или фото', 'error'); return; }
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
            if (typeof uploadToImgBB === 'function') {
                var url = await uploadToImgBB(pendingSliceFiles[i]);
                mediaUrls.push(url);
            } else {
                showNotification('Функция загрузки не найдена', 'error');
                return;
            }
        }
        var sliceData = {
            authorId: currentUser.uid, authorName: currentUserData.username || 'Пользователь',
            authorAvatar: currentUserData.avatar || '', text: text, hashtags: hashtags,
            mediaType: mediaUrls.length > 1 ? 'multiple' : (mediaUrls.length === 1 ? 'single' : 'none'),
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : null, mediaUrl: mediaUrls.length === 1 ? mediaUrls[0] : null,
            likesCount: 0, commentsCount: 0, repostsCount: 0, viewsCount: 0, pinned: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        await database.ref('slices/').push(sliceData);
        
        playSliceCreateSound();
        
        showNotification('Пост опубликован! 🍕', 'success');
        closeCreateSliceModal();
        loadSlices();
    } catch (error) { console.error(error); showNotification('Ошибка публикации', 'error'); }
}

// Инициализация звуков
if (typeof initSliceSound === 'function') initSliceSound();

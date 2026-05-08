// SLICES (Слайсы) - ПОСЛЕДНЯЯ СТАБИЛЬНАЯ ВЕРСИЯ
// Баннеры, аватарки, посты, репосты, профиль - всё работает быстро

var pendingSliceFiles = [];
var searchTimeout = null;

// ========== ЗАГРУЗКА ЛЕНТЫ ==========
function loadSlices() {
    var feed = document.getElementById('slices-feed');
    if (!feed) return;
    
    var searchInput = document.getElementById('slices-search-input');
    if (searchInput) searchInput.value = '';
    
    feed.innerHTML = '<div class="empty-slices"><span>🍕</span><p>Загрузка...</p></div>';
    
    database.ref('slices').orderByChild('createdAt').limitToLast(100).once('value', function(snapshot) {
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
        
        var loadIndex = 0;
        function loadNext() {
            if (loadIndex >= slicesArray.length) return;
            var slice = slicesArray[loadIndex];
            var likeRef = database.ref('sliceLikes/' + slice.id + '/' + currentUser.uid);
            likeRef.once('value').then(function(snap) {
                slice.data.userLiked = snap.exists();
                feed.appendChild(createSliceCard(slice.id, slice.data));
                loadIndex++;
                loadNext();
            });
        }
        loadNext();
    });
}

// ========== КАРТОЧКА ПОСТА ==========
function createSliceCard(sliceId, sliceData) {
    var div = document.createElement('div');
    div.className = 'slice-card';
    div.setAttribute('data-slice-id', sliceId);
    
    var avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
    var avatarContent = sliceData.authorAvatar ? '' : '👤';
    
    // Медиа
    var mediaHtml = '';
    if (sliceData.mediaType === 'multiple' && sliceData.mediaUrls && sliceData.mediaUrls.length) {
        mediaHtml = '<div class="slice-media-multiple">';
        mediaHtml += '<div class="slice-media-slider">';
        sliceData.mediaUrls.forEach(function(url) {
            var isGif = url.toLowerCase().endsWith('.gif');
            var imgClass = isGif ? 'slice-gif' : 'slice-image';
            mediaHtml += '<div class="slice-slide"><img src="'+url+'" class="'+imgClass+'" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+url+'\')"></div>';
        });
        mediaHtml += '</div>';
        if (sliceData.mediaUrls.length > 1) {
            mediaHtml += '<button class="slice-slider-prev" onclick="event.stopPropagation(); sliceSlide(this, -1)">←</button>';
            mediaHtml += '<button class="slice-slider-next" onclick="event.stopPropagation(); sliceSlide(this, 1)">→</button>';
        }
        mediaHtml += '</div>';
    } else if (sliceData.mediaUrl) {
        var isGif = sliceData.mediaUrl.toLowerCase().endsWith('.gif');
        var imgClass = isGif ? 'slice-gif' : 'slice-image';
        mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="'+imgClass+'" loading="lazy" onclick="openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
    }
    
    var textHtml = sliceData.text ? '<div class="slice-text">'+formatSliceText(sliceData.text)+'</div>' : '';
    
    var hashtagsHtml = '';
    if (sliceData.hashtags && sliceData.hashtags.length) {
        hashtagsHtml = '<div class="slice-hashtags">';
        sliceData.hashtags.forEach(function(tag) {
            hashtagsHtml += '<span class="slice-hashtag" onclick="searchByHashtag(\''+tag+'\')">#'+tag+'</span>';
        });
        hashtagsHtml += '</div>';
    }
    
    var pinnedBadge = sliceData.pinned ? '<span class="slice-pinned-badge">📌 Закреплено</span>' : '';
    
    var likeIcon = sliceData.userLiked ? 
        '<img src="https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png" style="width:24px; height:24px;">' : 
        '<img src="https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png" style="width:24px; height:24px;">';
    var commentIcon = '<img src="https://i.ibb.co/PzVWZ3dd/980-E0-C70-E93-B-4-AA0-80-AD-883-AD22-EB40-C.png" style="width:24px; height:24px;">';
    var repostIcon = '<img src="https://i.ibb.co/BHzJVy1L/3545-DF6-B-CA20-410-D-8837-DB9-EC1-B2-A080.png" style="width:24px; height:24px;">';
    
    div.innerHTML = `
        <div class="slice-header">
            <div class="slice-author" onclick="openUserProfile('${sliceData.authorId}')">
                <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="slice-author-info">
                    <div class="slice-author-name-row">
                        <span class="slice-author-name">${escapeHtml(sliceData.authorName)}</span>
                        <span class="verified-badge" data-user="${sliceData.authorId}"></span>
                    </div>
                    <span class="slice-date">${formatSliceDate(sliceData.createdAt)}</span>
                </div>
            </div>
            <div class="slice-views">👁️ ${sliceData.viewsCount || 0}</div>
        </div>
        ${pinnedBadge}
        ${mediaHtml}
        ${textHtml}
        ${hashtagsHtml}
        <div class="slice-actions">
            <button class="slice-action-btn" onclick="likeSlice('${sliceId}', this)">${likeIcon} <span>${sliceData.likesCount || 0}</span></button>
            <button class="slice-action-btn" onclick="toggleComments('${sliceId}')">${commentIcon} <span>${sliceData.commentsCount || 0}</span></button>
            <button class="slice-action-btn" onclick="repostSlice('${sliceId}')">${repostIcon} <span>${sliceData.repostsCount || 0}</span></button>
            <button class="slice-action-btn" onclick="shareSlice('${sliceId}')">↗️</button>
        </div>
        <div id="comments-block-${sliceId}" class="comments-block hidden"></div>
    `;
    
    // Проверка верификации
    database.ref('users/' + sliceData.authorId + '/verified').once('value').then(function(snap) {
        if (snap.val() === true) {
            var badgeSpan = div.querySelector('.verified-badge');
            if (badgeSpan) badgeSpan.innerHTML = '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:16px; height:16px;" onclick="event.stopPropagation(); showVerifiedInfo()">';
        }
    });
    
    // Просмотры
    var viewedKey = 'viewed_slice_' + sliceId;
    if (!sessionStorage.getItem(viewedKey)) {
        sessionStorage.setItem(viewedKey, 'true');
        database.ref('slices/' + sliceId + '/viewsCount').transaction(function(v) { return (v || 0) + 1; });
    }
    
    return div;
}

function sliceSlide(btn, dir) {
    var container = btn.closest('.slice-media-multiple');
    var slider = container.querySelector('.slice-media-slider');
    var slides = slider.querySelectorAll('.slice-slide');
    var current = parseInt(slider.dataset.current || 0);
    var newIndex = current + dir;
    if (newIndex < 0) newIndex = slides.length - 1;
    if (newIndex >= slides.length) newIndex = 0;
    slider.style.transform = 'translateX(-' + (newIndex * 100) + '%)';
    slider.dataset.current = newIndex;
}

// ========== ЛАЙК ==========
function likeSlice(sliceId, btn) {
    var likeRef = database.ref('sliceLikes/' + sliceId + '/' + currentUser.uid);
    var sliceRef = database.ref('slices/' + sliceId);
    var countSpan = btn.querySelector('span');
    var currentCount = parseInt(countSpan.textContent) || 0;
    
    likeRef.once('value').then(function(snap) {
        if (snap.exists()) {
            likeRef.remove();
            sliceRef.child('likesCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
            countSpan.textContent = Math.max(currentCount - 1, 0);
            btn.innerHTML = '<img src="https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png" style="width:24px; height:24px;"> <span>' + Math.max(currentCount - 1, 0) + '</span>';
        } else {
            likeRef.set(true);
            sliceRef.child('likesCount').transaction(function(c) { return (c || 0) + 1; });
            countSpan.textContent = currentCount + 1;
            btn.innerHTML = '<img src="https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png" style="width:24px; height:24px;"> <span>' + (currentCount + 1) + '</span>';
        }
    });
}

// ========== ПРОФИЛЬ (С РАБОЧИМ БАННЕРОМ) ==========
function openUserProfile(userId) {
    // Закрываем старое окно, если открыто
    var oldModal = document.getElementById('user-profile-modal');
    if (oldModal) oldModal.remove();
    
    database.ref('users/' + userId).once('value').then(function(userSnap) {
        var userData = userSnap.val();
        if (!userData) return;
        
        var isOwnProfile = (userId === currentUser.uid);
        var isAdmin = window.isSuperAdmin === true;
        var canEdit = isOwnProfile || isAdmin;
        
        // Получаем баннер
        var userBanner = userData.banner || null;
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
        
        // Получаем количество подписчиков
        var subscribersCount = 0;
        database.ref('subscriptions').orderByChild(userId).equalTo(true).once('value').then(function(subsSnap) {
            if (subsSnap.val()) subscribersCount = Object.keys(subsSnap.val()).length;
            
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
                        <div class="profile-avatar" style="background-image: url(${userData.avatar || ''}); background-size: cover;">
                            ${!userData.avatar ? '👤' : ''}
                            ${canEdit ? '<button class="profile-avatar-edit-btn" onclick="editProfileAvatar()">✏️</button>' : ''}
                        </div>
                    </div>
                    <div class="profile-info">
                        <div class="profile-name-row">
                            <h2 class="profile-name" ${canEdit ? 'ondblclick="editProfileName()" style="cursor:pointer;"' : ''}>${escapeHtml(userData.username || 'Пользователь')}</h2>
                            ${userData.verified ? '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:18px; height:18px;" onclick="showVerifiedInfo()">' : ''}
                            ${isAdmin ? '<button onclick="toggleUserVerification(\''+userId+'\')" class="verify-btn">' + (userData.verified ? 'Снять галочку' : 'Выдать галочку') + '</button>' : ''}
                            ${!isOwnProfile ? '<button class="profile-subscribe-btn" onclick="toggleSubscription()">Подписаться</button><button class="profile-notify-btn" onclick="toggleNotifications()">🔔</button>' : ''}
                        </div>
                        <div class="profile-subscribers">👥 ${subscribersCount} подписчиков</div>
                        <div class="profile-status">${userData.status?.online ? '🟢 В сети' : (userData.status?.lastSeen ? 'Был ' + formatLastSeen(userData.status.lastSeen) : 'Неизвестно')}</div>
                        <p class="profile-bio" ${canEdit ? 'ondblclick="editProfileBio()" style="cursor:pointer;"' : ''}>${escapeHtml(userData.bio || 'Нет описания')}</p>
                    </div>
                    <div class="profile-tabs">
                        <button class="profile-tab-btn active" onclick="switchProfileTab('posts', '${userId}')">📷 Посты</button>
                        <button class="profile-tab-btn" onclick="switchProfileTab('reposts', '${userId}')">🔄 Репосты</button>
                    </div>
                    <div id="profile-content" class="profile-content">Загрузка...</div>
                </div>
            `;
            document.body.appendChild(modal);
            switchProfileTab('posts', userId);
        });
    });
}

// ========== РЕДАКТИРОВАНИЕ БАННЕРА ==========
function editProfileBanner() {
    var userId = window.currentProfileUserId || window.viewingProfileUserId;
    if (!userId) return;
    
    var colors = ['#228B22', '#556B2F', '#1a5c1a', '#32CD32', '#6b8e6b', '#000000', '#1E90FF', '#FFD700', '#FFA500', '#FF69B4', '#87CEEB', '#9370DB'];
    
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px;">
            <div class="modal-header"><h3>Выберите баннер</h3><button onclick="this.closest('.modal').remove()" class="btn-close">×</button></div>
            <div class="banner-color-picker" style="display:flex; flex-wrap:wrap; gap:10px; padding:15px; justify-content:center;">
                ${colors.map(c => `<div class="banner-color-option" style="background:${c}; width:40px; height:40px; border-radius:50%; cursor:pointer;" onclick="setProfileBanner('${c}')"></div>`).join('')}
            </div>
            <div style="padding:10px; text-align:center;"><button onclick="uploadProfileBannerImage()" class="btn-primary">📷 Загрузить картинку/GIF</button></div>
            <div style="padding:10px; text-align:center;"><button onclick="setProfileBanner('')" class="btn-secondary">Сбросить</button></div>
        </div>
    `;
    document.body.appendChild(modal);
}

function setProfileBanner(colorOrUrl) {
    var userId = window.currentProfileUserId || window.viewingProfileUserId;
    if (!userId) return;
    
    var updateData = colorOrUrl ? { banner: colorOrUrl } : { banner: null };
    database.ref('users/' + userId).update(updateData).then(function() {
        showNotification('Баннер обновлён', 'success');
        closeAllModals();
        openUserProfile(userId);
    });
}

function uploadProfileBannerImage() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка...', 'info');
        if (typeof uploadToImgBB === 'function') {
            uploadToImgBB(file).then(function(data) {
                setProfileBanner(data.url);
            }).catch(function() { showNotification('Ошибка загрузки', 'error'); });
        }
    };
    input.click();
}

function editProfileAvatar() {
    var userId = window.currentProfileUserId || window.viewingProfileUserId;
    if (!userId) return;
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка...', 'info');
        if (typeof uploadToImgBB === 'function') {
            uploadToImgBB(file).then(function(data) {
                database.ref('users/' + userId + '/avatar').set(data.url).then(function() {
                    showNotification('Аватар обновлён', 'success');
                    if (userId === currentUser.uid && typeof updateUserDisplay === 'function') updateUserDisplay();
                    openUserProfile(userId);
                });
            }).catch(function() { showNotification('Ошибка загрузки', 'error'); });
        }
    };
    input.click();
}

function editProfileName() {
    var userId = window.currentProfileUserId || window.viewingProfileUserId;
    if (!userId) return;
    var newName = prompt('Введите новое имя:', window.currentProfileName || '');
    if (newName && newName.trim()) {
        database.ref('users/' + userId + '/username').set(newName.trim()).then(function() {
            showNotification('Имя обновлено', 'success');
            if (userId === currentUser.uid && typeof updateUserDisplay === 'function') updateUserDisplay();
            openUserProfile(userId);
        });
    }
}

function editProfileBio() {
    var userId = window.currentProfileUserId || window.viewingProfileUserId;
    if (!userId) return;
    var currentBio = document.querySelector('.profile-bio')?.textContent || '';
    var newBio = prompt('Введите новое описание:', currentBio === 'Нет описания' ? '' : currentBio);
    if (newBio !== null) {
        database.ref('users/' + userId + '/bio').set(newBio.trim()).then(function() {
            showNotification('Описание обновлено', 'success');
            openUserProfile(userId);
        });
    }
}

function toggleSubscription() {
    var userId = window.currentProfileUserId || window.viewingProfileUserId;
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
        openUserProfile(userId);
    });
}

function toggleNotifications() {
    var userId = window.currentProfileUserId || window.viewingProfileUserId;
    if (!userId || userId === currentUser.uid) return;
    var notifRef = database.ref('subscriptionNotifications/' + currentUser.uid + '/' + userId);
    notifRef.once('value').then(function(snap) {
        if (snap.val() === true) {
            notifRef.remove();
            showNotification('Уведомления выключены', 'info');
        } else {
            notifRef.set(true);
            showNotification('Уведомления включены', 'success');
        }
        openUserProfile(userId);
    });
}

function toggleUserVerification(userId) {
    if (!window.isSuperAdmin) return;
    database.ref('users/' + userId + '/verified').once('value').then(function(snap) {
        var isVerified = snap.val() === true;
        database.ref('users/' + userId + '/verified').set(!isVerified).then(function() {
            showNotification(isVerified ? 'Галочка снята' : 'Галочка выдана', 'success');
            openUserProfile(userId);
        });
    });
}

function switchProfileTab(tab, userId) {
    window.currentProfileUserId = userId;
    window.currentProfileName = document.querySelector('.profile-name')?.textContent;
    
    var content = document.getElementById('profile-content');
    if (!content) return;
    
    var btns = document.querySelectorAll('.profile-tab-btn');
    btns.forEach(function(btn) { btn.classList.remove('active'); });
    if (tab === 'posts') btns[0]?.classList.add('active');
    else btns[1]?.classList.add('active');
    
    content.innerHTML = 'Загрузка...';
    
    var query = database.ref('slices').orderByChild('authorId').equalTo(userId);
    query.once('value').then(function(snapshot) {
        var slices = snapshot.val();
        content.innerHTML = '';
        if (!slices) { content.innerHTML = '<div class="profile-empty">Нет постов</div>'; return; }
        
        var slicesArray = [];
        for (var id in slices) {
            var slice = slices[id];
            if (tab === 'reposts' && slice.type !== 'repost') continue;
            if (tab === 'posts' && slice.type === 'repost') continue;
            slicesArray.push({ id: id, data: slice });
        }
        slicesArray.sort(function(a, b) { return (b.data.createdAt || 0) - (a.data.createdAt || 0); });
        slicesArray.forEach(function(slice) {
            content.appendChild(createMiniSliceCard(slice.id, slice.data));
        });
    });
}

function createMiniSliceCard(sliceId, sliceData) {
    var div = document.createElement('div');
    div.className = 'slice-card mini-slice';
    var avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
    var mediaHtml = sliceData.mediaUrl ? '<img src="'+sliceData.mediaUrl+'" style="max-height:150px; object-fit:cover; width:100%; border-radius:12px;">' : '';
    var repostBadge = sliceData.type === 'repost' ? '<div class="repost-badge">🔄 Репост с @' + escapeHtml(sliceData.originalAuthorName) + '</div>' : '';
    div.innerHTML = `
        <div class="slice-header"><div class="avatar" style="${avatarStyle}">${sliceData.authorAvatar ? '' : '👤'}</div><div><b>${escapeHtml(sliceData.authorName)}</b><br><small>${formatSliceDate(sliceData.createdAt)}</small></div></div>
        ${repostBadge}${mediaHtml}<div class="slice-text">${escapeHtml(sliceData.text?.substring(0, 100))}${sliceData.text?.length > 100 ? '...' : ''}</div>
        <div class="slice-actions"><button onclick="likeSlice('${sliceId}', this)">❤️ ${sliceData.likesCount || 0}</button></div>
    `;
    return div;
}

function closeProfileModal() { document.getElementById('user-profile-modal')?.remove(); }
function showVerifiedInfo() { alert('Верифицированный аккаунт Kukumber 🌟'); }

// ========== ОСТАЛЬНЫЕ ФУНКЦИИ ==========
function formatSliceText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#228B22;">$1</a>');
    return text;
}

function formatSliceDate(timestamp) {
    if (!timestamp) return '';
    var d = new Date(timestamp), n = new Date();
    var diff = Math.floor((n - d) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' мин назад';
    if (diff < 86400) return 'сегодня в ' + d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    return d.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'});
}

function searchByHashtag(tag) { document.getElementById('slices-search-input').value = '#' + tag; performSearch(); }
function searchByUser(username) { document.getElementById('slices-search-input').value = '@' + username; performSearch(); }

function performSearch() {
    var query = document.getElementById('slices-search-input').value.trim().toLowerCase();
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        if (!query) { loadSlices(); return; }
        var feed = document.getElementById('slices-feed');
        feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Поиск...</p></div>';
        database.ref('slices').once('value').then(function(snap) {
            var results = [], slices = snap.val();
            for (var id in slices) {
                var s = slices[id];
                if (s.text?.toLowerCase().includes(query) || s.hashtags?.some(t => '#'+t.toLowerCase().includes(query)) || s.authorName?.toLowerCase().includes(query.replace('@',''))) {
                    results.push({ id: id, data: s });
                }
            }
            feed.innerHTML = '';
            if (!results.length) { feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Ничего не найдено</p></div>'; return; }
            results.sort((a,b) => (b.data.createdAt||0)-(a.data.createdAt||0));
            results.forEach(function(r) {
                database.ref('sliceLikes/' + r.id + '/' + currentUser.uid).once('value').then(function(likeSnap) {
                    r.data.userLiked = likeSnap.exists();
                    feed.appendChild(createSliceCard(r.id, r.data));
                });
            });
        });
    }, 300);
}

function searchSlices() { performSearch(); }
function openSliceLightbox(url) { var lb = document.getElementById('image-lightbox'); if(lb) { document.getElementById('lightbox-image').src = url; lb.classList.remove('hidden'); } }
function openSlicesProfile() { if(currentUser) openUserProfile(currentUser.uid); }
function shareSlice(sliceId) { navigator.share ? navigator.share({title:'Слайс', url:location.href+'?slice='+sliceId}) : (navigator.clipboard.writeText(location.href+'?slice='+sliceId), showNotification('Ссылка скопирована', 'success')); }

// Репост, комментарии, создание поста - упрощённые версии
function repostSlice(sliceId) { showNotification('Репост в разработке', 'info'); }
function toggleComments(sliceId) { var block = document.getElementById('comments-block-'+sliceId); if(block) block.classList.toggle('hidden'); }

// Создание поста
function showCreateSliceModal() { document.getElementById('create-slice-modal').classList.remove('hidden'); pendingSliceFiles = []; document.getElementById('slice-preview-area').innerHTML = ''; document.getElementById('slice-text').value = ''; document.getElementById('slice-preview-container').classList.add('hidden'); document.getElementById('slice-upload-area').style.display = ''; }
function closeCreateSliceModal() { document.getElementById('create-slice-modal').classList.add('hidden'); }
function addSliceMedia() { var input = document.createElement('input'); input.type='file'; input.accept='image/*,image/gif'; input.multiple=true; input.onchange=function(e){ Array.from(e.target.files).forEach(f=>{ if(f.size<=15*1024*1024) pendingSliceFiles.push(f); else showNotification('Файл >15MB','error'); }); updateSlicePreview(); }; input.click(); }
function updateSlicePreview() { if(!pendingSliceFiles.length){document.getElementById('slice-upload-area').style.display='';document.getElementById('slice-preview-container').classList.add('hidden');return;} document.getElementById('slice-upload-area').style.display='none'; document.getElementById('slice-preview-container').classList.remove('hidden'); var area=document.getElementById('slice-preview-area'); area.innerHTML=''; pendingSliceFiles.forEach((f,i)=>{ var r=new FileReader(); r.onload=e=>{ var isGif=f.type==='image/gif'; var div=document.createElement('div'); div.className='slice-preview-item'; div.innerHTML=`<img src="${e.target.result}" style="width:100px;height:100px;object-fit:cover;"><button onclick="removeSliceMedia(${i})">×</button>${isGif?'<span>GIF</span>':''}`; area.appendChild(div); }; r.readAsDataURL(f); }); }
function removeSliceMedia(i){ pendingSliceFiles.splice(i,1); updateSlicePreview(); }
async function publishSlice(){ if(!pendingSliceFiles.length && !document.getElementById('slice-text').value.trim()){ showNotification('Добавьте текст или фото','error'); return; } showNotification('Публикация...','info'); try{ var urls=[]; for(var f of pendingSliceFiles) urls.push(await uploadToImgBB(f)); var sliceData={ authorId:currentUser.uid, authorName:currentUserData.username, authorAvatar:currentUserData.avatar||'', text:document.getElementById('slice-text').value.trim(), hashtags:[], mediaType:urls.length>1?'multiple':(urls.length===1?'single':'none'), mediaUrls:urls.length?urls:null, mediaUrl:urls.length===1?urls[0]:null, likesCount:0, commentsCount:0, repostsCount:0, viewsCount:0, pinned:false, createdAt:firebase.database.ServerValue.TIMESTAMP }; await database.ref('slices/').push(sliceData); if(typeof playSliceCreateSound==='function') playSliceCreateSound(); showNotification('Пост опубликован!','success'); closeCreateSliceModal(); loadSlices(); }catch(e){ showNotification('Ошибка','error'); } }

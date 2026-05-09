// Предзагрузка изображений
var imageCache = new Map();

function preloadImage(url) {
    return new Promise(function(resolve, reject) {
        if (imageCache.has(url)) {
            resolve(imageCache.get(url));
            return;
        }
        
        var img = new Image();
        img.onload = function() {
            imageCache.set(url, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = url;
    });
}

function preloadImagesInViewport() {
    var images = document.querySelectorAll('img[data-src]:not(.preloaded), img:not([data-src])');
    var viewportHeight = window.innerHeight;
    var scrollTop = window.scrollY;
    
    images.forEach(function(img) {
        var rect = img.getBoundingClientRect();
        if (rect.top < viewportHeight + 200 && rect.bottom > -200) {
            var src = img.getAttribute('data-src') || img.src;
            if (src && !imageCache.has(src)) {
                img.classList.add('preloaded');
                preloadImage(src);
            }
        }
    });
}

window.addEventListener('scroll', function() {
    requestAnimationFrame(preloadImagesInViewport);
});

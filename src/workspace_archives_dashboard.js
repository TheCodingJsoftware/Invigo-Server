import "beercss"
import '../static/css/style.css';
import '../static/css/theme.css';

function goToMainUrl() {
    window.location.href = "/"
}

window.addEventListener('load', function () {
    setTimeout(function () {
        document.querySelectorAll('img').forEach(function (img) {
            img.onerror = function () {
                this.classList.add('hidden');
            };
            if (!img.complete || img.naturalWidth === 0) {
                img.onerror();
            }
        });
    }, 1000); // 1000 milliseconds = 1 second
});

window.goToMainUrl = goToMainUrl;
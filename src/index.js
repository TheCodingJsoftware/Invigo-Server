import "beercss"

document.addEventListener("DOMContentLoaded", function() {
    const elements = document.querySelectorAll('.fade-in');
    elements.forEach((el, index) => {
        setTimeout(() => {
            el.style.opacity = 1;
            el.style.transition = 'opacity 1s';
        }, index * 200);
    });
});
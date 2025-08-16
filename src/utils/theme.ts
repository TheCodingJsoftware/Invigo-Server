import '@static/css/style.css';
import '@static/css/theme.css';

export function triggerThemeTransition(duration = 500) {
    const html = document.documentElement;
    html.classList.add("theme-transition");
    setTimeout(() => {
        html.classList.remove("theme-transition");
    }, duration);
}

export function loadAnimationStyleSheet() {
    const style = document.createElement("style");
    style.id = "theme-transition-style"; // so we can manage it if needed
    style.textContent = `
    html.theme-transition *,
    html.theme-transition dialog {
        transition-property: background-color, color;
        transition-duration: var(--speed3), var(--speed1);
        transition-timing-function: ease-in-out, ease;
        transition-delay: 0s, 0s;
    }
    `;
    document.head.appendChild(style);
}

export function loadTheme() {
    const mode = localStorage.getItem("mode");
    if (mode === "dark") {
        ui("mode", "dark");
    } else {
        ui("mode", "light");
    }
}

export function toggleTheme() {
    // triggerThemeTransition();
    const mode = ui("mode");
    if (mode === "dark") {
        ui("mode", "light");
        localStorage.setItem("mode", "light");
    } else {
        ui("mode", "dark");
        localStorage.setItem("mode", "dark");
    }
}

export function invertImages() {
    let mode = ui("mode");
    const images = document.querySelectorAll('img');
    if (mode === "light") {
        for (let i = 0; i < images.length; i++) {
            images[i].style.filter = 'invert(0)';
        }
    } else {
        for (let i = 0; i < images.length; i++) {
            images[i].style.filter = 'invert(0.9)';
        }
    }
}
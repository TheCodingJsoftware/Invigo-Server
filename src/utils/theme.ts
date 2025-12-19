import '@static/css/style.css';
import "material-dynamic-colors";

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

export function getPreferredMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function loadTheme(overideMode?: string) {
    const mode = localStorage.getItem("mode");
    if (mode) {
        ui("mode", mode);
    } else {
        ui("mode", getPreferredMode());
    }
    ui("theme", localStorage.getItem("theme") || "#006493");
}

export function toggleTheme() {
    const mode = ui("mode");
    if (mode === "dark") {
        ui("mode", "light");
        localStorage.setItem("mode", "light");
    } else {
        ui("mode", "dark");
        localStorage.setItem("mode", "dark");
    }
}

export function invertImages(element?: HTMLElement, modeOverride?: string) {
    let mode = ui("mode");
    if (modeOverride) {
        mode = modeOverride;
    }
    let images: NodeListOf<HTMLImageElement>;
    if (element) {
        images = element.querySelectorAll<HTMLImageElement>('img:not(.ignore-invert)');
    } else {
        images = document.querySelectorAll<HTMLImageElement>('img:not(.ignore-invert)');
    }
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

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    const newTheme = e.matches ? 'dark' : 'light';
    ui('mode', newTheme);
});

document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
})
import '@static/css/style.css';
import "material-dynamic-colors";

let themeObserver: MutationObserver | null = null;

export function startThemeObserver() {
    if (themeObserver) return;

    themeObserver = new MutationObserver(() => {
        updateMetaColors();
    });

    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style"]
    });

    // Optional but safe: body can change too
    themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style"]
    });
}

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

export function getPrimaryColor(): string {
    const value = getComputedStyle(document.body)
        .getPropertyValue("--primary")
        .trim();

    if (!value) {
        throw new Error("BeerCSS --primary not found on body");
    }

    return value;
}


export function getOnColor(hex: string): string {
    let mode = ui("mode");
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // relative luminance helper
    function luminance(r: number, g: number, b: number) {
        const srgb = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    }

    // contrast ratio helper
    function contrast(l1: number, l2: number) {
        const brightest = Math.max(l1, l2);
        const darkest = Math.min(l1, l2);
        return (brightest + 0.05) / (darkest + 0.05);
    }

    const lumBg = luminance(r, g, b);
    const lumWhite = luminance(255, 255, 255);
    const lumBlack = luminance(0, 0, 0);

    const contrastWhite = contrast(lumBg, lumWhite);
    const contrastBlack = contrast(lumBg, lumBlack);

    // Auto detect mode if needed
    if (mode === "auto") {
        mode = lumBg > 0.5 ? "light" : "dark";
    }

    // Pick the one with higher contrast if it meets WCAG AA (>=4.5)
    if (contrastWhite >= 4.5 && contrastWhite >= contrastBlack) return "#FFFFFF";
    if (contrastBlack >= 4.5 && contrastBlack >= contrastWhite) return "#000000";

    // Otherwise: fall back to complementary hue for guaranteed visibility
    const hsl = rgbToHsl(r, g, b);
    hsl[0] = (hsl[0] + 180) % 360; // shift hue
    hsl[2] = mode === "light" ? 20 : 80; // tweak lightness based on mode
    return hslToHex(hsl[0], hsl[1], hsl[2]);

    // helpers for HSL conversion
    function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h *= 60;
        }
        return [h, s * 100, l * 100];
    }

    function hslToHex(h: number, s: number, l: number): string {
        s /= 100;
        l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        if (0 <= h && h < 60) {
            r = c;
            g = x;
            b = 0;
        } else if (60 <= h && h < 120) {
            r = x;
            g = c;
            b = 0;
        } else if (120 <= h && h < 180) {
            r = 0;
            g = c;
            b = x;
        } else if (180 <= h && h < 240) {
            r = 0;
            g = x;
            b = c;
        } else if (240 <= h && h < 300) {
            r = x;
            g = 0;
            b = c;
        } else if (300 <= h && h < 360) {
            r = c;
            g = 0;
            b = x;
        }
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
    }
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

function upsertMeta(name: string, content: string): void {
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

    if (!meta) {
        meta = document.createElement("meta");
        meta.name = name;
        document.head.appendChild(meta);
    }

    if (meta.content !== content) {
        meta.content = content;
    }
}

export function updateMetaColors(color?: string): void {
    const resolvedColor = getPrimaryColor();
    upsertMeta("theme-color", resolvedColor);
    upsertMeta("msapplication-TileColor", resolvedColor);
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
    startThemeObserver();
})
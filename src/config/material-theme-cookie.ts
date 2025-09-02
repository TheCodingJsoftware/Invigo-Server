import {IMaterialDynamicColorsThemeColor} from "material-dynamic-colors/src/cdn/interfaces"
import materialDynamicColors from "material-dynamic-colors";

type ThemeSlice = { light: string; dark: string };

export class SettingsManager<T extends Record<string, any>> {
    constructor(private key: string, private defaults: T) {
    }

    get(): T {
        const raw = localStorage.getItem(this.key);
        if (!raw) {
            return structuredClone(this.defaults);
        }
        try {
            return {...this.defaults, ...JSON.parse(raw)};
        } catch {
            return structuredClone(this.defaults);
        }
    }

    set(patch: Partial<T>) {
        const current = this.get();
        const next = {...current, ...patch};
        localStorage.setItem(this.key, JSON.stringify(next));
    }

    reset() {
        localStorage.setItem(this.key, JSON.stringify(this.defaults));
    }
}

const THEME_STORAGE_PREFIX = "MaterialDynamicColorsThemeColor";
const THEME_INDEX_KEY = "MaterialDynamicColorsThemeColorIndex";
const MAX_THEMES = 50;

const ThemeIndex = new SettingsManager<{ order: string[] }>(
    THEME_INDEX_KEY,
    {order: []}
);

const toCss = (vars: IMaterialDynamicColorsThemeColor) =>
    Object.entries(vars)
        .map(([k, v]) => `--${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}:${v};`)
        .join("");

const ensureStyle = (id: string) => {
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement("style");
        el.id = id;
        document.head.appendChild(el);
    }
    return el;
};

const getMode = (): "light" | "dark" =>
    document.body.classList.contains("dark") ? "dark" : "light";

const hexToRgba = (hex: string, a: number) => {
    const x = hex.replace("#", "");
    const r = parseInt(x.slice(0, 2), 16);
    const g = parseInt(x.slice(2, 4), 16);
    const b = parseInt(x.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const extractCssVar = (css: string, name: string) =>
    new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1];

const themeKey = (color: string) => THEME_STORAGE_PREFIX + encodeURIComponent(color);

const themeStorage = (color: string) =>
    new SettingsManager<ThemeSlice>(themeKey(color), {light: "", dark: ""});

const evictTheme = (color: string) => {
    localStorage.removeItem(themeKey(color));
};

const touchIndex = (color: string) => {
    const idx = ThemeIndex.get();
    const order = idx.order.filter(c => c !== color);
    order.push(color);
    while (order.length > MAX_THEMES) {
        const evict = order.shift()!;
        evictTheme(evict);
    }
    ThemeIndex.set({order});
};

export async function getCachedThemeCss(color: string): Promise<ThemeSlice> {
    const stored = themeStorage(color).get();
    if (stored.light && stored.dark) {
        touchIndex(color);
        return stored;
    }
    const palette = await materialDynamicColors(color);
    const slice: ThemeSlice = {light: toCss(palette.light), dark: toCss(palette.dark)};
    themeStorage(color).set(slice);
    touchIndex(color);
    return slice;
}

export async function applyScopedBeerTheme(element: HTMLElement, color: string, scopeId: string) {
    const {light, dark} = await getCachedThemeCss(color);
    element.setAttribute("data-beer-css-scope", scopeId);
    const styleEl = ensureStyle(`beer-css-scope-${scopeId}`);
    styleEl.textContent =
        `body.light [data-beer-css-scope="${scopeId}"]{${light}}` +
        `body.dark [data-beer-css-scope="${scopeId}"]{${dark}}`;
    // const primary = (getMode() === "dark" ? extractCssVar(dark, "primary") : extractCssVar(light, "primary")) || "#000";
    // element.style.backgroundColor = hexToRgba(primary, 0.08);
}

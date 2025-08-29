import {IMaterialDynamicColorsThemeColor} from "material-dynamic-colors/src/cdn/interfaces"
import {CookieSettingsManager} from "@core/settings/cookies";
import materialDynamicColors from "material-dynamic-colors";

type ThemeSlice = { light: string; dark: string };

const THEME_COOKIE_PREFIX = "MaterialDynamicColorsThemeColor";
const THEME_INDEX_KEY = "MaterialDynamicColorsThemeColorIndex";
const MAX_THEMES = 50;
const COOKIE_OPTS = {days: 7, path: "/", sameSite: "Lax" as const};

const ThemeIndex = new CookieSettingsManager<{ order: string[] }>(
    THEME_INDEX_KEY,
    {order: []},
    COOKIE_OPTS
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

const themeCookieKey = (color: string) => THEME_COOKIE_PREFIX + encodeURIComponent(color);

const themeCookie = (color: string) =>
    new CookieSettingsManager<ThemeSlice>(themeCookieKey(color), {light: "", dark: ""}, COOKIE_OPTS);

const deleteCookie = (key: string) => {
    document.cookie = `${key}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`;
};

const touchIndex = (color: string) => {
    const idx = ThemeIndex.get();
    const order = idx.order.filter(c => c !== color);
    order.push(color);
    while (order.length > MAX_THEMES) {
        const evict = order.shift()!;
        deleteCookie(themeCookieKey(evict));
    }
    ThemeIndex.set({order});
};

export async function getCachedThemeCss(color: string): Promise<ThemeSlice> {
    const stored = themeCookie(color).get();
    if (stored.light && stored.dark) {
        touchIndex(color);
        return stored;
    }
    const palette = await materialDynamicColors(color);
    const slice: ThemeSlice = {light: toCss(palette.light), dark: toCss(palette.dark)};
    themeCookie(color).set(slice);
    touchIndex(color);
    return slice;
}

export async function applyScopedBeerTheme(element: HTMLElement, color: string, scopeId: string) {
    const {light, dark} = await getCachedThemeCss(color);
    element.setAttribute("data-beer-css-scope", scopeId);
    const styleEl = ensureStyle(`beer-css-scope-${scopeId}`);
    styleEl.textContent = `body.light [data-beer-css-scope="${scopeId}"]{${light}}` + `body.dark [data-beer-css-scope="${scopeId}"]{${dark}}`;
    // const primary = (getMode() === "dark" ? extractCssVar(dark, "primary") : extractCssVar(light, "primary")) || "#000";
    // element.style.backgroundColor = hexToRgba(primary, 0.08);
}

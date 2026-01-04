import {
    Hct,
    argbFromHex,
    hexFromArgb,
    argbFromRgb,
} from "@material/material-color-utilities";

type OnColorOpts = {
    lightOnTone?: number;    // when input is dark
    darkOnTone?: number;     // when input is light
    toneThreshold?: number;  // split point
    // For rgba() inputs: what background should we composite over?
    rgbaBackground?: string; // hex like #ffffff
};


export function getPrimaryColor(): string {
    const value = getComputedStyle(document.body)
        .getPropertyValue("--primary")
        .trim();

    if (!value) {
        throw new Error("BeerCSS --primary not found on body");
    }

    return value;
}

export function getBackgroundColor(): string {
    return getComputedStyle(document.body)
        .getPropertyValue("--background")
        .trim();
}

export function getOnColor(input: string, opts?: OnColorOpts): string {
    const lightOnTone = opts?.lightOnTone ?? 90;
    const darkOnTone = opts?.darkOnTone ?? 10;
    const toneThreshold = opts?.toneThreshold ?? 50;

    const baseArgb = cssColorToOpaqueArgb(input, opts?.rgbaBackground ?? "#ffffff");
    const baseHct = Hct.fromInt(baseArgb);

    const targetTone = baseHct.tone >= toneThreshold ? darkOnTone : lightOnTone;

    const on = Hct.from(baseHct.hue, baseHct.chroma, targetTone);
    return hexFromArgb(on.toInt());
}

function cssColorToOpaqueArgb(input: string, rgbaBgHex: string): number {
    const s = input.trim().toLowerCase();

    // Hex
    if (s.startsWith("#")) {
        return argbFromHex(normalizeHex(s));
    }

    // rgb()/rgba()
    const m = s.match(/^rgba?\(\s*([^\)]+)\s*\)$/);
    if (m) {
        const parts = m[1].split(",").map(p => p.trim());
        if (parts.length < 3) throw new Error(`Invalid rgb/rgba color: ${input}`);

        const r = clamp255(parseFloat(parts[0]));
        const g = clamp255(parseFloat(parts[1]));
        const b = clamp255(parseFloat(parts[2]));
        const a = parts.length >= 4 ? clamp01(parseFloat(parts[3])) : 1;

        if (a >= 0.9999) {
            return argbFromRgb(r, g, b);
        }

        // Composite over background (default white)
        const bg = hexToRgb(rgbaBgHex);
        if (!bg) throw new Error(`Invalid rgbaBackground hex: ${rgbaBgHex}`);

        const cr = Math.round(r * a + bg.r * (1 - a));
        const cg = Math.round(g * a + bg.g * (1 - a));
        const cb = Math.round(b * a + bg.b * (1 - a));

        return argbFromRgb(cr, cg, cb);
    }

    throw new Error(`Unsupported color format: ${input}`);
}

function normalizeHex(hex: string): string {
    const h = hex.replace("#", "");
    if (h.length === 3) return "#" + h.split("").map(c => c + c).join("");
    if (h.length === 6) return "#" + h;
    throw new Error(`Invalid hex color: ${hex}`);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const full = normalizeHex(hex).slice(1);
    const num = parseInt(full, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
    };
}

export function RGBAToHexA(rgba: string, forceRemoveAlpha = false) {
    return "#" + rgba.replace(/^rgba?\(|\s+|\)$/g, '') // Get's rgba / rgb string values
        .split(',') // splits them at ","
        .filter((string, index) => !forceRemoveAlpha || index !== 3)
        .map(string => parseFloat(string)) // Converts them to numbers
        .map((number, index) => index === 3 ? Math.round(number * 255) : number) // Converts alpha to 255 number
        .map(number => number.toString(16)) // Converts numbers to hex
        .map(string => string.length === 1 ? "0" + string : string) // Adds 0 when length of one number is 1
        .join("") // Puts the array to togehter to a string
}

function clamp255(n: number): number {
    return Math.max(0, Math.min(255, Math.round(n)));
}

function clamp01(n: number): number {
    return Math.max(0, Math.min(1, n));
}
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs";

(pdfjsLib as any).GlobalWorkerOptions.workerPort =
    new Worker(pdfWorkerUrl, { type: "module" });

type Ext = "PDF" | "DXF" | "PNG" | "JPG" | "JPEG" | "WEBP" | string;

const MAX_W = 256;

function runIdle(fn: () => void) {
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === "function") ric(fn);
    else setTimeout(fn, 0);
}

function buildUrl(name: string, ext: Ext): string {
    if (["PNG", "JPG", "JPEG", "WEBP"].includes(ext)) {
        return `/images/${encodeURIComponent(name)}`;
    }
    return `/workspace/get_file/${encodeURIComponent(name)}`;
}

class PreviewCache {
    private static _inst: PreviewCache;
    private cache = new Map<string, Promise<HTMLElement>>();

    static get instance(): PreviewCache {
        if (!this._inst) this._inst = new PreviewCache();
        return this._inst;
    }

    prefetch(name: string, ext: Ext): void {
        const key = `${ext}:${name}`;
        if (this.cache.has(key)) return;
        this.cache.set(key, new Promise<HTMLElement>((resolve) => {
            runIdle(async () => {
                try {
                    const el = await this.render(name, ext);
                    resolve(el);
                } catch {
                    const fallback = document.createElement("div");
                    fallback.textContent = name;
                    resolve(fallback);
                }
            });
        }));
    }

    isDark(): boolean {
        return ui("mode") === "dark";
    }

    async get(name: string, ext: Ext): Promise<HTMLElement> {
        const key = `${ext}:${name}`;
        let p = this.cache.get(key);
        if (!p) {
            this.prefetch(name, ext);
            p = this.cache.get(key)!;
        }
        const el = await p;
        return el.cloneNode(true) as HTMLElement;
    }

    private async render(name: string, ext: Ext): Promise<HTMLElement> {
        const url = buildUrl(name, ext);
        if (ext === "PDF") return this.renderPdfThumb(url);
        if (ext === "DXF") return this.renderDxfThumb(url);
        if (["PNG", "JPG", "JPEG", "WEBP"].includes(ext)) return this.renderImageThumb(url);
        return this.renderFileIcon(name);
    }

    private renderImageThumb(url: string): HTMLElement {
        const wrap = document.createElement("div");
        wrap.className = "center-align";
        const img = document.createElement("img");
        img.decoding = "async";
        img.className = "responsive";
        img.loading = "lazy";
        img.src = url;
        wrap.appendChild(img);
        return wrap;
    }

    private async renderPdfThumb(url: string): Promise<HTMLElement> {
        const wrap = document.createElement("div");
        wrap.classList.add("center-align");

        const loadingTask = (pdfjsLib as any).getDocument(url);
        console.log(loadingTask);

        const pdf = await loadingTask.promise;

        if (!pdf.numPages || pdf.numPages < 1) {
            const msg = document.createElement("div");
            msg.textContent = "No pages in PDF.";
            wrap.appendChild(msg);
            return wrap;
        } else {
            console.log(`PDF loaded with ${pdf.numPages} pages`);
        }

        const page = await pdf.getPage(1);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.max(0.1, Math.min(2, MAX_W / vp1.width));
        const viewport = page.getViewport({ scale });

        const dpr = Math.max(1, window.devicePixelRatio || 1);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { alpha: false })!;
        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);

        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] as any : undefined;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport, transform, background: "#ffffff" }).promise;

        const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 0.92));
        const img = document.createElement("img");
        img.decoding = "async";
        img.loading = "lazy";
        img.className = "responsive";

        if (blob) {
            img.src = URL.createObjectURL(blob);
        } else {
            // fallback to dataURL if toBlob not supported
            img.src = canvas.toDataURL("image/png", 0.92);
        }

        if (this.isDark()) {
            img.style.filter = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.95)";
        } else {
            img.style.filter = "";
        }

        wrap.appendChild(img);
        return wrap;
    }

    private async renderDxfThumb(url: string): Promise<HTMLElement> {
        const { Helper: DxfHelper } = await import("dxf");

        const wrap = document.createElement("div");
        wrap.className = "center-align";

        const dxfText = await fetch(url, { cache: "force-cache" }).then(r => r.text());
        const helper = new DxfHelper(dxfText);
        const svgMarkup = helper.toSVG();

        // Parse SVG safely
        const svg = new DOMParser()
            .parseFromString(svgMarkup, "image/svg+xml")
            .querySelector("svg") as SVGSVGElement | null;

        if (!svg) {
            wrap.textContent = "Invalid DXF preview";
            return wrap;
        }

        // Normalize SVG geometry
        const w = parseFloat(svg.getAttribute("width") || "0");
        const h = parseFloat(svg.getAttribute("height") || "0");

        if (!svg.hasAttribute("viewBox") && w > 0 && h > 0) {
            svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        }

        // Force stroke-only DXF look
        const stroke = getComputedStyle(document.documentElement)
            .getPropertyValue("--on-surface")
            .trim() || "#000";

        const STROKE_W = 2;

        svg.querySelectorAll<SVGElement>("*").forEach(el => {
            el.setAttribute("stroke", stroke);
            el.setAttribute("stroke-width", String(STROKE_W));
            el.setAttribute("vector-effect", "non-scaling-stroke"); // IMPORTANT
            if (!el.hasAttribute("fill")) el.setAttribute("fill", "none");
        });

        // Serialize SVG
        const svgStr = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgStr], { type: "image/svg+xml" });
        const svgUrl = URL.createObjectURL(svgBlob);

        // Rasterize SVG → canvas
        const imgSvg = new Image();
        imgSvg.decoding = "async";

        await new Promise<void>((resolve, reject) => {
            imgSvg.onload = () => resolve();
            imgSvg.onerror = reject;
            imgSvg.src = svgUrl;
        });

        const TARGET_PX = 500;
        const PAD_PX = 24;
        const dpr = Math.max(1, window.devicePixelRatio || 1);

        const naturalW = imgSvg.width;
        const naturalH = imgSvg.height;

        const scale = TARGET_PX / Math.max(naturalW, naturalH);

        const drawW = naturalW * scale;
        const drawH = naturalH * scale;

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil((drawW + PAD_PX * 2) * dpr);
        canvas.height = Math.ceil((drawH + PAD_PX * 2) * dpr);

        const ctx = canvas.getContext("2d", { alpha: false })!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.fillStyle = "#ffffff";

        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(
            imgSvg,
            PAD_PX,
            PAD_PX,
            drawW,
            drawH
        );

        URL.revokeObjectURL(svgUrl);

        // Canvas → PNG
        const blob = await new Promise<Blob | null>(res =>
            canvas.toBlob(res, "image/png", 0.92)
        );

        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.className = "responsive small-round";
        img.src = blob
            ? URL.createObjectURL(blob)
            : canvas.toDataURL("image/png", 0.92);

        wrap.appendChild(img);
        return wrap;
    }

    private async renderDxfThumbSVG(url: string): Promise<HTMLElement> {
        const { Helper: DxfHelper } = await import("dxf");
        const wrap = document.createElement("div");
        wrap.classList.add("center-align");

        const text = await fetch(url, { cache: "force-cache" }).then(r => r.text());
        const helper = new DxfHelper(text);
        const svgMarkup: string = helper.toSVG();
        wrap.innerHTML = svgMarkup;

        const svg = wrap.querySelector("svg") as SVGSVGElement | null;
        if (svg) {
            const wAttr = parseFloat(svg.getAttribute("width") || "0");
            const hAttr = parseFloat(svg.getAttribute("height") || "0");
            if (!svg.hasAttribute("viewBox") && wAttr > 0 && hAttr > 0) {
                svg.setAttribute("viewBox", `0 0 ${wAttr} ${hAttr}`);
            }
            svg.style.width = "100%";
            svg.style.height = "auto";
            svg.style.background = "#ffffff";

            const stroke = "#000000";
            svg.querySelectorAll<SVGElement>("*").forEach(el => {
                (el.style as any).stroke = stroke;
                if (!(el as any).hasAttribute("fill")) {
                    (el.style as any).fill = "none";
                }
            });
        }
        return wrap;
    }

    private renderFileIcon(name: string): HTMLElement {
        const box = document.createElement("div");
        box.style.width = `${MAX_W}px`;
        box.style.maxWidth = "100%";
        box.style.padding = "12px";
        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.gap = "8px";
        const i = document.createElement("i");
        i.textContent = "description";
        const span = document.createElement("span");
        span.textContent = name;
        span.style.whiteSpace = "nowrap";
        span.style.overflow = "hidden";
        span.style.textOverflow = "ellipsis";
        box.appendChild(i);
        box.appendChild(span);
        return box;
    }
}

export const Previewer = PreviewCache.instance;
export { buildUrl, Ext };

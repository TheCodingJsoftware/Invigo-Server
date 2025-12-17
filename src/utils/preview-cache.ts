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

    // private async renderPdfThumb(url: string): Promise<HTMLElement> {
    //     const wrap = document.createElement("div");
    //     wrap.classList.add("center-align");
    //     wrap.style.width = `${MAX_W}px`;
    //
    //     const loadingTask = (pdfjsLib as any).getDocument({ url });
    //     const pdf = await loadingTask.promise;
    //    if (!pdf.numPages || pdf.numPages < 1) {
    //         const msg = document.createElement("div");
    //         msg.textContent = "No pages in PDF.";
    //         wrap.appendChild(msg);
    //         return wrap;
    //     }
    //     const page = await pdf.getPage(1);
    //     const vp1 = page.getViewport({ scale: 1 });
    //     const scale = Math.max(0.1, Math.min(1.5, MAX_W / vp1.width));
    //     const viewport = page.getViewport({ scale: scale });
    //
    //     const canvas = document.createElement("canvas");
    //     const ctx = canvas.getContext("2d")!;
    //     canvas.width = Math.floor(viewport.width);
    //     canvas.height = Math.floor(viewport.height);
    //     canvas.style.width = `${Math.floor(viewport.width)}px`;
    //     canvas.style.height = `${Math.floor(viewport.height)}px`;
    //
    //     if (this.isDark()) {
    //         canvas.style.filter = "";
    //         canvas.style.backgroundColor = "";
    //     } else {
    //         canvas.style.filter = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.95)";
    //         canvas.style.backgroundColor = "transparent";
    //     }
    //
    //     wrap.appendChild(canvas);
    //
    //     const renderTask = page.render({
    //         canvasContext: ctx,
    //         viewport,
    //         background: this.isDark() ? "rgba(0,0,0,0)" : "#ffffff"
    //     });
    //     await renderTask.promise;
    //     return wrap;
    // }

    private async renderDxfThumb(url: string): Promise<HTMLElement> {
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
            svg.style.background = "var(--surface)";

            const stroke = "var(--on-surface)";
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

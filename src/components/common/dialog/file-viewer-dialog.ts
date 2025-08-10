import { DialogComponent } from "@components/common/dialog/dialog-component";
import { PartData } from "@components/workspace/parts/part-page";
import { Permissions } from "@core/auth/permissions";
import { UserContext } from "@core/auth/user-context";
import { Helper as DxfHelper } from "dxf";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs";
import {getFileIcon} from "@components/common/buttons/file-button";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc as any;

export class FileViewerDialog extends DialogComponent {
    readonly parts: PartData[];
    readonly filePath?: string;
    readonly #user = Object.freeze(UserContext.getInstance().user);

    private partsElement!: HTMLElement;
    private filesElement!: HTMLElement;
    private contentElement!: HTMLElement;

    private partButtons = new Map<number, HTMLButtonElement>();
    private fileButtons = new Map<string, HTMLButtonElement>();

    private selectedPart?: PartData;
    private selectedFile?: string;

    constructor(parts: PartData[], filePath?: string) {
        super({
            id: "file-viewer-dialog",
            title: "Viewer",
            position: "max",
            bodyContent: `
                <div>
                    <header class="surface-container"><nav class="wrap no-space" id="parts"></nav></header>
                    <nav class="surface-container left" id="files"></nav>
                    <main class="no-padding" id="content"></main>
                </div> 
            `,
        });
        super.element.className = "max no-padding";
        const bodyElement = this.element.querySelector(".dialog-body") as HTMLElement;
        bodyElement.classList.add("no-padding", "surface-container");

        this.parts = parts;
        this.filePath = filePath;
        this.init();
    }

    async init() {
        this.partsElement = this.element.querySelector("#parts") as HTMLElement;
        this.filesElement = this.element.querySelector("#files") as HTMLElement;
        this.contentElement = this.element.querySelector("#content") as HTMLElement;

        this.partsElement.innerHTML = "";
        this.partButtons.clear();

        if (this.parts.length === 1) {
            const header = this.partsElement.parentElement as HTMLElement;
            header.classList.add("hidden");
        }

        for (const part of this.parts) {
            if (this.getFilesForPart(part).length === 0) {
                continue;
            }
            const button = document.createElement("button");
            button.className = "extra small-round border tiny-margin";
            button.innerHTML = `
                <img class="responsive" src="/${part.meta_data.image_index}">
                <span>${part.name}</span>
            `.trim();
            button.addEventListener("click", () => this.selectPart(part));
            this.partsElement.appendChild(button);
            this.partButtons.set(part.group_id, button);
        }

        const targetPart = this.findPartForInitialSelection();
        this.selectPart(targetPart ?? this.parts[0]);
    }

    private findPartForInitialSelection(): PartData | undefined {
        if (!this.filePath) return undefined;
        for (const part of this.parts) {
            const files = this.getFilesForPart(part);
            if (files.some(f => this.normalizeName(f) === this.normalizeName(this.filePath!))) {
                return part;
            }
        }
        return undefined;
    }

    private getFilesForPart(part: PartData): string[] {
        const files: string[] = [];
        this.#user.require(Permissions.ViewBendingFiles, () => {
            for (const f of part.workspace_data.bending_files) files.push(f);
        });
        this.#user.require(Permissions.ViewWeldingFiles, () => {
            for (const f of part.workspace_data.welding_files) files.push(f);
        });
        this.#user.require(Permissions.ViewCNCMillingFiles, () => {
            for (const f of part.workspace_data.cnc_milling_files) files.push(f);
        });
        return files;
    }

    private selectPart(part: PartData | undefined) {
        if (!part) return;
        this.selectedPart = part;

        for (const [id, btn] of this.partButtons.entries()) {
            if (id === part.group_id) btn.classList.add("fill");
            else btn.classList.remove("fill");
        }

        const files = this.getFilesForPart(part);
        this.renderFiles(files);

        let nextFile: string | undefined = undefined;
        if (this.filePath) {
            const match = files.find(f => this.normalizeName(f) === this.normalizeName(this.filePath!));
            if (match) nextFile = match;
        }
        if (!nextFile) nextFile = files[0];

        this.selectFile(nextFile);
    }

    private renderFiles(files: string[]) {
        this.filesElement.innerHTML = "";
        this.fileButtons.clear();

        for (const filePath of files) {
            const btn = document.createElement("button");
            btn.className = "border small-round responsive left-align";
            btn.innerHTML = `
                <i>${getFileIcon(this.extension(filePath))}</i>
                <span>${this.filename(filePath)}</span>
            `.trim();
            btn.addEventListener("click", () => this.selectFile(filePath));
            this.filesElement.appendChild(btn);
            this.fileButtons.set(filePath, btn);
        }
    }

    private selectFile(filePath?: string) {
        if (!filePath) {
            this.selectedFile = undefined;
            this.contentElement.innerHTML = "";
            return;
        }
        this.selectedFile = filePath;

        for (const [path, btn] of this.fileButtons.entries()) {
            if (path === filePath) btn.classList.add("fill");
            else btn.classList.remove("fill");
        }

        this.renderContent(filePath);
    }

    private renderContent(filePath: string) {
        const ext = this.extension(filePath);
        const name = this.filename(filePath);

        this.contentElement.innerHTML = "";
        const url = `/workspace/get_file/${encodeURIComponent(name)}`;

        if (ext === "PDF") {
            this.renderPdf(url);
            return;
        }

        if (ext === "DXF") {
            this.renderDxf(url);
            return
        }

        if (["PNG", "JPG", "JPEG", "WEBP"].includes(ext)) {
            const container = document.createElement("div");
            container.className = "center-align middle";
            const img = document.createElement("img");
            img.classList.add("responsive");
            img.src = `/images/${name}`;
            img.style.maxWidth = "50%";
            img.style.maxHeight = "50%";

            if (this.isDark()) {
                img.style.filter = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.95)";
                img.style.backgroundColor = "transparent";
            } else {
                img.style.filter = "";
                img.style.backgroundColor = "";
            }
            container.appendChild(img);
            this.contentElement.appendChild(container);
            return;
        }

        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.setAttribute("allow", "fullscreen");
        this.contentElement.appendChild(iframe);
    }

    isDark(): boolean {
        return ui("mode") === "dark";
    }

    private async renderPdf(url: string) {
        const scroller = document.createElement("div");
        scroller.classList.add("center-align")
        this.contentElement.appendChild(scroller);

        const loadingTask = (pdfjsLib as any).getDocument(url);
        const pdfDocument = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            const pdfPage = await pdfDocument.getPage(pageNum);

            const viewport = pdfPage.getViewport({ scale: 1.0 });

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            if (this.isDark()) {
                canvas.style.filter = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.95)";
                canvas.style.backgroundColor = "transparent";
            } else {
                canvas.style.filter = "";
                canvas.style.backgroundColor = "";
            }

            scroller.appendChild(canvas);

            const renderTask = pdfPage.render({
                canvasContext: ctx,
                viewport,
                background: this.isDark() ? "rgba(0,0,0,0)" : "#ffffff"
            });
            await renderTask.promise;
        }
    }

    private async renderDxf(url: string) {
        const wrap = document.createElement("div");
        wrap.classList.add("center-align", "middle")
        this.contentElement.appendChild(wrap);

        const text = await fetch(url).then(r => r.text());
        const helper = new DxfHelper(text);
        const svgMarkup: string = helper.toSVG();

        wrap.innerHTML = svgMarkup;

        const svg = wrap.querySelector("svg") as SVGSVGElement | null;
        if (svg) {
            const widthAttr = svg.getAttribute("width");
            const heightAttr = svg.getAttribute("height");
            const w = widthAttr ? parseFloat(widthAttr) : 0;
            const h = heightAttr ? parseFloat(heightAttr) : 0;

            if (!svg.hasAttribute("viewBox") && w > 0 && h > 0) {
                svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
            }

            svg.style.width = "512px";
            svg.style.height = "512px";
            const stroke = ui("mode") === "dark" ? "#fff" : "#000";
            svg.querySelectorAll<SVGElement>("*").forEach(el => {
                (el.style as any).stroke = stroke;
                if (!(el as any).hasAttribute("fill")) {
                    (el.style as any).fill = "none";
                }
            });
            svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        }
    }

    private filename(p: string): string {
        const s = p.split(/[\\/]/);
        return s[s.length - 1] || p;
    }

    private extension(p: string): string {
        const m = p.match(/[^.]+$/)?.[0] ?? "";
        return m.toUpperCase();
    }

    private normalizeName(p: string): string {
        return this.filename(p).toUpperCase();
    }

    partButtonPressed(part: PartData) {
        this.selectPart(part);
    }
}

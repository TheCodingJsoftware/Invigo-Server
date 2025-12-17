import { DialogComponent } from "@components/common/dialog/dialog-component";
import { PartData } from "@components/workspace/parts/part-container";
import { WorkspacePermissions } from "@core/auth/workspace-permissions";
import { UserContext } from "@core/auth/user-context";
import { invertImages } from "@utils/theme";
import { InlineFileButton } from "@components/common/buttons/inline-file-button";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs";

(pdfjsLib as any).GlobalWorkerOptions.workerPort =
    new Worker(pdfWorkerUrl, { type: "module" });


export class FileViewerDialog extends DialogComponent {
    readonly parts: PartData[];
    readonly filePath?: string;
    readonly #user = Object.freeze(UserContext.getInstance().user);

    private partsElement!: HTMLElement;
    private filesElement!: HTMLElement;
    private partInfoElement!: HTMLElement;
    private contentElement!: HTMLElement;

    private partButtons = new Map<number, HTMLButtonElement>();
    private fileButtons = new Map<string, HTMLButtonElement>();

    private zoomLevel = 1;
    private readonly ZOOM_MIN = 0.25;
    private readonly ZOOM_MAX = 10;
    private readonly ZOOM_STEP = 0.15;
    private panX = 0;
    private panY = 0;
    private isPanning = false;
    private panStartX = 0;
    private panStartY = 0;

    private selectedPart?: PartData;
    private selectedFile?: string;

    constructor(title: string = "Viewer", parts: PartData[], filePath?: string) {
        super({
            id: "file-viewer-dialog",
            title: title,
            position: "max",
            bodyContent: `
                <div>
                    <header class="surface-container">
                        <nav class="wrap no-space" id="parts"></nav>
                    </header>
                    <nav class="group split zoom-controls fixed bottom right">
                        <button data-zoom="out" class="left-round small square">
                            <i>remove_circle</i>
                            <div class="tooltip">
                                <span>Zoom Out</span>
                            </div>
                        </button>
                        <button data-zoom="reset" class="no-round small">
                            <span>Reset</span>
                            <div class="tooltip">
                                <span>Double-click anywhere</span>
                            </div>
                        </button>
                        <button data-zoom="in" class="right-round small square">
                            <i>add_circle</i>
                            <div class="tooltip">
                                <span>Zoom In</span>
                            </div>
                        </button>
                    </nav>
                    <nav class="surface-container left">
                        <nav id="files" class="vertical"></nav>
                        <div class="divider"></div>
                        <div id="part-info"></div>
                    </nav>
                    <main class="no-padding" id="content"></main>
                </div>
            `,
        });
        super.element.classList.add("no-padding");
        const bodyElement = this.element.querySelector(".dialog-body") as HTMLElement;
        bodyElement.classList.add("no-padding", "surface-container");

        this.parts = parts;
        this.filePath = filePath;
        this.init();
    }

    async init() {
        this.partsElement = this.element.querySelector("#parts") as HTMLElement;
        this.filesElement = this.element.querySelector("#files") as HTMLElement;
        this.partInfoElement = this.element.querySelector("#part-info") as HTMLElement;
        this.contentElement = this.element.querySelector("#content") as HTMLElement;
        this.contentElement.addEventListener("wheel", e => {
            // if (!e.ctrlKey) return;
            e.preventDefault();

            const delta = e.deltaY < 0 ? this.ZOOM_STEP : -this.ZOOM_STEP;
            this.zoomLevel = Math.min(
                this.ZOOM_MAX,
                Math.max(this.ZOOM_MIN, this.zoomLevel + delta)
            );
            this.applyZoom();
        }, { passive: false });

        this.contentElement.addEventListener("dblclick", () => {
            this.zoomLevel = 1;
            this.panX = 0;
            this.panY = 0;
            this.applyZoom();
        });
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
            button.className = "small-round tiny-margin border";
            button.innerHTML = `
                <img class="responsive" src="/${part.meta_data.image_index}" alt="Thumbnail" height="48" width="48">
                <span>${part.name}</span>
            `.trim();
            button.addEventListener("click", () => this.selectPart(part));
            this.partsElement.appendChild(button);
            this.partButtons.set(part.group_id, button);
        }

        const targetPart = this.findPartForInitialSelection();
        this.selectPart(targetPart ?? this.parts[0]);
        this.initZoomControls();
        this.initPanControls();
        invertImages();
    }

    private initZoomControls() {
        this.element.querySelector('[data-zoom="in"]')
            ?.addEventListener("click", () => {
                this.zoomLevel = Math.min(this.ZOOM_MAX, this.zoomLevel + this.ZOOM_STEP);
                this.applyZoom();
            });

        this.element.querySelector('[data-zoom="out"]')
            ?.addEventListener("click", () => {
                this.zoomLevel = Math.max(this.ZOOM_MIN, this.zoomLevel - this.ZOOM_STEP);
                this.applyZoom();
            });

        this.element.querySelector('[data-zoom="reset"]')
            ?.addEventListener("click", () => {
                this.zoomLevel = 1;
                this.panX = 0;
                this.panY = 0;
                this.applyZoom();
            });
    }

    private initPanControls() {
        this.contentElement.addEventListener("mousedown", e => {
            // if (!e.ctrlKey) return;

            const target = this.contentElement.querySelector(".zoom-target");
            if (!target) return;

            e.preventDefault();

            this.isPanning = true;
            this.panStartX = e.clientX - this.panX;
            this.panStartY = e.clientY - this.panY;

            this.contentElement.classList.add("panning");
        });

        window.addEventListener("mousemove", e => {
            if (!this.isPanning) return;

            this.panX = e.clientX - this.panStartX;
            this.panY = e.clientY - this.panStartY;
            this.applyZoom();
        });

        window.addEventListener("mouseup", () => {
            if (!this.isPanning) return;

            this.isPanning = false;
            this.contentElement.classList.remove("panning");
        });
    }

    isDark(): boolean {
        return ui("mode") === "dark";
    }

    partButtonPressed(part: PartData) {
        this.selectPart(part);
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
        this.#user.require(WorkspacePermissions.ViewBendingFiles, () => {
            for (const f of part.workspace_data.bending_files) files.push(f);
        });
        this.#user.require(WorkspacePermissions.ViewWeldingFiles, () => {
            for (const f of part.workspace_data.welding_files) files.push(f);
        });
        this.#user.require(WorkspacePermissions.ViewCNCMillingFiles, () => {
            for (const f of part.workspace_data.cnc_milling_files) files.push(f);
        });
        return files;
    }

    private selectPart(part: PartData | undefined) {
        if (!part) return;
        this.selectedPart = part;

        this.renderPartInfo(part);

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

    private renderPartInfo(part: PartData) {
        const rows: string[] = [];

        const add = (label: string, value?: string | number | null) => {
            if (value === undefined || value === null || value === "") return;
            rows.push(`
            <tr>
                <th scope="row">${label}</th>
                <td>${this.escapeHTML(String(value))}</td>
            </tr>
        `);
        };

        add("Dimensions", part.meta_data.part_dim);
        add(
            "Material",
            part.meta_data.gauge && part.meta_data.material
                ? `${part.meta_data.gauge} ${part.meta_data.material}`
                : null
        );
        add("Weight", part.meta_data.weight ? `${part.meta_data.weight} lbs` : null);
        add("Bend Hits", part.meta_data.bend_hits);
        add("Shelf #", part.meta_data.shelf_number);

        const notes = part.meta_data.notes?.trim();

        this.partInfoElement.innerHTML = `
        <table class="tiny-gap">
            <tbody>
                ${rows.join("")}
            </tbody>
        </table>

        ${notes ? `
            <div class="part-notes">
                <strong>Notes</strong>
                <pre>${this.escapeHTML(notes)}</pre>
            </div>
        ` : ""}
    `;
    }

    private escapeHTML(str: string) {
        return str.replace(/[&<>"']/g, m => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        }[m]!));
    }

    private renderFiles(files: string[]) {
        this.filesElement.innerHTML = "";
        this.fileButtons.clear();

        for (const filePath of files) {
            const inlineButton = new InlineFileButton(filePath);
            inlineButton.element.addEventListener("click", () => this.selectFile(filePath));
            this.filesElement.appendChild(inlineButton.element);
            this.fileButtons.set(filePath, inlineButton.element);
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
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;

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
            img.classList.add("responsive", "round");
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

            const zoomTarget = document.createElement("div");
            zoomTarget.className = "zoom-target";
            zoomTarget.appendChild(container);
            const stage = document.createElement("div");
            stage.className = "zoom-stage";
            stage.appendChild(zoomTarget);

            this.contentElement.appendChild(stage);

            this.applyZoom();
            return;
        }

        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.setAttribute("allow", "fullscreen");
        this.contentElement.appendChild(iframe);
    }

    private async renderPdf(url: string) {
        const scroller = document.createElement("div");
        scroller.classList.add("center-align")
        const zoomTarget = document.createElement("div");
        zoomTarget.className = "zoom-target";
        zoomTarget.appendChild(scroller);

        const stage = document.createElement("div");
        stage.className = "zoom-stage";
        stage.appendChild(zoomTarget);

        this.contentElement.appendChild(stage);
        this.applyZoom();

        const loadingTask = (pdfjsLib as any).getDocument(url);
        const pdfDocument = await loadingTask.promise;
        const dpr = window.devicePixelRatio || 1;
        const renderScale = 2;

        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            const pdfPage = await pdfDocument.getPage(pageNum);

            const viewport = pdfPage.getViewport({ scale: renderScale * dpr });

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            canvas.style.width = `${viewport.width / dpr}px`;
            canvas.style.height = `${viewport.height / dpr}px`;

            if (this.isDark()) {
                canvas.style.filter = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.95)";
                canvas.style.backgroundColor = "transparent";
            } else {
                canvas.style.filter = "";
                canvas.style.backgroundColor = "";
            }

            scroller.appendChild(canvas);
            ctx.setTransform(0.9, 0, 0, 0.9, 0, 0);

            const renderTask = pdfPage.render({
                canvasContext: ctx,
                viewport,
                background: this.isDark() ? "rgba(0,0,0,0)" : "#ffffff"
            });
            await renderTask.promise;
        }
    }

    private async renderDxf(url: string) {
        const { Helper: DxfHelper } = await import("dxf");

        const wrap = document.createElement("div");
        wrap.classList.add("center-align", "middle")
        this.contentElement.appendChild(wrap);
        const zoomTarget = document.createElement("div");
        zoomTarget.className = "zoom-target";
        zoomTarget.appendChild(wrap);

        const stage = document.createElement("div");
        stage.className = "zoom-stage";
        stage.appendChild(zoomTarget);

        this.contentElement.appendChild(stage);
        this.applyZoom();
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
            svg.classList.add("absolute", "center", "middle");
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

    private applyZoom() {
        const zoomTarget = this.contentElement.querySelector(
            ".zoom-target"
        ) as HTMLElement | null;

        if (!zoomTarget) return;

        zoomTarget.style.transform =
            `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    }
}

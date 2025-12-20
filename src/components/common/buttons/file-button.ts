import { PartData } from "@components/workspace/parts/part-container";
import { Ext, Previewer } from "@utils/preview-cache";
import { FileViewerDialog } from "@components/common/dialog/file-viewer-dialog";
import { getIcon } from 'material-file-icons';
import { invertImages } from "@utils/theme";
import { fetchJobData } from "@components/workspace/parts/job-element";
import { applyScopedBeerTheme } from "@config/material-theme-cookie";


export class FileButton {
    readonly element: HTMLButtonElement;
    readonly part: PartData;
    readonly filePath: string;
    readonly fileName: string;
    readonly extension: Ext;

    private tooltip: HTMLDivElement;
    private previewHost: HTMLDivElement;
    private previewLoaded = false;

    constructor(part: PartData, filePath: string) {
        this.part = part;
        this.element = document.createElement("button");
        this.element.className = "file-button chip tiny-margin fill "
        this.element.addEventListener("click", () => this.buttonPressed());

        this.filePath = filePath;
        this.fileName = filePath.split(/[/\\]/).pop()!;
        this.extension = (filePath.match(/[^.]+$/)?.[0] ?? "").toUpperCase();

        this.tooltip = document.createElement("div");
        this.tooltip.className = "tooltip max right";

        const nameEl = document.createElement("div");
        nameEl.className = "bold large-text";
        nameEl.textContent = this.fileName;

        this.previewHost = document.createElement("div");

        this.tooltip.appendChild(nameEl);
        this.tooltip.appendChild(this.previewHost);

        this.element.innerHTML = "";
        const iconDiv = document.createElement("i");
        const icon = getIcon(`.${this.extension.toLowerCase()}`);
        const ext = document.createElement("span");
        ext.textContent = String(this.extension);
        iconDiv.innerHTML = icon.svg

        this.element.appendChild(iconDiv);
        this.element.appendChild(ext);
        this.element.appendChild(this.tooltip);

        this.element.addEventListener("mouseenter", () => this.ensurePreview());
        this.element.addEventListener("focus", () => this.ensurePreview());

        // background prefetch without blocking UI
        Previewer.prefetch(this.fileName, this.extension);
    }

    buttonPressed() {
        const dialog = new FileViewerDialog(
            this.part.name,
            [this.part],
            this.filePath
        );

        this.applyJobThemeAsync(dialog.element);
    }

    private applyJobThemeAsync(dialog: HTMLElement) {
        fetchJobData(this.part.job_id)
            .then(data => {
                applyScopedBeerTheme(
                    dialog,
                    data.job_data.color,
                    `file-viewer-dialog-job-${this.part.job_id}`
                );
            })
            .catch(() => {
                /* no-op: dialog stays default themed */
            });
    }

    private async ensurePreview() {
        if (this.previewLoaded) return;
        this.previewLoaded = true;

        const node = await Previewer.get(this.fileName, this.extension);
        this.previewHost.innerHTML = "";
        this.previewHost.appendChild(node);

        // ---- ACTION ROW ----
        const actions = document.createElement("nav");
        actions.className = "grid top-margin";

        // ---- OPEN BUTTON ----
        const openButton = document.createElement("a");
        openButton.className = "s6 button primary small";
        openButton.innerHTML = `
            <i>open_in_new</i>
            <span>Open File</span>
        `.trim();

        openButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.buttonPressed();
        });

        // ---- DOWNLOAD BUTTON ----
        const downloadButton = document.createElement("a");
        downloadButton.className = "s6 button primary small";
        downloadButton.innerHTML = `
            <i>download</i>
            <span>Download</span>
        `.trim();

        downloadButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const a = document.createElement("a");
            a.href = `/workspace/get_file/${encodeURIComponent(this.fileName)}`;
            a.download = this.fileName;
            a.style.display = "none";

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });

        actions.appendChild(openButton);
        actions.appendChild(downloadButton);

        this.previewHost.appendChild(actions);

        invertImages(this.tooltip);
    }

}
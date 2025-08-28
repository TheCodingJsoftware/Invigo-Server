import {PartData} from "@components/workspace/parts/part-container";
import {Ext, Previewer} from "@utils/preview-cache";
import {FileViewerDialog} from "@components/common/dialog/file-viewer-dialog";
import {invertImages} from "@utils/theme";

export function getFileIcon(extension: string): string {
    if (["DXF", "JPG", "JPEG", "WEBP"].includes(extension)) return "image";
    else if (extension === "PNG") return "file_png"
    else if (extension === "PDF") return "picture_as_pdf"
    else if (extension === "DXF") return "file_pdf"
    else return "preview"
}

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
        this.element.className = "file-button small-round tiny-padding tiny-margin vertical"
        this.element.addEventListener("click", () => this.buttonPressed());

        this.filePath = filePath;
        this.fileName = filePath.split(/[/\\]/).pop()!;
        this.extension = (filePath.match(/[^.]+$/)?.[0] ?? "").toUpperCase();

        this.tooltip = document.createElement("div");
        this.tooltip.className = "tooltip max left";

        const nameEl = document.createElement("div");
        nameEl.textContent = this.fileName;

        this.previewHost = document.createElement("div");

        this.tooltip.appendChild(nameEl);
        this.tooltip.appendChild(this.previewHost);

        this.element.innerHTML = "";
        // const icon = document.createElement("i");
        // icon.textContent = getFileIcon(this.extension);
        const ext = document.createElement("span");
        ext.textContent = String(this.extension);
        // this.element.appendChild(icon);
        this.element.appendChild(ext);
        this.element.appendChild(this.tooltip);

        this.element.addEventListener("mouseenter", () => this.ensurePreview());
        this.element.addEventListener("focus", () => this.ensurePreview());

        // background prefetch without blocking UI
        Previewer.prefetch(this.fileName, this.extension);
    }

    buttonPressed() {
        const fileViewerDialog = new FileViewerDialog(this.part.name, [this.part], this.filePath);
    }

    private async ensurePreview() {
        if (this.previewLoaded) return;
        this.previewLoaded = true;
        const node = await Previewer.get(this.fileName, this.extension);
        this.previewHost.innerHTML = "";
        this.previewHost.appendChild(node);
        invertImages();
    }
}
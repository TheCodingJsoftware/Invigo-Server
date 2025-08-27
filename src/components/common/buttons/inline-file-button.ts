import {PartData} from "@components/workspace/parts/part-container";
import {Ext, Previewer} from "@utils/preview-cache";
import {FileViewerDialog} from "@components/common/dialog/file-viewer-dialog";
import {invertImages} from "@utils/theme";

export class InlineFileButton {
    readonly element: HTMLButtonElement;
    readonly filePath: string;
    readonly fileName: string;
    readonly extension: Ext;

    private previewHost: HTMLDivElement;
    private previewLoaded = false;

    constructor(filePath: string) {
        this.element = document.createElement("button");
        this.element.classList.add("inline-file-button", "chip", "vertical");

        this.filePath = filePath;
        this.fileName = filePath.split(/[/\\]/).pop()!;
        this.extension = (filePath.match(/[^.]+$/)?.[0] ?? "").toUpperCase();

        this.previewHost = document.createElement("div");
        this.previewHost.classList.add("small-width");

        const fileName = document.createElement("span");
        fileName.textContent = String(this.fileName);
        this.element.appendChild(this.previewHost);
        this.element.appendChild(fileName);

        this.ensurePreview()

        // background prefetch without blocking UI
        Previewer.prefetch(this.fileName, this.extension);
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
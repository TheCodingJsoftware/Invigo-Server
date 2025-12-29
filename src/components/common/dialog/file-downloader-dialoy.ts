import { DialogComponent } from "@components/common/dialog/dialog-component";
import { PartData } from "@components/workspace/parts/part-container";
import { ToggleButton } from "@components/common/buttons/toggle-button";
import { getIcon } from 'material-file-icons';

export class FileDownloaderDialog extends DialogComponent {
    readonly parts: PartData[];
    readonly filePaths: string[];
    readonly filePath?: string;

    private readonly filesContainer: HTMLDivElement;
    private readonly downloadButton: HTMLButtonElement;
    private readonly fileButtons: ToggleButton[] = [];
    private readonly quickSelectExtensions = this.element.querySelector("#quick-select-extensions") as HTMLDivElement;

    constructor(parts: PartData[], filePath?: string) {
        super({
            id: "file-downloader-dialog",
            title: "File Downloader",
            bodyContent: `
                <fieldset class="small-round">
                    <legend>Quick Select</legend>
                    <nav class="row center-align" id="quick-select-extensions">
                </fieldset>
                </nav>
                <div class="grid tiny-space" id="files-container">
                </div>
                <nav class="row top-margin right-align">
                    <button id="download-button">
                        <i>download</i>
                        <span>Download</span>
                    </button>
                </nav>
            `,
        });

        this.filesContainer = this.element.querySelector("#files-container") as HTMLDivElement;
        this.downloadButton = this.element.querySelector("#download-button") as HTMLButtonElement;
        this.quickSelectExtensions = this.element.querySelector("#quick-select-extensions") as HTMLDivElement;

        this.filePaths = [
            ...new Set(
                parts.flatMap((part) => [
                    ...part.workspace_data.bending_files,
                    ...part.workspace_data.welding_files,
                    ...part.workspace_data.cnc_milling_files,
                ])
            ),
        ];
        this.filePath = filePath;
        this.parts = parts;
        this.init();
    }

    async init() {
        for (const extension of this.getExtensions()) {
            const button = document.createElement("button");
            button.classList.add("vertical", "extra", "border", "small-round");
            const iconDiv = document.createElement("i");
            const icon = getIcon(`.${extension.toLowerCase()}`);
            const ext = document.createElement("span");
            ext.textContent = String(extension.toUpperCase());
            button.appendChild(iconDiv);
            button.appendChild(ext);
            iconDiv.innerHTML = icon.svg
            button.addEventListener("click", () => this.selectByExtension(extension));
            this.quickSelectExtensions.appendChild(button);
        }

        for (const filePath of this.filePaths) {
            const fileName = filePath.split(/[\\/]/).pop()!;
            const extIdx = fileName.lastIndexOf(".");
            const extension = extIdx === -1 ? "" : fileName.slice(extIdx + 1).toLowerCase();

            const fileButton = new ToggleButton(fileName, fileName);
            fileButton.element.dataset.extension = extension;

            fileButton.element.classList.add("s12", "m6", "l4");
            fileButton.element.classList.remove("tiny-margin");

            this.fileButtons.push(fileButton);
            this.filesContainer.appendChild(fileButton.element);
        }

        this.downloadButton.addEventListener("click", () => this.downloadSelectedFiles());
    }

    selectByExtension(extension: string) {
        const ext = extension.toLowerCase();

        const anySelected = this.fileButtons.some(
            b => b.element.dataset.extension === ext && b.isChecked()
        );

        for (const btn of this.fileButtons) {
            if (btn.element.dataset.extension === ext) {
                btn.setChecked(!anySelected);
            }
        }
    }

    private downloadSelectedFiles() {
        const selected = this.fileButtons.filter(b => b.isChecked());

        if (selected.length === 0) return;

        for (const btn of selected) {
            const fileName = btn.value; // or btn.label — must match backend filename

            const url = `/workspace/get_file/${encodeURIComponent(fileName)}`;

            const a = document.createElement("a");
            a.href = url;
            a.download = fileName; // browser may ignore if inline
            a.target = "_blank";   // allows PDFs/images to open inline

            document.body.appendChild(a);
            a.click();
            a.remove();
        }
    }


    getExtensions(): string[] {
        const extensions = new Set<string>();

        for (const part of this.parts) {
            const files = [
                ...part.workspace_data.bending_files,
                ...part.workspace_data.welding_files,
                ...part.workspace_data.cnc_milling_files,
            ];

            for (const file of files) {
                const idx = file.lastIndexOf(".");
                if (idx === -1) continue;
                extensions.add(file.slice(idx + 1).toLowerCase());
            }
        }

        return [...extensions];
    }
}

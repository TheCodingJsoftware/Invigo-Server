import { invertImages } from "@utils/theme";
import { Previewer } from "@utils/preview-cache";
import { ToggleButton } from "@components/common/buttons/toggle-button";

export class SelectableFileButton {
    readonly toggle: ToggleButton;
    readonly fileName: string;
    readonly filePath: string;
    readonly extension: string;

    private previewHost: HTMLDivElement;
    private previewLoaded = false;

    constructor(
        label: string,
        filePath: string,
        checked = false
    ) {
        this.filePath = filePath;
        this.fileName = filePath.split(/[\\/]/).pop()!;
        this.extension = (this.fileName.match(/[^.]+$/)?.[0] ?? "").toUpperCase();

        // ---- BASE TOGGLE ----
        this.toggle = new ToggleButton(label, this.fileName, checked);
        this.toggle.element.classList.add(
            "vertical",
        );

        // ---- INLINE PREVIEW HOST ----
        this.previewHost = document.createElement("div");

        this.toggle.element.insertBefore(
            this.previewHost,
            this.toggle.element.firstChild
        );

        // Load preview immediately
        this.ensurePreview();

        // Background prefetch stays cheap
        Previewer.prefetch(this.fileName, this.extension);
    }

    get element(): HTMLButtonElement {
        return this.toggle.element;
    }

    isChecked(): boolean {
        return this.toggle.isChecked();
    }

    setChecked(v: boolean) {
        this.toggle.setChecked(v);
    }

    private async ensurePreview() {
        if (this.previewLoaded) return;
        this.previewLoaded = true;

        const node = await Previewer.get(this.fileName, this.extension);

        this.previewHost.replaceChildren(
            node,
        );

        invertImages(this.previewHost);
    }
}

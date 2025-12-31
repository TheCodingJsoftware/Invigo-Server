import { invertImages } from "@utils/theme";
import { Previewer } from "@utils/preview-cache";

export class SelectableFileItem {
    readonly fileName: string;
    readonly filePath: string;
    readonly extension: string;

    private li: HTMLLIElement;
    private preview: HTMLElement;
    private checked = false;

    onChange?: (state: boolean) => void;

    constructor(
        filePath: string,
        description = "",
        checked = false
    ) {
        this.filePath = filePath;
        this.fileName = filePath.split(/[\\/]/).pop()!;
        this.extension = (this.fileName.match(/[^.]+$/)?.[0] ?? "").toUpperCase();
        this.checked = checked;

        this.li = document.createElement("li");
        this.li.className = "selectable wave";
        this.li.setAttribute("role", "option");
        this.li.tabIndex = 0;

        // ---- PREVIEW ----
        this.preview = document.createElement("div");
        this.preview.className = "small-round preview";
        this.preview.style.maxHeight = "100px";
        this.preview.style.maxWidth = "100px";
        this.preview.style.objectFit = "cover";

        // ---- TEXT ----
        const textWrap = document.createElement("div");
        textWrap.className = "max";

        const title = document.createElement("h6");
        title.className = "small";
        title.textContent = this.fileName;

        const desc = document.createElement("div");
        desc.textContent = description;

        textWrap.append(title, desc);

        // ---- CHECK ICON ----
        const icon = document.createElement("i");
        icon.className = "material";

        this.li.append(this.preview, textWrap, icon);

        this.updateUI(icon);

        // ---- EVENTS ----
        this.li.addEventListener("click", () => this.toggle());
        this.li.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.toggle();
            }
        });

        this.loadPreview();
    }

    get element(): HTMLLIElement {
        return this.li;
    }

    isChecked(): boolean {
        return this.checked;
    }

    setChecked(state: boolean): void {
        if (this.checked !== state) {
            this.checked = state;
            this.updateUI(this.li.querySelector("i")!);
            this.onChange?.(state);
        }
    }

    toggle(): void {
        this.setChecked(!this.checked);
    }

    private updateUI(icon: HTMLElement) {
        this.li.classList.toggle("fill", this.checked);
        this.li.setAttribute("aria-selected", String(this.checked));
        icon.textContent = this.checked
            ? "check_box"
            : "check_box_outline_blank";
    }

    private async loadPreview() {
        const node = await Previewer.get(this.fileName, this.extension);
        this.preview.replaceChildren(node);
        invertImages(this.preview);

        Previewer.prefetch(this.fileName, this.extension);
    }
}

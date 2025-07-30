type DialogPosition = "left" | "right" | "top" | "bottom";
type DialogWidth = "small-width" | "medium-width" | "large-width";

interface DialogOptions {
    id?: string;
    position?: DialogPosition | null;
    width?: DialogWidth | null;
    onClose?: () => void;
    autoRemove?: boolean;
}

export class DialogComponent {
    private dialog: HTMLDialogElement;
    private options: Required<Omit<DialogOptions, "id" | "onClose">> & Pick<DialogOptions, "id" | "onClose">;

    constructor(html: string, options: DialogOptions = {}) {
        this.options = {
            position: options.position ?? null,
            width: options.width ?? null,
            autoRemove: options.autoRemove ?? true,
            id: options.id,
            onClose: options.onClose,
        };

        this.dialog = document.createElement("dialog");

        if (this.options.id) this.dialog.id = this.options.id;
        if (this.options.position) this.dialog.classList.add(this.options.position);
        if (this.options.width) this.dialog.classList.add(this.options.width);

        this.dialog.innerHTML = `<div class="dialog-content">${html}</div>`;

        this.dialog.addEventListener("close", () => {
            if (this.options.autoRemove) {
                setTimeout(() => this.dialog.remove(), 1000);
            }
            this.options.onClose?.();
        });

        document.body.appendChild(this.dialog);
        ui(this.dialog);
        document.addEventListener("keydown", this.handleEscape);
    }

    private handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            this.close();
        }
    };

    public query<T extends Element>(selector: string): T | null {
        return this.dialog.querySelector(selector);
    }

    public close(): void {
        document.removeEventListener("keydown", this.handleEscape);
        ui(this.dialog);
        setTimeout(() => this.dialog.remove(), 1000);
    }

    public get element(): HTMLDialogElement {
        return this.dialog;
    }
}

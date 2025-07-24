export class DialogComponent {
    private dialog: HTMLDialogElement;

    constructor(
        html: string,
        options: {
            id?: string;
            onClose?: () => void;
            autoRemove?: boolean;
        } = {}
    ) {
        this.dialog = document.createElement("dialog");
        this.dialog.classList.add("modal");
        if (options.id) {
            this.dialog.id = options.id;
        }

        this.dialog.innerHTML = `<div class="dialog-content">${html}</div>`;

        this.dialog.addEventListener("close", () => {
            if (options.autoRemove !== false) {
                setTimeout(() => {
                    this.dialog.remove();
                }, 1000);
            }
            options.onClose?.();
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
        setTimeout(() => {
            this.dialog.remove();
        }, 1000);
    }

    public get element(): HTMLDialogElement {
        return this.dialog;
    }
}

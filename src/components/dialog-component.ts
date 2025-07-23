import { setTime } from "effect/TestClock";

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
    }

    public query<T extends Element>(selector: string): T | null {
        return this.dialog.querySelector(selector);
    }

    public close(): void {
        this.dialog.close();
    }

    public get element(): HTMLDialogElement {
        return this.dialog;
    }
}

type SnackbarColor = "error" | "green" | "primary" | "secondary" | "tertiary" | "default";
type SnackbarPosition = "top" | "bottom";

interface SnackbarAction {
    text: string;
    onClick: () => void;
}

interface SnackbarOptions {
    id?: string;
    message: string;
    color?: SnackbarColor;
    position?: SnackbarPosition;
    duration?: number;
    action?: SnackbarAction;
    icon?: string;
    onClose?: () => void;
}

export class SnackbarComponent {
    private readonly snackbar: HTMLDivElement;
    private options: Required<Omit<SnackbarOptions, "id" | "action" | "icon" | "onClose">> &
        Pick<SnackbarOptions, "id" | "action" | "icon" | "onClose">;
    private timeoutId?: number;

    constructor(options: SnackbarOptions) {
        this.options = {
            id: options.id,
            message: options.message,
            color: options.color ?? "default",
            position: options.position ?? "bottom",
            duration: options.duration ?? 6000,
            action: options.action,
            icon: options.icon,
            onClose: options.onClose
        };

        this.snackbar = document.createElement("div");
        this.snackbar.className = "snackbar";

        if (this.options.id) {
            this.snackbar.id = this.options.id;
        }

        if (this.options.color !== "default") {
            this.snackbar.classList.add(this.options.color);
        }

        if (this.options.position === "top") {
            this.snackbar.classList.add("top");
        }

        this.createContent();
        this.show();
    }

    private createContent(): void {
        // Add icon if provided
        if (this.options.icon) {
            const iconElement = document.createElement("i");
            iconElement.textContent = this.options.icon;
            this.snackbar.appendChild(iconElement);
        }

        const messageDiv = document.createElement("div");
        messageDiv.className = "max";
        messageDiv.textContent = this.options.message;
        this.snackbar.appendChild(messageDiv);

        if (this.options.action) {
            const actionButton = document.createElement("a");
            actionButton.className = "inverse-link";
            actionButton.textContent = this.options.action.text;
            actionButton.addEventListener("click", () => {
                this.options.action!.onClick();
                this.close();
            });
            this.snackbar.appendChild(actionButton);
        }
    }

    private show(): void {
        // Remove any existing snackbars
        document.querySelectorAll(".snackbar").forEach(element => {
            if (element instanceof HTMLElement) {
                element.remove();
            }
        });

        document.body.appendChild(this.snackbar);

        requestAnimationFrame(() => {
            this.snackbar.classList.add("active");
        });

        if (this.options.duration > 0) {
            this.timeoutId = window.setTimeout(() => this.close(), this.options.duration);
        }
    }

    public close(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        this.snackbar.classList.remove("active");
        this.options.onClose?.();

        setTimeout(() => this.snackbar.remove(), 300);
    }

    public get element(): HTMLDivElement {
        return this.snackbar;
    }
}
type DialogPosition = "left" | "right" | "top" | "bottom" | "max";
type DialogWidth = "small-width" | "medium-width" | "large-width";

interface DialogOptions {
    id?: string;
    title?: string;
    position?: DialogPosition | null;
    width?: DialogWidth | null;
    onClose?: () => void;
    autoRemove?: boolean;
    headerContent?: string;
    bodyContent?: string;
    footerContent?: string;
    isModal?: boolean;
    draggable?: boolean;
}

export class DialogComponent {
    protected readonly bodyElement: HTMLElement;
    private readonly dialog: HTMLDialogElement;
    private options: Required<Omit<DialogOptions, "id" | "onClose" | "headerContent" | "bodyContent" | "footerContent" | "isModal">> &
        Pick<DialogOptions, "id" | "onClose" | "headerContent" | "bodyContent" | "footerContent" | "isModal">;
    private readonly headerElement: HTMLElement;
    private readonly footerElement: HTMLElement;
    private isDragging = false;
    private dragStartMouseX = 0;
    private dragStartMouseY = 0;
    private dragStartX = 0;
    private dragStartY = 0;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private rafPending = false;
    private nextX = 0;
    private nextY = 0;

    constructor(options: DialogOptions = {}) {
        this.headerElement = document.createElement("div");
        this.bodyElement = document.createElement("div");
        this.footerElement = document.createElement("div");

        this.options = {
            title: options.title ?? "Dialog",
            position: options.position ?? null,
            width: options.width ?? null,
            autoRemove: options.autoRemove ?? true,
            isModal: options.isModal ?? false,
            draggable: options.draggable ?? false,

            ...(options.id !== undefined && { id: options.id }),
            ...(options.onClose && { onClose: options.onClose }),
            ...(options.headerContent && { headerContent: options.headerContent }),
            ...(options.bodyContent && { bodyContent: options.bodyContent }),
            ...(options.footerContent && { footerContent: options.footerContent }),
        };

        this.dialog = document.createElement("dialog");

        if (this.options.id) this.dialog.id = this.options.id;
        if (this.options.position) this.dialog.classList.add(this.options.position);
        if (this.options.width) this.dialog.classList.add(this.options.width);
        if (this.options.isModal) this.dialog.classList.add("modal");

        this.createDialogContent();

        this.dialog.addEventListener("close", () => {
            if (this.options.autoRemove) {
                setTimeout(() => this.dialog.remove(), 200);
            }
            this.options.onClose?.();
        });

        document.body.appendChild(this.dialog);
        ui(this.dialog);
        document.addEventListener("keydown", this.handleEscape);
        if (this.options.draggable) {
            setTimeout(() => {
                const el = this.element;

                // Read once
                const rect = el.getBoundingClientRect();

                requestAnimationFrame(() => {
                    // Freeze BeerCSS animation immediately
                    el.style.transition = "none";
                    el.style.animation = "none";

                    // Lock position exactly where BeerCSS put it
                    el.style.position = "fixed";
                    el.style.left = "0";
                    el.style.top = "0";
                    el.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;

                    // Force style flush
                    el.getBoundingClientRect();

                    el.style.transition = "transform var(--speed1) ease-out";
                    el.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
                });
            }, 300);
        }
    }

    public get element(): HTMLDialogElement {
        return this.dialog;
    }

    public query<T extends Element>(selector: string): T | null {
        return this.dialog.querySelector(selector);
    }

    public close(): void {
        window.removeEventListener("resize", this.handleResize);
        document.removeEventListener("keydown", this.handleEscape);

        ui(this.dialog)

        if (this.options.autoRemove) {
            setTimeout(() => this.dialog.remove(), 200);
            this.removeOwnOverlay();
        }

        this.options.onClose?.();
    }

    private createDialogContent(): void {
        const dialogContent = document.createElement("div");

        if (this.options.headerContent) {
            this.headerElement.innerHTML = this.options.headerContent;
            this.headerElement.className = "dialog-header right-align";
        } else {
            this.createDefaultHeader();
        }
        dialogContent.appendChild(this.headerElement);

        if (this.options.bodyContent) {
            this.bodyElement.innerHTML = this.options.bodyContent;
            this.bodyElement.className = "dialog-body top-padding";
            dialogContent.appendChild(this.bodyElement);
        } else {
            this.createDefaultBody();
        }

        if (this.options.footerContent) {
            this.footerElement.innerHTML = this.options.footerContent;
            this.footerElement.className = "dialog-footer right-align";
            dialogContent.appendChild(this.footerElement);
        } else {
            this.createDefaultFooter();
        }

        this.dialog.appendChild(dialogContent);
    }

    private removeOwnOverlay(): void {
        const prev = this.dialog.previousElementSibling;
        if (prev instanceof HTMLElement && prev.classList.contains("overlay")) {
            prev.remove();
        }
    }

    private createDefaultHeader(): void {
        const nav = document.createElement("nav");
        nav.className = "row tiny-space dialog-header";

        if (this.options.draggable) {
            const handle = document.createElement("i");
            handle.className = "handle";
            handle.innerHTML = "drag_indicator";
            handle.addEventListener("mousedown", this.startDrag);
            nav.appendChild(handle);
        }

        const header = document.createElement("h5");
        header.className = "max";
        header.innerText = this.options.title;

        const closeButton = document.createElement("button");
        closeButton.className = "circle transparent";
        closeButton.innerHTML = "<i>close</i>";
        closeButton.addEventListener("click", () => this.close());

        nav.append(header, closeButton);
        this.headerElement.appendChild(nav);
    }

    private createDefaultBody(): void {
        const body = document.createElement("div");
        body.className = "dialog-body";
        this.bodyElement.appendChild(body);
    }

    private createDefaultFooter(): void {
        const footer = document.createElement("div");
        footer.className = "dialog-footer";
        this.footerElement.appendChild(footer);
    }

    private handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            if (this.dialog.open) {
                this.dialog.close();
            }
        }
    };

    private startDrag = (e: MouseEvent) => {
        if (!this.options.draggable || e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        this.element.classList.add("dragging");

        const rect = this.element.getBoundingClientRect();
        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;

        document.addEventListener("mousemove", this.onDrag);
        document.addEventListener("mouseup", this.stopDrag);
    };


    private onDrag = (e: MouseEvent) => {
        if (!this.isDragging || e.buttons !== 1) return;

        const x = e.clientX - this.dragOffsetX;
        const y = e.clientY - this.dragOffsetY;

        this.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };


    private stopDrag = () => {
        this.isDragging = false;
        this.element.classList.remove("dragging");
        document.body.classList.remove("no-select");

        document.removeEventListener("mousemove", this.onDrag);
        document.removeEventListener("mouseup", this.stopDrag);
    };


    public handleResize = () => {
        if (window.innerWidth < 600) {
            this.dialog.classList.add("max");
        } else {
            this.dialog.classList.remove("max");
        }
    };
}
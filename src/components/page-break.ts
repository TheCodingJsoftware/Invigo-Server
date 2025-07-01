import { BaseComponent } from "@interfaces/base-component";

export class PageBreak implements BaseComponent{
    private swapyItemId: number;
    private jobId: number;
    element!: HTMLElement;

    constructor(jobId: number, swapyItemId: number) {
        this.jobId = jobId;
        this.swapyItemId = swapyItemId;
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <div class="page-break-item" data-swapy-item="${this.swapyItemId}">
            <article class="border round hide-on-print">
                <nav>
                    <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                    <label class="checkbox">
                        <input type="checkbox" id="enable-page-break" checked>
                        <span>Enable Page Break</span>
                    </label>
                </nav
            </article>
        </div>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `page-break-${this.jobId}-${this.swapyItemId}`;


        return this.element;
    }

    initializeCheckbox(container: HTMLElement): void {
        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        checkbox.checked = localStorage.getItem(`show-page-break-${this.jobId}-${this.swapyItemId}`) === 'true';
        checkbox.addEventListener('change', () => {
            localStorage.setItem(`show-page-break-${this.jobId}-${this.swapyItemId}`, checkbox.checked.toString());
        });
    }

    public async render(): Promise<void> {
        const container = document.querySelector(`[data-swapy-slot="page-break-${this.swapyItemId}"]`) as HTMLElement;
        container.appendChild(this.build());

        this.initializeCheckbox(this.element);

        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

import { BaseComponent } from "@interfaces/base-component";
import { Job } from "@models/job";

export class TotalCost implements BaseComponent  {
    job: Job;
    jobId: number;
    element!: HTMLElement;

    constructor(job: Job) {
        this.jobId = job.job_data.id;
        this.job = job;
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav>
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max center-align">Total Cost: ${this.formatPrice(this.job.getLaserCutPartsCost() + this.job.getComponentsCost())}</h4>
                <button class="circle transparent hide-on-print" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="center-align">
                    <p>Taxes are <span class="italic bold">not</span> included in this quote.</p>
                    <p>A <span class="bold">1.5% monthly interest</span> will apply to overdue payments, starting from the date the goods are received.</p>
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `total-cost-${this.job.job_data.id}`;

        return this.element;
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#total-cost-container') as HTMLDivElement;
        container.appendChild(this.build());
        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

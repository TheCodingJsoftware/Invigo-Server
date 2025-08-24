import {BaseComponent} from "@interfaces/base-component";
import {Job} from "@models/job";

export class NetWeight implements BaseComponent {
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
                <h4 class="max center-align">Net Weight: ${this.formatWeight(this.job.getNetWeight())} lbs</h4>
            </nav>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `net-weight-${this.job.job_data.id}`;

        return this.element;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#net-weight-container') as HTMLDivElement;
        container.appendChild(this.build());
        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }

    private formatWeight(price: number): string {
        return `${price.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

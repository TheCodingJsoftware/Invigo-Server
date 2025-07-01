import { BaseComponent } from "@interfaces/base-component";
import { JobMeta } from "@models/job";

export class JobDetails implements BaseComponent {
    jobData: JobMeta;
    jobId: number;
    element!: HTMLElement;

    constructor(jobId: number, jobData: JobMeta) {
        this.jobId = jobId;
        this.jobData = jobData;
    }

    public build(): HTMLElement {
        const { name, order_number, PO_number, starting_date, ending_date, ship_to } = this.jobData;

        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav>
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max hide-on-print">Job Details</h4>
                <button class="circle transparent hide-on-print" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="grid top-padding">
                    <div class="s4 small-round field label prefix border">
                        <i>tag</i>
                        <input type="number" id="order-number" value="${order_number}">
                        <label>Order #</label>
                    </div>
                    <div class="s8 small-round field label prefix border">
                        <i>today</i>
                        <input type="date" id="date-shipped" value="">
                        <label>Date Shipped</label>
                    </div>
                    <div class="s4 small-round field label prefix border">
                        <i>tag</i>
                        <input type="number" id="purchase-order-number" value="${PO_number}">
                        <label>PO Number</label>
                    </div>
                    <div class="s8 small-round field label prefix border">
                        <i>event</i>
                        <input type="date" id="date-expected" value="${ending_date}">
                        <label>Date Expected</label>
                    </div>
                    <div class="s6 small-round field border label textarea">
                        <textarea id="ship-to">${ship_to}</textarea>
                        <label>Ship To</label>
                    </div>
                    <div class="s6 small-round field prefix border extra">
                        <i>signature</i>
                        <input type="number" id="received-in-good-order-by" value="">
                        <span class="helper">Received in Good Order By</span>
                    </div>
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `job-details-${this.jobId}`;

        return this.element;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#job-details-container') as HTMLDivElement;
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

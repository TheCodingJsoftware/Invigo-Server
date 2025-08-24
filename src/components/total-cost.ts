import {BaseComponent} from "@interfaces/base-component";
import {Job} from "@models/job";

export class TotalCost implements BaseComponent {
    job: Job;
    jobId: number;
    element!: HTMLElement;

    constructor(job: Job) {
        this.jobId = job.job_data.id;
        this.job = job;
    }

    public build(): HTMLElement {
        const subtotal = this.job.getLaserCutPartsCost() + this.job.getComponentsCost();

        const showGST = localStorage.getItem("show-GST") === "true";
        const showPST = localStorage.getItem("show-PST") === "true";

        let gstRate = 0.05; // Default 5% GST
        let pstRate = 0.07; // Default 7% PST

        if (this.job.job_data.business_info) {
            const gstRate = this.job.job_data.business_info.gst_rate ?? 0.05; // Default 5% GST
            const pstRate = this.job.job_data.business_info.pst_rate ?? 0.07; // Default 7% PST
        }

        const gstAmount = subtotal * gstRate;
        const pstAmount = subtotal * pstRate;

        let totalWithTaxes = subtotal;

        if (showGST) {
            totalWithTaxes += gstAmount;
        }
        if (showPST) {
            totalWithTaxes += pstAmount;
        }

        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav class="hide-on-print">
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max center-align">Total Cost</h4>
                <button class="circle transparent" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <nav class="grid small-padding hide-on-print">
                    <label class="s6 checkbox">
                        <input type="checkbox" id="show-gst-row">
                        <span>GST</span>
                    </label>
                    <label class="s6 checkbox">
                        <input type="checkbox" id="show-pst-row">
                        <span>PST</span>
                    </label>
                </nav>
                <table class="border">
                    <tbody>
                        <tr id="subtotal-row">
                            <td class="right-align">Subtotal</td>
                            <td id="subtotal-price">${this.formatPrice(subtotal)}</td>
                        </tr>
                        <tr id="gst-row">
                            <td class="right-align">GST (${this.formatPercent(gstRate)})</td>
                            <td id="gstPrice">${this.formatPrice(gstAmount)}</td>
                        </tr>
                        <tr id="pst-row">
                            <td class="right-align">PST (${this.formatPercent(pstRate)})</td>
                            <td id="pstPrice">${this.formatPrice(pstAmount)}</td>
                        </tr>
                        <tr>
                            <th class="right-align">Total</th>
                            <th id="total-price">${this.formatPrice(totalWithTaxes)}</th>
                        </tr>
                    </tbody>
                </table>
                <div class="center-align">
                    <p id="taxes-note">Taxes are <span class="italic bold">not</span> included in this quote.</p>
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

    public updateTotalPrice(): void {
        const subtotal = this.job.getLaserCutPartsCost() + this.job.getComponentsCost();
        const showGST = localStorage.getItem("show-gst-row") === "true";
        const showPST = localStorage.getItem("show-pst-row") === "true";

        let gstRate = 0.05; // Default 5% GST
        let pstRate = 0.07; // Default 7% PST

        if (this.job.job_data.business_info) {
            const gstRate = this.job.job_data.business_info.gst_rate ?? 0.05; // Default 5% GST
            const pstRate = this.job.job_data.business_info.pst_rate ?? 0.07; // Default 7% PST
        }

        const gstAmount = subtotal * gstRate;
        const pstAmount = subtotal * pstRate;

        let totalWithTaxes = subtotal;

        if (showGST) {
            totalWithTaxes += gstAmount;
        }
        if (showPST) {
            totalWithTaxes += pstAmount;
        }

        const taxesNote = this.element.querySelector('#taxes-note') as HTMLElement;
        const gstPrice = this.element.querySelector('#gstPrice') as HTMLElement;
        const pstPrice = this.element.querySelector('#pstPrice') as HTMLElement;
        const totalPrice = this.element.querySelector('#total-price') as HTMLElement;
        taxesNote.classList.toggle('hidden', showGST || showPST);
        gstPrice.textContent = this.formatPrice(gstAmount);
        pstPrice.textContent = this.formatPrice(pstAmount);
        totalPrice.textContent = this.formatPrice(totalWithTaxes);
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#total-cost-container') as HTMLDivElement;
        container.appendChild(this.build());

        const showGSTCheckBox = document.getElementById('show-gst-row') as HTMLInputElement;
        const gstRow = document.getElementById('gst-row') as HTMLElement;
        showGSTCheckBox.addEventListener('change', () => {
            if (showGSTCheckBox.checked) {
                gstRow.classList.remove('hidden');
            } else {
                gstRow.classList.add('hidden');
            }
            localStorage.setItem('show-gst-row', showGSTCheckBox.checked.toString());
            this.updateTotalPrice();
        });
        showGSTCheckBox.checked = localStorage.getItem('show-gst-row') === 'true';
        gstRow.classList.toggle('hidden', !showGSTCheckBox.checked);

        const showPSTCheckBox = document.getElementById('show-pst-row') as HTMLInputElement;
        const pstRow = document.getElementById('pst-row') as HTMLElement;
        showPSTCheckBox.addEventListener('change', () => {
            if (showPSTCheckBox.checked) {
                pstRow.classList.remove('hidden');
            } else {
                pstRow.classList.add('hidden');
            }
            localStorage.setItem('show-pst-row', showPSTCheckBox.checked.toString());
            this.updateTotalPrice();
        });
        showPSTCheckBox.checked = localStorage.getItem('show-pst-row') === 'true';
        pstRow.classList.toggle('hidden', !showPSTCheckBox.checked);
        this.updateTotalPrice();
        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }

    private formatPercent(value: number): string {
        return `${(value * 100).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

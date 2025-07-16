import { BaseComponent } from "@interfaces/base-component";
import { PurchaseOrder } from "@models/purchase-order";

export class PurchaseOrderTotalCost implements BaseComponent {
    purchaseOrder: PurchaseOrder;
    purchaseOrderId: number;
    element!: HTMLElement;

    constructor(purchaseOrder: PurchaseOrder) {
        this.purchaseOrderId = purchaseOrder.id;
        this.purchaseOrder = purchaseOrder;
    }

    public build(): HTMLElement {
        const subtotal = this.purchaseOrder.getSheetsCost() + this.purchaseOrder.getComponentsCost();

        const showGST = localStorage.getItem("show-GST") === "true";
        const showPST = localStorage.getItem("show-PST") === "true";

        const gstRate = this.purchaseOrder.meta_data.business_info.gst_rate ?? 0.05; // Default 5% GST
        const pstRate = this.purchaseOrder.meta_data.business_info.pst_rate ?? 0.07; // Default 7% PST

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
        <div class="row">
            <div class="max"></div>
            <div class="vertical">
            </div>
            <article class="border small-round min">
                <table class="border tiny-space">
                    <tbody>
                        <tr>
                            <td class="min right-align">Subtotal</td>
                            <td class="left-align">${this.formatPrice(subtotal)}</td>
                        </tr>
                        <tr id="gst-row">
                            <td class="min right-align">GST (${this.formatPercent(gstRate)})</td>
                            <td class="left-align">${this.formatPrice(gstAmount)}</td>
                        </tr>
                        <tr id="pst-row">
                            <td class="min right-align">PST (${this.formatPercent(pstRate)})</td>
                            <td class="left-align">${this.formatPrice(pstAmount)}</td>
                        </tr>
                        <tr>
                            <th class="min right-align">Total</th>
                            <th class="left-align" id="total-price">${this.formatPrice(totalWithTaxes)}</th>
                        </tr>
                    <tbody>
                </table>
            </article>
        </div>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `purchase-order-total-cost-${this.purchaseOrderId}`;

        return this.element;
    }

    updateTotalPrice(): void {
        const subtotal = this.purchaseOrder.getSheetsCost() + this.purchaseOrder.getComponentsCost();

        const showGST = localStorage.getItem("show-GST") === "true";
        const showPST = localStorage.getItem("show-PST") === "true";

        const gstRate = this.purchaseOrder.meta_data.business_info.gst_rate ?? 0.05; // Default 5% GST
        const pstRate = this.purchaseOrder.meta_data.business_info.pst_rate ?? 0.07; // Default 7% PST

        const gstAmount = subtotal * gstRate;
        const pstAmount = subtotal * pstRate;
        let totalWithTaxes = subtotal;

        if (showGST) {
            totalWithTaxes += gstAmount;
        }
        if (showPST) {
            totalWithTaxes += pstAmount;
        }

        this.element!.querySelector("#total-price")!.textContent = this.formatPrice(totalWithTaxes);
    }

    formatPercent(value: number): string {
        return `${(value * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#total-cost-container') as HTMLDivElement;
        container.innerHTML = ''; // Clear previous content
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

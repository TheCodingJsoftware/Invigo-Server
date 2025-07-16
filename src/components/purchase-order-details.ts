import { BaseComponent } from "@interfaces/base-component";
import { SHIPPING_METHOD_ICONS, ShippingMethod } from "@interfaces/purchase-order";
import { BusinessInfo } from "@models/business-info";
import { ContactInfo } from "@models/contact-info";
import { PurchaseOrder } from "@models/purchase-order";
import { Vendor } from "@models/vendor";

export class PurchaseOrderDetails implements BaseComponent {
    purchaseOrder: PurchaseOrder;
    vendor: Vendor;
    contactInfo: ContactInfo;
    businessInfo: BusinessInfo;
    purchaseOrderId: number;
    element!: HTMLElement;

    constructor(purchaseOrderId: number, purchaseOrder: PurchaseOrder) {
        this.purchaseOrderId = purchaseOrderId;
        this.purchaseOrder = purchaseOrder;
        this.vendor = purchaseOrder.meta_data.vendor;
        this.contactInfo = purchaseOrder.meta_data.contact_info;
        this.businessInfo = purchaseOrder.meta_data.business_info;
    }

    public build(): HTMLElement {
        const shippingMethod = this.titleCase(ShippingMethod[this.purchaseOrder.meta_data.shipping_method].toLowerCase());
        const template = document.createElement("template");
        const purchaseFrom = `
            ${this.vendor.name}
            ${this.vendor.address}

            Contact Information:
            ${this.vendor.phone}
            ${this.vendor.email}
            ${this.vendor.website}
        `.trim().replace(/  /g, "");

        const contactDetails = `
            ${this.businessInfo.name}
            ${this.purchaseOrder.meta_data.shipping_address.address}

            Contact Information:
            ${this.contactInfo.name}
            ${this.contactInfo.email}
            ${this.contactInfo.phone}
        `.trim().replace(/  /g, "");
        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav class="hide-on-print">
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">Purchase Order Details</h4>
                <nav class="group connected primary-container hide-on-print">
                    <button class="left-round" onclick="window.location.href='mailto:${this.vendor.email}'">
                        <i>send</i>
                    </button>
                    <button class="right-round" onclick="window.open('${this.vendor.website}', '_blank')">
                        <i>globe</i>
                    </button>
                </nav>
                <button class="circle transparent" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="grid top-padding">
                    <div class="s6 small-round field textarea label border extra">
                        <textarea id="vendor">${purchaseFrom}</textarea>
                        <label>Vendor</label>
                    </div>
                    <div class="s6 small-round field textarea label border extra">
                        <textarea id="contact">${contactDetails}</textarea>
                        <label>Ship To</label>
                    </div>
                    <div class="s6 small small-round field label prefix border">
                        <i>${SHIPPING_METHOD_ICONS[this.purchaseOrder.meta_data.shipping_method]}</i>
                        <input type="text" id="shipping-method" value="${shippingMethod}">
                        <label>Shipping Method</label>
                    </div>
                    <div class="s6 small small-round field label prefix border">
                        <i>event</i>
                        <input type="date" id="required-by-date">
                        <label>Required By Date</label>
                    </div>
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `purchase-order-details-${this.purchaseOrderId}`;

        return this.element;
    }

    titleCase(str: string): string {
        str = str.replace(/_/g, ' ');
        return str.replace(/\w\S*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#purchase-order-details-container') as HTMLDivElement;
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

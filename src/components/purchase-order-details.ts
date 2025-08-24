import {BaseComponent} from "@interfaces/base-component";
import {SHIPPING_METHOD_ICONS, ShippingMethod} from "@interfaces/purchase-order";
import {BusinessInfo} from "@models/business-info";
import {ContactInfo} from "@models/contact-info";
import {PurchaseOrder} from "@models/purchase-order";
import {Vendor} from "@models/vendor";
import flatpickr from "flatpickr";
import {Instance as FlatpickrInstance} from "flatpickr/dist/types/instance";

require("flatpickr/dist/themes/dark.css");

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
            ${this.vendor.name ? `${this.vendor.name}<br>` : ""}
            ${this.vendor.address ? `${this.vendor.address.split("\n").join("<br>")}<br>` : ""}
            ${(this.vendor.phone || this.vendor.email || this.vendor.website) ? `
            <div id="vendorContactDetails"><hr>
                <b>Contact Information:</b><br>
                ${this.vendor.phone ? `<a class="link" href="tel:${this.vendor.phone}">${this.vendor.phone}</a><br>` : ""}
                ${this.vendor.email ? `<a class="link" href="mailto:${this.vendor.email}">${this.vendor.email}</a><br>` : ""}
                ${this.vendor.website ? `<a class="link" href="${this.vendor.website}">${this.vendor.website}</a>` : ""}
            </div>` : ""}
        `.trim().replace(/  /g, "");

        const contactDetails = `
            ${this.businessInfo.name ? `${this.businessInfo.name}<br>` : ""}
            ${this.purchaseOrder.meta_data.shipping_address.address
            ? `${this.purchaseOrder.meta_data.shipping_address.address.split("\n").join("<br>")}<br>` : ""}
            ${(this.contactInfo.name || this.contactInfo.email || this.contactInfo.phone) ? `
            <div id="contactDetails"><hr>
                <b>Contact Information:</b><br>
                ${this.contactInfo.name ? `${this.contactInfo.name}` : ""}
                ${this.contactInfo.email ? `(<a class="link" href="mailto:${this.contactInfo.email}">${this.contactInfo.email}</a>)<br>` : ""}
                ${this.contactInfo.phone ? `<a class="link" href="tel:${this.contactInfo.phone}">${this.contactInfo.phone}</a><br>` : ""}
            </div>` : ""}
        `.trim().replace(/  /g, "");

        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav class="hide-on-print">
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">Purchase Order Details</h4>
                <nav class="group connected primary-container hide-on-print">
                    ${this.vendor.website ? `
                <button class="circle" onclick="window.open('${this.vendor.website}', '_blank')">
                    <i>globe</i>
                    <div class="tooltip bottom">${this.vendor.website}</div>
                </button>` : ``}
                </nav>
                <button class="circle transparent" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="grid top-padding">
                    <fieldset class="s6 small-round">
                        <legend>Vendor</legend>
                        ${purchaseFrom}
                    </fieldset>
                    <fieldset class="s6 small-round">
                        <legend>Ship To</legend>
                        ${contactDetails}
                    </fieldset>
                    <div class="s6 small small-round field label prefix border">
                        <i>${SHIPPING_METHOD_ICONS[this.purchaseOrder.meta_data.shipping_method]}</i>
                        <input type="text" id="shipping-method" value="${shippingMethod}">
                        <label>Shipping Method</label>
                    </div>
                    <div class="s6 small small-round field label prefix border">
                        <i>event</i>
                        <input type="date" id="required-by-date" value="${this.purchaseOrder.meta_data.order_date}">
                        <label>Required By</label>
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

        const requiredByDate = flatpickr("#required-by-date", {
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
        }) as FlatpickrInstance;

        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

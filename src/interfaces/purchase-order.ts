import { Vendor } from "@models/vendor";
import { VendorDict } from "@interfaces/vendor";
import { ContactInfoDict } from "@interfaces/contact-info";
import { BusinessInfoDict } from "@interfaces/business-info";
import { ContactInfo } from "@models/contact-info";
import { BusinessInfo } from "@models/business-info";
import { ShippingAddress } from "@models/shipping_address";
import { ShippingAddressDict } from "@interfaces/shipping-address";

export interface MetaDataDict {
    purchase_order_number: number;
    status: number;
    order_date: string;
    notes: string;
    shipping_method: number;
    contact_info: ContactInfoDict;
    business_info: BusinessInfoDict;
    vendor: VendorDict;
    shipping_address: ShippingAddressDict;
    is_draft: boolean;
    email_sent_at: string;
    freight_price: number;
    has_opened: boolean;
}

export interface POItemDict {
    id: number;
    order_quantity: number;
}

export interface PurchaseOrderData {
    id: number;
    meta_data: MetaDataDict;
    components: POItemDict[];
    sheets: POItemDict[];
}

export enum PurchaseOrderStatus {
    PURCHASE_ORDER = 0,
    QUOTE,
    RELEASE_ORDER,
}

export enum ShippingMethod {
    HOLD_FOR_PICKUP = 0,
    PICK_UP,
    BRUDER_DELIVERY,
    FED_EX,
    MAIL,
    SEND_BY_COURIER,
    GARDWINE_COLLECT,
    PRE_PAID,
    MOTOPAK_COLLECT,
    MOTOPACK_PRE_PAID,
    GREYHOUND_COLLECT,
    ROSENORTH_COLLECT,
    COLLECT,
    WILL_CALL,
}

export const SHIPPING_METHOD_ICONS: Record<ShippingMethod, string> = {
    [ShippingMethod.HOLD_FOR_PICKUP]: "location_on",
    [ShippingMethod.PICK_UP]: "person_pin_circle",
    [ShippingMethod.BRUDER_DELIVERY]: "local_shipping",
    [ShippingMethod.FED_EX]: "local_shipping",
    [ShippingMethod.MAIL]: "mail",
    [ShippingMethod.SEND_BY_COURIER]: "local_shipping",
    [ShippingMethod.GARDWINE_COLLECT]: "warehouse",
    [ShippingMethod.PRE_PAID]: "paid",
    [ShippingMethod.MOTOPAK_COLLECT]: "local_shipping",
    [ShippingMethod.MOTOPACK_PRE_PAID]: "paid",
    [ShippingMethod.GREYHOUND_COLLECT]: "directions_bus",
    [ShippingMethod.ROSENORTH_COLLECT]: "warehouse",
    [ShippingMethod.COLLECT]: "move_to_inbox",
    [ShippingMethod.WILL_CALL]: "call",
};

export class MetaData {
    purchase_order_number: number = 0;
    status: PurchaseOrderStatus = PurchaseOrderStatus.PURCHASE_ORDER;
    shipping_method: ShippingMethod = ShippingMethod.HOLD_FOR_PICKUP;
    shipping_address: ShippingAddress;
    order_date: string = "";
    notes: string = "";
    contact_info: ContactInfo;
    business_info: BusinessInfo;
    vendor: Vendor;
    is_draft: boolean = false;
    email_sent_at: string = "";
    freight_price: number = 0.0;
    has_opened: boolean = false;


    constructor(data?: MetaDataDict) {
        this.vendor = new Vendor();
        this.shipping_address = new ShippingAddress();
        this.contact_info = new ContactInfo();
        this.business_info = new BusinessInfo();
        if (data) {
            this.loadData(data);
        }
    }

    loadData(data: MetaDataDict): void {
        this.purchase_order_number = data.purchase_order_number ?? 0;
        this.status = data.status ?? PurchaseOrderStatus.PURCHASE_ORDER;
        this.shipping_method = data.shipping_method ?? ShippingMethod.HOLD_FOR_PICKUP;
        this.order_date = data.order_date ?? "";
        this.notes = data.notes ?? "";
        this.shipping_address.loadData(data.shipping_address);
        this.contact_info.loadData(data.contact_info);
        this.business_info.loadData(data.business_info);
        this.vendor.loadData(data.vendor);
        this.is_draft = data.is_draft ?? false;
        this.email_sent_at = data.email_sent_at ?? "";
        this.freight_price = data.freight_price ?? 0.0;
        this.has_opened = data.has_opened ?? false;
    }

    toDict(): MetaDataDict {
        return {
            purchase_order_number: this.purchase_order_number,
            status: this.status,
            shipping_method: this.shipping_method,
            order_date: this.order_date,
            notes: this.notes,
            contact_info: this.contact_info.toDict(),
            business_info: this.business_info.toDict(),
            vendor: this.vendor.toDict(),
            shipping_address: this.shipping_address.toDict(),
            is_draft: this.is_draft,
            email_sent_at: this.email_sent_at,
            freight_price: this.freight_price,
            has_opened: this.has_opened
        };
    }
}

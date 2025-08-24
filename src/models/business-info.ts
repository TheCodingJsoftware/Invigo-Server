import {BusinessInfoDict} from "@interfaces/business-info";

export class BusinessInfo implements BusinessInfoDict {
    name: string = "";
    address: string = "";
    phone: string = "";
    website: string = "";
    pst_number: string = "";
    gst_number: string = "";
    pst_rate: number = 0.07; // Default 7% PST
    gst_rate: number = 0.05; // Default 5% GST
    business_number: string = "";

    constructor(data?: BusinessInfoDict) {
        if (data) {
            this.loadData(data);
        }
    }

    loadData(data: BusinessInfoDict): void {
        this.name = data.name ?? "";
        this.address = data.address ?? "";
        this.phone = data.phone ?? "";
        this.website = data.website ?? "";
        this.pst_number = data.pst_number ?? "";
        this.gst_number = data.gst_number ?? "";
        this.gst_rate = data.gst_rate ?? 0.05; // Default 5% GST
        this.pst_rate = data.pst_rate ?? 0.07
        this.business_number = data.business_number ?? "";
    }

    toDict(): BusinessInfoDict {
        return {
            name: this.name,
            address: this.address,
            phone: this.phone,
            website: this.website,
            pst_number: this.pst_number,
            gst_number: this.gst_number,
            pst_rate: this.pst_rate,
            gst_rate: this.gst_rate,
            business_number: this.business_number,
        };
    }
}
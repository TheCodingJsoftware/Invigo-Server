import { ShippingAddressDict } from "@interfaces/shipping-address";

export class ShippingAddress {
    id: number = 0;
    name: string = "";
    address: string = "";
    phone: string = "";
    email: string = "";
    website: string = "";
    notes: string = "";

    constructor(data?: ShippingAddressDict) {
        if (data) {
            this.loadData(data);
        }
    }

    toString(): string {
        const parts: string[] = [];

        if (this.name) parts.push(`Name: ${this.name}`);
        if (this.address) parts.push(`Address: ${this.address}`);
        if (this.phone) parts.push(`Phone: ${this.phone}`);
        if (this.email) parts.push(`Email: ${this.email}`);
        if (this.website) parts.push(`Website: ${this.website}`);
        if (this.notes) parts.push(`Notes: ${this.notes}`);

        return parts.join("\n");
    }

    loadData(data: ShippingAddressDict): void {
        this.id = data.id ?? 0;
        this.name = data.name ?? "";
        this.address = data.address ?? "";
        this.phone = data.phone ?? "";
        this.email = data.email ?? "";
        this.website = data.website ?? "";
        this.notes = data.notes ?? "";
    }

    toDict(): ShippingAddressDict {
        return {
            id: this.id,
            name: this.name,
            address: this.address,
            phone: this.phone,
            email: this.email,
            website: this.website,
            notes: this.notes,
        };
    }
}

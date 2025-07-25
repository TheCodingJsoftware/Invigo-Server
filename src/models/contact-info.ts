import { ContactInfoDict } from "@interfaces/contact-info";

export class ContactInfo implements ContactInfoDict {
    name: string = "";
    phone: string = "";
    email: string = "";
    password: string = "";

    constructor(data?: ContactInfoDict) {
        if (data) {
            this.loadData(data);
        }
    }

    toDict(): ContactInfoDict {
        return {
            name: this.name,
            phone: this.phone,
            email: this.email,
            password: this.password,
        };
    }

    loadData(data: ContactInfoDict): void {
        this.name = data.name ?? "";
        this.phone = data.phone ?? "";
        this.email = data.email ?? "";
        this.password = data.password ?? "";
    }
}

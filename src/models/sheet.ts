import { SheetData } from "@interfaces/sheet";
import { Order } from "@models/order";

export class Sheet {
    id!: number;
    name!: string;
    thickness!: string;
    material!: string;
    width!: number;
    length!: number;
    has_sent_warning!: boolean;
    notes!: string;
    orders!: Order[];
    categories!: string[];
    quantity!: number;
    latest_change_quantity!: string;
    red_quantity_limit!: number;
    yellow_quantity_limit!: number;

    constructor(data: SheetData) {
        Object.assign(this, data);
        this.orders = data.orders.map(o => new Order(o));
    }

    getArea(): number {
        return this.width * this.length;
    }

    isBelowRedLimit(): boolean {
        return this.quantity < this.red_quantity_limit;
    }

    isBelowYellowLimit(): boolean {
        return this.quantity < this.yellow_quantity_limit;
    }

    toJSON(): SheetData {
        return { ...this };
    }
}
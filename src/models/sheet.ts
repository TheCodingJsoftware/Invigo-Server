import {SheetData} from "@interfaces/sheet";
import {Order} from "@models/order";

export class Sheet {
    id!: number;
    name!: string;
    thickness!: string;
    material!: string;
    width!: number;
    length!: number;
    pounds_per_square_foot!: number;
    has_sent_warning!: boolean;
    notes!: string;
    orders!: Order[];
    categories!: string[];
    quantity!: number;
    price!: number;
    price_per_pound!: number;
    latest_change_quantity!: string;
    red_quantity_limit!: number;
    yellow_quantity_limit!: number;

    constructor(data: SheetData) {
        Object.assign(this, data);
        this.orders = data.orders.map(o => new Order(o));
    }

    getPOItemName(): string {
        return `${this.thickness} ${this.material}<br>width: ${this.width}in length: ${this.length}in`;
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
        return {...this};
    }
}
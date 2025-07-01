import { ComponentData } from "@interfaces/component";
import { Order } from "@models/order";

export class Component {
    id!: number;
    part_number!: string;
    part_name!: string;
    quantity!: number;
    price!: number;
    use_exchange_rate!: boolean;
    priority!: number;
    shelf_number!: string;
    notes!: string;
    image_path!: string;
    latest_change_quantity!: string;
    latest_change_price!: string;
    red_quantity_limit!: number;
    yellow_quantity_limit!: number;
    categories!: string[];
    category_quantities!: Record<string, number>;
    orders!: Order[];

    constructor(data: ComponentData) {
        Object.assign(this, data);
        this.orders = data.orders.map(o => new Order(o));
    }

    isBelowRedLimit(): boolean {
        return this.quantity < this.red_quantity_limit;
    }

    isBelowYellowLimit(): boolean {
        return this.quantity < this.yellow_quantity_limit;
    }

    getTotalValue(): number {
        return this.quantity * this.price;
    }

    usesExchangeRate(): boolean {
        return this.use_exchange_rate;
    }

    toJSON(): ComponentData {
        return { ...this };
    }
}
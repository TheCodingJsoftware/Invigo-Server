import {FlowtagData} from "@interfaces/flowtag";
import {OrderData} from "@interfaces/order";
import {StructuralProfileData} from "@interfaces/structural-profile";
import {Flowtag} from "@models/flowtag";
import {Order} from "@models/order";

export class StructuralProfile {
    name!: string;
    part_number!: string;
    notes!: string;
    material!: string;
    flowtag!: FlowtagData;
    orders!: OrderData[];
    red_quantity_limit!: number;
    yellow_quantity_limit!: number;
    has_sent_warning!: boolean;
    quantity!: number;
    latest_change_quantity!: string;
    length!: number;
    cost!: number;
    latest_change_cost!: string;
    categories!: string[];

    constructor(data: StructuralProfileData) {
        Object.assign(this, data);
        this.flowtag = new Flowtag(data.flowtag);
        this.orders = data.orders.map(o => new Order(o));
    }

    isBelowRedLimit(): boolean {
        return this.quantity < this.red_quantity_limit;
    }

    isBelowYellowLimit(): boolean {
        return this.quantity < this.yellow_quantity_limit;
    }

    getTotalCost(): number {
        return this.quantity * this.cost;
    }

    shouldSendWarning(): boolean {
        return this.isBelowRedLimit() && !this.has_sent_warning;
    }

    toJSON(): StructuralProfileData {
        return {...this};
    }
}
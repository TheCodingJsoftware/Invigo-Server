import type {FlowtagData} from "@interfaces/flowtag";
import type {OrderData} from "@interfaces/order";

export interface StructuralProfileData {
    name: string;
    part_number: string;
    notes: string;
    material: string;
    flowtag: FlowtagData;
    orders: OrderData[];
    red_quantity_limit: number;
    yellow_quantity_limit: number;
    has_sent_warning: boolean;
    quantity: number;
    latest_change_quantity: string;
    length: number;
    cost: number;
    latest_change_cost: string;
    categories: string[];
}

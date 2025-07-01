import type { FlowtagData } from "./flowtag"; // Define this if needed
import type { OrderData } from "./order"; // Assuming you already have this

export interface StructuralProfileData {
    name: string;
    part_number: string;
    notes: string;
    material: string;
    flow_tag: FlowtagData;
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

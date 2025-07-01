import { OrderData } from "./order";

export interface SheetData {
    id: number;
    name: string;
    thickness: string;
    material: string;
    width: number;
    length: number;
    has_sent_warning: boolean;
    notes: string;
    orders: OrderData[];
    categories: string[];
    quantity: number;
    latest_change_quantity: string;
    red_quantity_limit: number;
    yellow_quantity_limit: number;
}

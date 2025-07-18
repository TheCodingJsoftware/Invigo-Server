import { OrderData } from "@interfaces/order";

export interface SheetData {
    id: number;
    name: string;
    thickness: string;
    material: string;
    width: number;
    length: number;
    pounds_per_square_foot: number;
    has_sent_warning: boolean;
    notes: string;
    orders: OrderData[];
    categories: string[];
    quantity: number;
    price: number;
    price_per_pound: number;
    latest_change_quantity: string;
    red_quantity_limit: number;
    yellow_quantity_limit: number;
}

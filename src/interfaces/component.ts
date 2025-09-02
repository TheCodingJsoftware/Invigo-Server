import type {OrderData} from "@interfaces/order";

export interface ComponentData {
    id: number;
    part_number: string;
    part_name: string;
    quantity: number;
    price: number;
    saved_price: number;
    use_exchange_rate: boolean;
    priority: number;
    shelf_number: string;
    notes: string;
    image_path: string;
    latest_change_quantity: string;
    latest_change_price: string;
    red_quantity_limit: number;
    yellow_quantity_limit: number;
    categories: string[];
    category_quantities: Record<string, number>;
    orders: OrderData[];
}

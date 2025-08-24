import {FlowtagData} from "@interfaces/flowtag";

export interface LaserCutPartData {
    id: number;
    name: string;
    categories: string[];
    category_quantities: Record<string, number>;
    inventory_data: {
        quantity: number;
        red_quantity_limit: number;
        yellow_quantity_limit: number;
    };
    meta_data: {
        machine_time: number;
        weight: number;
        part_number: string;
        image_index: string;
        surface_area: number;
        cutting_length: number;
        file_name: string;
        piercing_time: number;
        piercing_points: number;
        gauge: string;
        material: string;
        shelf_number: string;
        sheet_dim: string;
        part_dim: string;
        geofile_name: string;
        modified_date: string;
        bend_hits: number;
        notes: string;
        quantity_on_sheet: number;
    };
    prices: {
        price: number;
        cost_of_goods: number;
        bend_cost: number;
        labor_cost: number;
        cost_for_paint: number;
        cost_for_primer: number;
        cost_for_powder_coating: number;
        matched_to_sheet_cost_price: number;
    };
    paint_data: {
        uses_paint: boolean;
        paint_name: string;
        paint_item: unknown | null;
        paint_overspray: number;
    };
    primer_data: {
        uses_primer: boolean;
        primer_name: string;
        primer_item: unknown | null;
        primer_overspray: number;
    };
    powder_data: {
        uses_powder: boolean;
        powder_name: string;
        powder_item: unknown | null;
        powder_transfer_efficiency: number;
    };
    workspace_data: {
        bending_files: string[];
        welding_files: string[];
        cnc_milling_files: string[];
        flowtag: FlowtagData;
        flow_tag_data: Record<string, { expected_time_to_complete: number }>;
    };
}
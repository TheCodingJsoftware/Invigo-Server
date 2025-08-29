import {ComponentData} from "@interfaces/component";
import {FlowtagData} from "@interfaces/flowtag";
import {LaserCutPartData} from "@interfaces/laser-cut-part";


export interface PricesData {
    cost_for_paint: number;
    cost_for_primer: number;
    cost_for_powder_coating: number;
}

export interface MetaData {
    assembly_image: string;
    not_part_of_process: boolean;
    has_serial_number: boolean;
    quantity: number;
    color: string;
}

export interface WorkspaceData {
    starting_date: string;
    ending_date: string;
    expected_time_to_complete: number;
    assembly_files: string[];
    flowtag: FlowtagData;
    flow_tag_data: Record<string, { expected_time_to_complete: number }>;
}

export interface PrimerData {
    uses_primer: boolean;
    primer_name?: string;
    primer_overspray: number;
}

export interface PaintData {
    uses_paint: boolean;
    paint_name?: string;
    paint_overspray: number;
}

export interface PowderData {
    uses_powder_coating: boolean;
    powder_name?: string;
    powder_transfer_efficiency: number;
}

export interface AssemblyData {
    id: number;
    name: string;
    meta_data: MetaData;
    prices: PricesData;
    workspace_data: WorkspaceData;
    primer_data: PrimerData;
    paint_data: PaintData;
    powder_data: PowderData;
    laser_cut_parts: LaserCutPartData[];
    components: ComponentData[];
    sub_assemblies: AssemblyData[];
}
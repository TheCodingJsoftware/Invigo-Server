import { ComponentData } from "@interfaces/component";
import { FlowtagData } from "@interfaces/flowtag";
import { LaserCutPartData } from "@interfaces/laser-cut-part";
import { StructuralProfileData } from "@interfaces/structural-profile";

export interface AssemblyData {
  assembly_data: AssemblyMetaData;
  laser_cut_parts: LaserCutPartData[];
  components: ComponentData[];
  structural_steel_components: StructuralProfileData[];
  sub_assemblies: AssemblyData[];
}

export interface AssemblyMetaData {
  id: number;
  name: string;
  color: string;
  starting_date: string;
  expected_time_to_complete: number;
  ending_date: string;
  assembly_image?: string;
  quantity: number;
  not_part_of_process: boolean;

  uses_primer: boolean;
  primer_name?: string;
  primer_overspray: number;
  cost_for_primer: number;

  uses_paint: boolean;
  paint_name?: string;
  paint_overspray: number;
  cost_for_paint: number;

  uses_powder_coating: boolean;
  powder_name?: string;
  powder_transfer_efficiency: number;
  cost_for_powder_coating: number;

  assembly_files: string[];

  flow_tag: FlowtagData;
  current_flow_tag_index: number;
  current_flow_tag_status_index: number;
  timer: Record<string, unknown>;
  flow_tag_data: Record<string, { expected_time_to_complete: number }>;
}

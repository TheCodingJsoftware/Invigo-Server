import { LaserCutPart } from "@models/laser-cut-part";

export interface LaserCutPartGroupData {
    name: string;
    base_part: LaserCutPart;
    laser_cut_parts: LaserCutPart[];
}

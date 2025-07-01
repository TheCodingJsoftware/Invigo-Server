import { LaserCutPartData } from "./laser-cut-part";

export interface LaserCutPartGroupData {
    name: string;
    base_part: LaserCutPartData;
    laser_cut_parts: LaserCutPartData[];
}

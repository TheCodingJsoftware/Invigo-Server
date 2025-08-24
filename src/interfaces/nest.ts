import {LaserCutPartData} from "@interfaces/laser-cut-part";
import {SheetData} from "@interfaces/sheet";

export interface NestData {
    id: number;
    name: string;
    cutting_method: string;
    sheet_count: number;
    scrap_percentage: number;
    sheet_cut_time: number;
    image_path: string;
    notes: string;
    laser_cut_parts: LaserCutPartData[];
    sheet: SheetData;
}

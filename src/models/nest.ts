import { NestData } from "@interfaces/nest";
import { LaserCutPart } from "@models/laser-cut-part"; // use the class, not the interface
import { Sheet } from "@models/sheet";
import { naturalCompare } from "@utils/natural-sort";

export class Nest {
    public id!: number;
    public name!: string;
    public cutting_method!: string;
    public sheet_count!: number;
    public scrap_percentage!: number;
    public sheet_cut_time!: number;
    public image_path!: string;
    public notes!: string;
    public laser_cut_parts!: LaserCutPart[];
    public sheet!: Sheet;

    constructor(data: NestData) {
        Object.assign(this, data);

        this.laser_cut_parts = data.laser_cut_parts
            .map(p => new LaserCutPart(p))
            .sort((a, b) => naturalCompare(a.name, b.name));
        this.sheet = new Sheet(data.sheet);
    }

    getTotalParts(): number {
        return this.laser_cut_parts.length;
    }

    getTotalCutTime(): number {
        return this.sheet_cut_time * this.sheet_count;
    }

    getTotalCoatingCost(): number {
        return this.laser_cut_parts.reduce((total, part) => total + part.getTotalCoatingCost(), 0);
    }

    getSafeIdName(): string {
        return this.name.replace(/[^a-zA-Z0-9]/g, "-");
    }

    toJSON(): NestData {
        return {
            ...this,
            laser_cut_parts: this.laser_cut_parts.map(p => ({ ...p })),
            sheet: { ...this.sheet },
        };
    }
}

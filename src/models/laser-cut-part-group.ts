import { LaserCutPartGroupData } from "@interfaces/laser-cut-part-group";
import { naturalCompare } from "@utils/natural-sort";

import { LaserCutPart } from "./laser-cut-part";

export class LaserCutPartGroup  {
    name: string;
    base_part: LaserCutPart;
    laser_cut_parts: LaserCutPart[];

    constructor(data: LaserCutPartGroupData) {
        this.name = data.name;
        this.base_part = new LaserCutPart(data.base_part);

        this.laser_cut_parts = data.laser_cut_parts
            .map(p => new LaserCutPart(p))
            .sort((a, b) => naturalCompare(a.name, b.name));
    }

    applyNaturalSort() {
        this.laser_cut_parts.sort((a, b) => naturalCompare(a.name, b.name));
    }

    getTotalQuantity(): number {
        return this.laser_cut_parts.reduce((total, part) => total + part.quantity, 0);
    }

    getTotalPrice(): number {
        return this.getTotalQuantity() * this.getPrice();
    }

    getQuantity(): number {
        return this.base_part.quantity;
    }

    getPrice(): number {
        return this.base_part.price;
    }

    getProcess(): string {
        return this.base_part.flow_tag.tags.join(" ➜ ");
    }

    getGauge(): string {
        return this.base_part.gauge;
    }

    getMaterial(): string {
        return this.base_part.gauge + "<br>" + this.base_part.material;
    }

    getNotes(): string {
        return this.base_part.notes;
    }

    getShelfNumber(): string {
        return this.base_part.shelf_number;
    }

    getImagePath(): string {
        return this.base_part.image_index;
    }
}

import { LaserCutPartGroupData } from "@interfaces/laser-cut-part-group";
import { naturalCompare } from "@utils/natural-sort";

import { LaserCutPart } from "@models/laser-cut-part";
import { Nest } from "@models/nest";

export class LaserCutPartGroup {
    name: string;
    base_part: LaserCutPart;
    laser_cut_parts: LaserCutPart[];

    nest: Nest | null = null;

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
        return this.laser_cut_parts.reduce((total, part) => total + part.inventory_data.quantity, 0);
    }

    getTotalPrice(): number {
        return this.getTotalQuantity() * this.getPrice();
    }

    getQuantity(): number {
        return this.base_part.inventory_data.quantity;
    }

    getPrice(): number {
        return this.base_part.prices.price;
    }

    getProcess(): string {
        return this.base_part.workspace_data.flowtag.tags.join(" ➜ ");
    }

    getGauge(): string {
        return this.base_part.meta_data.gauge;
    }

    getMaterial(): string {
        return this.base_part.meta_data.gauge + "<br>" + this.base_part.meta_data.material;
    }

    getNotes(): string {
        return this.base_part.meta_data.notes;
    }

    getShelfNumber(): string {
        return this.base_part.meta_data.shelf_number;
    }

    getImagePath(): string {
        return this.base_part.meta_data.image_index;
    }
}

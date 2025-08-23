import { LaserCutPartGroupData } from "@interfaces/laser-cut-part-group";
import { naturalCompare } from "@utils/natural-sort";

import { LaserCutPart } from "@models/laser-cut-part";

export class LaserCutPartGroup {
    name: string;
    base_part: LaserCutPart;
    laser_cut_parts: LaserCutPart[];


    constructor(data: LaserCutPartGroupData) {
        this.name = data.name;
        this.base_part = new LaserCutPart(data.base_part);

        this.laser_cut_parts = data.laser_cut_parts
            .sort((a, b) => naturalCompare(a.name, b.name));
    }

    getNestNamePartNumber(): string {
        let string = "";
        for (const p of this.laser_cut_parts) {
            if (p.nest) {
                string += `${p.nest.name.replace(".pdf", "")} #${p.meta_data.part_number}<br>`;
            }
        }
        return string;
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

    getPartNumber(): string {
        return this.base_part.meta_data.part_number;
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

    getCoating(): string {
        return this.base_part.getCoating();
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

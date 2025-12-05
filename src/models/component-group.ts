import { ComponentGroupData } from "@interfaces/component-group";
import { naturalCompare } from "@utils/natural-sort";

import { Component } from "./component";

export class ComponentGroup {
    name: string;
    base_part: Component;
    components: Component[];

    constructor(data: ComponentGroupData) {
        this.name = data.name;
        this.base_part = new Component(data.base_part);

        this.components = data.components
            .map(p => new Component(p))
            .sort((a, b) => naturalCompare(a.part_name, b.part_name));
    }

    applyNaturalSort() {
        this.components.sort((a, b) => naturalCompare(a.part_name, b.part_name));
    }

    getPartNumber(): string {
        return this.base_part.part_number;
    }

    getTotalQuantity(): number {
        return this.components.reduce((total, part) => total + part.quantity, 0);
    }

    getTotalPrice(): number {
        return this.getQuantity() * this.getPrice();
    }

    getQuantity(): number {
        return this.base_part.quantity;
    }

    getPrice(): number {
        return this.base_part.price;
    }

    getNotes(): string {
        return this.base_part.notes;
    }

    getShelfNumber(): string {
        return this.base_part.shelf_number;
    }

    getImagePath(): string {
        return this.base_part.image_path;
    }
}

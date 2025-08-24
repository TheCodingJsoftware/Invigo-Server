import {LaserCutPartData} from "@interfaces/laser-cut-part";
import {Nest} from "@models/nest";

export class LaserCutPart {
    id: number;
    name: string;
    categories: string[];
    category_quantities: Record<string, number>;
    inventory_data: LaserCutPartData["inventory_data"];
    meta_data: LaserCutPartData["meta_data"];
    prices: LaserCutPartData["prices"];
    paint_data: LaserCutPartData["paint_data"];
    primer_data: LaserCutPartData["primer_data"];
    powder_data: LaserCutPartData["powder_data"];
    workspace_data: LaserCutPartData["workspace_data"];

    // Computed properties
    nest: Nest | null = null;

    constructor(data: LaserCutPartData) {
        this.id = data.id;
        this.name = data.name;
        this.categories = data.categories;
        this.category_quantities = data.category_quantities;
        this.inventory_data = data.inventory_data;
        this.meta_data = data.meta_data;
        this.prices = data.prices;
        this.paint_data = data.paint_data;
        this.primer_data = data.primer_data;
        this.powder_data = data.powder_data;
        this.workspace_data = data.workspace_data;
    }

    getCoating(): string {
        let html = "";
        if (this.primer_data.uses_primer) {
            html += `${this.primer_data.primer_name}`;
        }
        if (this.paint_data.uses_paint) {
            html += `${this.paint_data.paint_name}`;
        }
        if (this.powder_data.uses_powder) {
            html += `${this.powder_data.powder_name}`;
        }
        return html;
    }

    getTotalCoatingCost(): number {
        return (
            (this.primer_data.uses_primer ? this.prices.cost_for_primer : 0) +
            (this.paint_data.uses_paint ? this.prices.cost_for_paint : 0) +
            (this.powder_data.uses_powder ? this.prices.cost_for_powder_coating : 0)
        );
    }

    isBelowRedLimit(): boolean {
        return this.inventory_data.quantity < this.inventory_data.red_quantity_limit;
    }

    isBelowYellowLimit(): boolean {
        return this.inventory_data.quantity < this.inventory_data.yellow_quantity_limit;
    }

    hasAnyCoating(): boolean {
        return (
            this.primer_data.uses_primer ||
            this.paint_data.uses_paint ||
            this.powder_data.uses_powder
        );
    }

    toJSON(): LaserCutPartData {
        return {
            id: this.id,
            name: this.name,
            categories: this.categories,
            category_quantities: this.category_quantities,
            inventory_data: this.inventory_data,
            meta_data: this.meta_data,
            prices: this.prices,
            paint_data: this.paint_data,
            primer_data: this.primer_data,
            powder_data: this.powder_data,
            workspace_data: this.workspace_data,
        };
    }
}
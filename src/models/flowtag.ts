import { FlowtagData } from "@interfaces/flowtag";

export enum FlowtagGroup {
    ASSEMBLY = 0,
    LASER_CUT_PART = 1,
    COMPONENT = 2,
}

export class Flowtag {
    name: string;
    group: FlowtagGroup;
    add_quantity_tag: string | null;
    remove_quantity_tag: string | null;
    tags: string[];

    constructor(data: FlowtagData) {
        this.name = data.name;
        this.group = data.group;
        this.add_quantity_tag = data.add_quantity_tag;
        this.remove_quantity_tag = data.remove_quantity_tag;
        this.tags = data.tags;
    }

    isAssembly(): boolean {
        return this.group === FlowtagGroup.ASSEMBLY;
    }

    isLaserCutPart(): boolean {
        return this.group === FlowtagGroup.LASER_CUT_PART;
    }

    isComponent(): boolean {
        return this.group === FlowtagGroup.COMPONENT;
    }

    hasTag(tag: string): boolean {
        return this.tags.includes(tag);
    }

    toJSON(): FlowtagData {
        return {
            name: this.name,
            group: this.group,
            add_quantity_tag: this.add_quantity_tag,
            remove_quantity_tag: this.remove_quantity_tag,
            tags: [...this.tags],
        };
    }
}
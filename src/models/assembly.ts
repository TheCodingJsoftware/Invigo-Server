import { AssemblyData, AssemblyMetaData } from "@interfaces/assembly";
import { Component } from "@models/component";
import { Flowtag } from "@models/flowtag";
import { LaserCutPart } from "@models/laser-cut-part";
import { StructuralProfile } from "@models/structural-profile";
import { naturalCompare } from "@utils/natural-sort";

export class AssemblyMeta {
    id!: number;
    name!: string;
    color!: string;
    starting_date!: string;
    expected_time_to_complete!: number;
    ending_date!: string;
    assembly_image?: string;
    quantity!: number;
    not_part_of_process!: boolean;

    uses_primer!: boolean;
    primer_name?: string;
    primer_overspray!: number;
    cost_for_primer!: number;

    uses_paint!: boolean;
    paint_name?: string;
    paint_overspray!: number;
    cost_for_paint!: number;

    uses_powder_coating!: boolean;
    powder_name?: string;
    powder_transfer_efficiency!: number;
    cost_for_powder_coating!: number;

    assembly_files!: string[];

    flow_tag!: Flowtag;
    current_flow_tag_index!: number;
    current_flow_tag_status_index!: number;
    timer!: Record<string, unknown>;
    flow_tag_data!: Record<string, { expected_time_to_complete: number; }>;

    constructor(data: AssemblyMetaData) {
        Object.assign(this, data);
        this.flow_tag = new Flowtag(data.flow_tag);
    }

    getTotalCoatingCost(): number {
        return (
            (this.uses_primer ? this.cost_for_primer : 0) +
            (this.uses_paint ? this.cost_for_paint : 0) +
            (this.uses_powder_coating ? this.cost_for_powder_coating : 0)
        );
    }

    hasAnyCoating(): boolean {
        return this.uses_primer || this.uses_paint || this.uses_powder_coating;
    }

    toJSON(): AssemblyMetaData {
        return { ...this };
    }
}

export class Assembly {
    public assembly_data: AssemblyMeta;
    public laser_cut_parts: LaserCutPart[];
    public components: Component[];
    public structural_steel_components: StructuralProfile[];
    public sub_assemblies: Assembly[];

    constructor(data: AssemblyData) {
        this.assembly_data = new AssemblyMeta(data.assembly_data);

        // this.laser_cut_parts = [];
        // for (const laserCutPart of data.laser_cut_parts) {
        //     laserCutPart.quantity *= this.assembly_data.quantity;
        //     this.laser_cut_parts.push(new LaserCutPart(laserCutPart));
        // }
        // this.laser_cut_parts.sort((a, b) => naturalCompare(a.name, b.name));
        this.laser_cut_parts = data.laser_cut_parts
            .map(p => new LaserCutPart(p))
            .sort((a, b) => naturalCompare(a.name, b.name));

        // this.components = [];
        // for (const component of data.components) {
        //     component.quantity *= this.assembly_data.quantity;
        //     this.components.push(new Component(component));
        // }
        // this.components.sort((a, b) => naturalCompare(a.part_name, b.part_name));

        this.components = data.components
            .map(c => new Component(c))
            .sort((a, b) => naturalCompare(a.part_name, b.part_name));

        // this.structural_steel_components = [];
        // for (const structuralSteelComponent of data.structural_steel_components) {
        //     structuralSteelComponent.quantity *= this.assembly_data.quantity;
        //     this.structural_steel_components.push(new StructuralProfile(structuralSteelComponent));
        // }
        // this.structural_steel_components.sort((a, b) => naturalCompare(a.name, b.name));
        this.structural_steel_components = data.structural_steel_components
            .map(s => new StructuralProfile(s))
            .sort((a, b) => naturalCompare(a.name, b.name));

        this.sub_assemblies = [];
        for (const sub of data.sub_assemblies) {
            sub.assembly_data.quantity *= this.assembly_data.quantity;
            const subAssembly = new Assembly(sub);
            this.sub_assemblies.push(subAssembly);
        }
        this.sub_assemblies.sort((a, b) => naturalCompare(a.assembly_data.name, b.assembly_data.name));
        // Not updating the quantity of sub assemblies
        // this.sub_assemblies = data.sub_assemblies
        //     .map(sub => new Assembly(sub))
        //     .sort((a, b) => naturalCompare(a.assembly_data.name, b.assembly_data.name));
    }

    getAllAssemblies(): Assembly[] {
        let allAssemblies = this.sub_assemblies;
        for (const assembly of this.sub_assemblies) {
            allAssemblies = allAssemblies.concat(assembly.getAllAssemblies());
        }
        return allAssemblies;
    }

    getAllLaserCutParts(): LaserCutPart[] {
        let allParts = this.laser_cut_parts;
        for (const assembly of this.sub_assemblies) {
            allParts = allParts.concat(assembly.getAllLaserCutParts());
        }
        return allParts;
    }

    getAllComponents(): Component[] {
        let allParts = this.components;
        for (const assembly of this.sub_assemblies) {
            allParts = allParts.concat(assembly.getAllComponents());
        }
        return allParts;
    }

    generateProcessTagString(): string {
        return this.assembly_data.flow_tag.tags.join(" ➜ ");
    }

    getSafeIdName(): string {
        return `${this.assembly_data.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
    }

    toJSON(): AssemblyData {
        return {
            assembly_data: this.assembly_data.toJSON(),
            laser_cut_parts: this.laser_cut_parts,
            components: this.components,
            structural_steel_components: this.structural_steel_components,
            sub_assemblies: this.sub_assemblies.map(sa => sa.toJSON()),
        };
    }
}
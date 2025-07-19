import { AssemblyData, MetaData, PaintData, PowderData, PricesData, PrimerData, WorkspaceData } from "@interfaces/assembly";
import { Component } from "@models/component";
import { LaserCutPart } from "@models/laser-cut-part";
import { naturalCompare } from "@utils/natural-sort";


export class Assembly {
    public id: number;
    public name: string;

    public meta_data: MetaData;
    public prices: PricesData;
    public workspace_data: WorkspaceData;
    public primer_data: PrimerData;
    public paint_data: PaintData;
    public powder_data: PowderData;

    public laser_cut_parts: LaserCutPart[] = [];
    public components: Component[] = [];
    public sub_assemblies: Assembly[] = [];

    constructor(data: AssemblyData) {
        this.id = data.id;
        this.name = data.name;
        this.meta_data = data.meta_data;
        this.prices = data.prices;
        this.workspace_data = data.workspace_data;
        this.primer_data = data.primer_data;
        this.paint_data = data.paint_data;
        this.powder_data = data.powder_data;

        this.laser_cut_parts = data.laser_cut_parts
            .map(p => new LaserCutPart(p))
            .sort((a, b) => naturalCompare(a.name, b.name));

        this.components = data.components
            .map(c => new Component(c))
            .sort((a, b) => naturalCompare(a.part_name, b.part_name));

        this.sub_assemblies = [];
        for (const sub of data.sub_assemblies) {
            sub.meta_data.quantity *= this.meta_data.quantity;
            const subAssembly = new Assembly(sub);
            this.sub_assemblies.push(subAssembly);
        }
        this.sub_assemblies.sort((a, b) => naturalCompare(a.name, b.name));
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
        return this.workspace_data.flowtag.tags.join(" ➜ ");
    }

    getSafeIdName(): string {
        return `${this.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
    }

    toJSON(): AssemblyData {
        return {
            id: this.id,
            name: this.name,
            meta_data: this.meta_data,
            prices: this.prices,
            workspace_data: this.workspace_data,
            primer_data: this.primer_data,
            paint_data: this.paint_data,
            powder_data: this.powder_data,
            laser_cut_parts: this.laser_cut_parts.map(p => p.toJSON()),
            components: this.components.map(c => c.toJSON()),
            sub_assemblies: this.sub_assemblies.map(sa => sa.toJSON())
        };
    }
}

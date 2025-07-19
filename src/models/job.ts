import { JobData, JobMetaData, JobStatus } from "@interfaces/job";
import { Assembly } from "@models/assembly";
import { Nest } from "@models/nest";
import { naturalCompare } from "@utils/natural-sort";

import { Component } from "@models/component";
import { ComponentGroup } from "@models/component-group";
import { LaserCutPart } from "@models/laser-cut-part";
import { LaserCutPartGroup } from "@models/laser-cut-part-group";

export class JobMeta {
    id!: number;
    name!: string;
    type!: number;
    order_number!: number;
    PO_number!: number;
    ship_to!: string;
    starting_date!: string;
    ending_date!: string;
    color!: string;
    price_settings!: Record<string, any>;
    flowtag_timeline!: Record<string, any>;
    moved_job_to_workspace!: boolean;

    constructor(data: JobMetaData) {
        Object.assign(this, data);
    }

    getStatus(): JobStatus {
        return this.type;
    }

    getStatusLabel(): string {
        return JobStatus[this.type];
    }

    isArchived(): boolean {
        return this.type === JobStatus.ARCHIVE;
    }

    toJSON(): JobMetaData {
        return { ...this };
    }
}

export class Job {
    job_data: JobMeta;
    nests: Nest[];
    assemblies: Assembly[];

    constructor(data: JobData) {
        this.job_data = new JobMeta(data.job_data);
        this.nests = data.nests
            .map(n => new Nest(n))
            .sort((a, b) => naturalCompare(a.name, b.name));

        this.assemblies = data.assemblies
            .map(a => new Assembly(a))
            .sort((a, b) => naturalCompare(a.name, b.name));

        console.log(this);
    }

    getAllAssemblies(): Assembly[] {
        let allAssemblies = this.assemblies;
        for (const assembly of this.assemblies) {
            allAssemblies = allAssemblies.concat(assembly.getAllAssemblies());
        }
        return allAssemblies;
    }

    getComponentsCost(): number {
        let total = 0;
        for (const assembly of this.getAllAssemblies()) {
            for (const component of assembly.components) {
                total += component.price * component.quantity * assembly.meta_data.quantity;
            }
        }
        return total;
    }

    getLaserCutPartsCost(): number {
        let total = 0;
        for (const assembly of this.getAllAssemblies()) {
            for (const laserCutPart of assembly.laser_cut_parts) {
                total += laserCutPart.prices.price * laserCutPart.inventory_data.quantity * assembly.meta_data.quantity;
            }
        }
        return total;
    }

    getNetWeight(): number {
        let total = 0;
        for (const assembly of this.getAllAssemblies()) {
            for (const laserCutPart of assembly.laser_cut_parts) {
                total += laserCutPart.meta_data.weight * laserCutPart.inventory_data.quantity * assembly.meta_data.quantity;
            }
        }
        return total;
    }

    getAllNestedLaserCutParts(): LaserCutPart[] {
        let allParts: LaserCutPart[] = [];
        for (const nest of this.nests) {
            allParts = allParts.concat(nest.laser_cut_parts);
        }
        return allParts;
    }

    getAllAssemblyLaserCutParts(): LaserCutPart[] {
        let allParts: LaserCutPart[] = [];
        for (const assembly of this.assemblies) {
            allParts = allParts.concat(assembly.getAllLaserCutParts());
        }
        return allParts;
    }

    getAllAssemblyComponents(): Component[] {
        let allParts: Component[] = [];
        for (const assembly of this.assemblies) {
            allParts = allParts.concat(assembly.getAllComponents());
        }
        return allParts;
    }

    getAllGroupedAssemblyLaserCutParts(): LaserCutPartGroup[] {
        let groupedLaserCutParts: LaserCutPartGroup[] = [];
        let allParts: LaserCutPart[] = [];
        for (const assembly of this.getAllAssemblies()) {
            for (const laserCutPart of assembly.laser_cut_parts) {
                const part = new LaserCutPart(laserCutPart.toJSON());
                part.inventory_data.quantity *= assembly.meta_data.quantity;
                allParts.push(part);
            }
        }

        for (const part of allParts) {
            const group = groupedLaserCutParts.find(group => group.name === part.name);
            if (group) {
                group.laser_cut_parts.push(part);
            } else {
                groupedLaserCutParts.push(new LaserCutPartGroup({
                    name: part.name,
                    base_part: part,
                    laser_cut_parts: [part]
                }));
            }
        }
        return groupedLaserCutParts;
    }

    getAllGroupedAssemblyComponents(): ComponentGroup[] {
        let groupedComponenets: ComponentGroup[] = [];
        let allComponents: Component[] = [];
        for (const assembly of this.getAllAssemblies()) {
            for (const component of assembly.components) {
                const componenet = new Component(component.toJSON());
                componenet.quantity *= assembly.meta_data.quantity;
                allComponents.push(componenet);
            }
        }
        for (const component of allComponents) {
            const group = groupedComponenets.find(group => group.name === component.part_name);
            if (group) {
                group.components.push(component);
            } else {
                groupedComponenets.push(new ComponentGroup({
                    name: component.part_name,
                    base_part: component,
                    components: [component]
                }));
            }
        }
        return groupedComponenets;
    }

    toJSON(): JobData {
        return {
            job_data: this.job_data.toJSON(),
            nests: this.nests.map(n => n.toJSON()),
            assemblies: this.assemblies.map(a => a.toJSON()),
        };
    }

    getJobName(): string {
        return this.job_data.name;
    }

    isTemplate(): boolean {
        return this.job_data.getStatus() === JobStatus.TEMPLATE;
    }

    isWorkspace(): boolean {
        return this.job_data.getStatus() === JobStatus.WORKSPACE;
    }

    isArchived(): boolean {
        return this.job_data.isArchived();
    }
}
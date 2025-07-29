export enum PartViewMode {
    Global = "global",
    Job = "job",
    Assembly = "assembly",
}

export const PartViewConfig: Record<PartViewMode, {
    dbView: string;
    label: string;
    icon: string;
}> = {
    [PartViewMode.Assembly]: {
        dbView: "view_grouped_laser_cut_parts_by_assembly",
        label: "Assembly View",
        icon: "precision_manufacturing",
    },
    [PartViewMode.Job]: {
        dbView: "view_grouped_laser_cut_parts_by_job",
        label: "Job View",
        icon: "assignment",
    },
    [PartViewMode.Global]: {
        dbView: "view_grouped_laser_cut_parts_global",
        label: "Global View",
        icon: "public",
    },
};

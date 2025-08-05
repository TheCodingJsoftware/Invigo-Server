export enum PartViewMode {
    Global = "global",
    Job = "job",
}

export const PartViewConfig: Record<PartViewMode, {
    dbView: string;
    label: string;
    icon: string;
}> = {
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

export enum AssemblyViewMode {
    Global = "global",
    Job = "job",
}

export const AssemblyViewConfig: Record<AssemblyViewMode, {
    dbView: string;
    label: string;
    icon: string;
}> = {
    [AssemblyViewMode.Job]: {
        dbView: "view_grouped_laser_cut_parts_by_job",
        label: "Job View",
        icon: "assignment",
    },
    [AssemblyViewMode.Global]: {
        dbView: "view_grouped_laser_cut_parts_global",
        label: "Global View",
        icon: "public",
    },
};

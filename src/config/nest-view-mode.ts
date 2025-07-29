export enum NestViewMode {
    Global = "global",
    Job = "job",
    Nest = "nest",
}

export const NestViewConfig: Record<NestViewMode, {
    dbView: string;
    label: string;
    icon: string;
}> = {
    [NestViewMode.Nest]: {
        dbView: "view_nest_laser_cut_parts_by_nest",
        label: "Nest View",
        icon: "precision_manufacturing",
    },
    [NestViewMode.Job]: {
        dbView: "view_nest_laser_cut_parts_by_job",
        label: "Job View",
        icon: "assignment",
    },
    [NestViewMode.Global]: {
        dbView: "view_nest_laser_cut_parts_global",
        label: "Global View",
        icon: "public",
    },
};

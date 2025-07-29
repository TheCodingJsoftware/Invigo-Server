export enum JobViewMode {
    Global = "global",
}

export const JobViewConfig: Record<JobViewMode, {
    dbView: string;
    label: string;
    icon: string;
}> = {
    [JobViewMode.Global]: {
        dbView: "view_jobs",
        label: "Global View",
        icon: "public",
    },
};

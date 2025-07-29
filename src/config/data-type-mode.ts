export enum DataTypeSwitcherMode {
    Job = "job",
    Assembly = "assembly",
    Part = "part",
    Nest = "nest",
}

export const DataTypeSwitcherConfig: Record<DataTypeSwitcherMode, {
    label: string;
    icon: string;
}> = {
    [DataTypeSwitcherMode.Job]: {
        label: "Jobs",
        icon: "assignment",
    },
    [DataTypeSwitcherMode.Part]: {
        label: "Parts",
        icon: "layers",
    },
    [DataTypeSwitcherMode.Assembly]: {
        label: "Assemblies",
        icon: "inventory_2",
    },
    [DataTypeSwitcherMode.Nest]: {
        label: "Nests",
        icon: "window",
    },
};
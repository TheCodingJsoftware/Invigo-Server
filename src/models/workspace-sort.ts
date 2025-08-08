import { SettingsManager } from "@core/settings/settings";

interface WorkspaceSortDict {
    reverse: boolean;
    sortByName: boolean;
    sortByCurrentProcess: boolean;
    sortByQuantity: boolean;
    sortByMaterial: boolean;
    sortByThickness: boolean;
    sortByCreatedTime: boolean;
    sortByModifiedTime: boolean;
    sortByBendHits: boolean;
    sortBySurfaceArea: boolean;
    sortByWeight: boolean;
    sortBySize: boolean;
    sortByMachineTime: boolean;
}

export type BooleanSettingKey = {
    [K in keyof WorkspaceSortDict]: WorkspaceSortDict[K] extends boolean ? K : never
}[keyof WorkspaceSortDict];

export class WorkspaceSort {
    static readonly manager = new SettingsManager<WorkspaceSortDict>("WorkspaceSort", {
        reverse: false,
        sortByName: false,
        sortByCurrentProcess: false,
        sortByQuantity: false,
        sortByMaterial: false,
        sortByThickness: false,
        sortByCreatedTime: false,
        sortByModifiedTime: false,
        sortByBendHits: false,
        sortBySurfaceArea: false,
        sortByWeight: false,
        sortBySize: false,
        sortByMachineTime: false,
    });

    static getManager(): SettingsManager<WorkspaceSortDict> {
        return this.manager;
    }
}

(Object.keys(WorkspaceSort.manager.get()) as (keyof WorkspaceSortDict)[])
.forEach((key) => {
    Object.defineProperty(WorkspaceSort, key, {
        get() {
            return WorkspaceSort.manager.get()[key] ?? false;
        },
        set(value: boolean) {
            WorkspaceSort.manager.set({ [key]: value });
        },
        configurable: true,
        enumerable: true,
    });
});

import { SettingsManager } from "@core/settings/settings";

interface WorkspaceFilterDict {
    showCompleted: boolean;
    visibleProcesses: string[];
}

export type BooleanSettingKey = {
    [K in keyof WorkspaceFilterDict]: WorkspaceFilterDict[K] extends boolean ? K : never
}[keyof WorkspaceFilterDict];

export class WorkspaceFilter {
    private static readonly manager = new SettingsManager<WorkspaceFilterDict>("workspace_filter", {
        showCompleted: false,
        visibleProcesses: [],
    });

    static get showCompleted(): boolean {
        return this.manager.get().showCompleted ?? false;
    }

    static set showCompleted(value: boolean) {
        this.manager.set({ showCompleted: value });
    }

    static getManager(): SettingsManager<WorkspaceFilterDict> {
        return this.manager;
    }
}

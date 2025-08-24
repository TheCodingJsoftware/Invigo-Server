import {SettingsManager} from "@core/settings/settings";
import {WorkspaceSettings} from "@core/settings/workspace-settings";
import {UserContext} from "@core/auth/user-context";

export interface WorkspaceFilterDict {
    showCompleted: boolean;
    searchQuery: string;

    [key: `show_tag:${string}`]: boolean;
}

export type BooleanSettingKey = {
    [K in keyof WorkspaceFilterDict]: WorkspaceFilterDict[K] extends boolean ? K : never
}[keyof WorkspaceFilterDict];

export class WorkspaceFilter {
    private static readonly manager = new SettingsManager<WorkspaceFilterDict>(
        "WorkspaceFilter",
        {
            showCompleted: false,
            searchQuery: ""
        }
    );

    static get searchQuery(): string {
        return this.manager.get().searchQuery ?? "";
    }

    static set searchQuery(value: string) {
        this.manager.set({searchQuery: value} as any);
    }

    static async init(): Promise<void> {
        const user = Object.freeze(UserContext.getInstance().user);
        const allTags = Object.keys(WorkspaceSettings.tags);
        const viewableTags = allTags.filter(tag => user.canViewTag(tag));

        const keys: BooleanSettingKey[] = [
            "showCompleted",
            ...viewableTags.map(tag => `show_tag:${tag}` as BooleanSettingKey)
        ];

        const manager = WorkspaceFilter.manager;
        const current = manager.get();

        const seed: Partial<WorkspaceFilterDict> = {};
        for (const key of keys) {
            if (!(key in current)) seed[key] = false;
        }
        if (current.searchQuery === undefined) seed.searchQuery = "";
        if (Object.keys(seed).length) manager.set(seed);

        const freshly = manager.get();

        const pruned: Partial<WorkspaceFilterDict> = {searchQuery: freshly.searchQuery ?? ""};

        for (const key of keys) pruned[key] = freshly[key];

        localStorage.setItem("WorkspaceFilter", JSON.stringify(pruned));

        for (const key of keys) {
            Object.defineProperty(WorkspaceFilter, key, {
                get() {
                    return WorkspaceFilter.manager.get()[key] ?? false;
                },
                set(value: boolean) {
                    WorkspaceFilter.manager.set({[key]: value} as any);
                },
                configurable: true,
                enumerable: true,
            });
        }
    }

    static getManager(): SettingsManager<WorkspaceFilterDict> {
        return this.manager;
    }
}

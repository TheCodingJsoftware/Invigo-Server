import { SettingsManager } from "@core/settings/settings";
import { WorkspaceSettings } from "@core/settings/workspace-settings";
import { UserContext } from "@core/auth/user-context";

export interface WorkspaceFilterDict {
    showCompleted: boolean;
    [key: `show_tag:${string}`]: boolean;
}

export type BooleanSettingKey = keyof WorkspaceFilterDict;

export class WorkspaceFilter {
    private static readonly manager = new SettingsManager<WorkspaceFilterDict>(
        "WorkspaceFilter",
        { showCompleted: false }
    );

    static showCompleted: boolean;

    static async init(): Promise<void> {
        const user = Object.freeze(UserContext.getInstance().user);
        const allTags = Object.keys(WorkspaceSettings.tags);
        const viewableTags = allTags.filter(tag => user.canViewTag(tag));

        // 1) build the list of keys we want to keep
        const keys: BooleanSettingKey[] = [
            "showCompleted",
            ...viewableTags.map(tag => `show_tag:${tag}` as BooleanSettingKey)
        ];

        const manager = WorkspaceFilter.manager;
        const current = manager.get();

        // 2) seed any missing keys with `false`
        const seed: Partial<WorkspaceFilterDict> = {};
        for (const key of keys) {
            if (!(key in current)) {
                seed[key] = false;
            }
        }
        if (Object.keys(seed).length) {
            manager.set(seed);
        }

        // 3) prune out any keys no longer valid (roles/permissions changed)
        const freshly = manager.get();
        const pruned: Partial<WorkspaceFilterDict> = {};
        for (const key of keys) {
            pruned[key] = freshly[key];
        }
        // overwrite storage with only the pruned subset
        localStorage.setItem(
            "WorkspaceFilter",
            JSON.stringify(pruned)
        );

        // 4) define getters/setters on WorkspaceFilter for each key
        for (const key of keys) {
            Object.defineProperty(WorkspaceFilter, key, {
                get() {
                    return WorkspaceFilter.manager.get()[key] ?? false;
                },
                set(value: boolean) {
                    WorkspaceFilter.manager.set({ [key]: value } as any);
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

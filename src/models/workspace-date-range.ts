import { SettingsManager } from "@core/settings/settings";
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export interface WorkspaceDateRangeDict {
    disable: boolean;
    thisWeek: boolean;
    thisMonth: boolean;
    thisNextWeek: boolean;
    thisLastWeek: boolean;
    thisLastNextWeek: boolean;
    custom: boolean;
    custom_start: string | null; // ISO date
    custom_end: string | null;   // ISO date
}

export type BooleanSettingKey = {
    [K in keyof WorkspaceDateRangeDict]: WorkspaceDateRangeDict[K] extends boolean ? K : never
}[keyof WorkspaceDateRangeDict];

export class WorkspaceDateRange {
    static readonly manager = new SettingsManager<WorkspaceDateRangeDict>("WorkspaceDateRange", {
        disable: false,
        thisWeek: false,
        thisNextWeek: false,
        thisLastWeek: false,
        thisLastNextWeek: false,
        thisMonth: false,
        custom: false,
        custom_start: null,
        custom_end: null,
    });

    static getManager(): SettingsManager<WorkspaceDateRangeDict> {
        return this.manager;
    }


    static getActiveRange(): { start: Date; end: Date } | null {
        const state = this.manager.get();
        if (state.disable) return null;

        const today = new Date();

        if (state.thisWeek) {
            return {
                start: startOfWeek(today, { weekStartsOn: 1 }), // Monday
                end: endOfWeek(today, { weekStartsOn: 1 }),
            };
        }

        if (state.thisNextWeek) {
            const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
            return {
                start: nextWeekStart,
                end: addDays(nextWeekStart, 6),
            };
        }

        if (state.thisLastWeek) {
            const lastWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), -7);
            return {
                start: lastWeekStart,
                end: addDays(lastWeekStart, 6),
            };
        }

        if (state.thisLastNextWeek) {
            const start = addDays(startOfWeek(today, { weekStartsOn: 1 }), -7);
            const end = addDays(start, 13); // last week + this week
            return { start, end };
        }

        if (state.thisMonth) {
            return {
                start: startOfMonth(today),
                end: endOfMonth(today),
            };
        }

        if (state.custom && state.custom_start && state.custom_end) {
            return {
                start: new Date(state.custom_start),
                end: new Date(state.custom_end),
            };
        }

        return null;
    }
}

(Object.keys(WorkspaceDateRange.manager.get()) as (keyof WorkspaceDateRangeDict)[])
.forEach((key) => {
    Object.defineProperty(WorkspaceDateRange, key, {
        get() {
            return WorkspaceDateRange.manager.get()[key] ?? false;
        },
        set(value: boolean) {
            WorkspaceDateRange.manager.set({ [key]: value });
        },
        configurable: true,
        enumerable: true,
    });
});

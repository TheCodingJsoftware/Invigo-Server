import { SessionSettingsManager } from "@core/settings/session-settings";
import { DataTypeSwitcherMode } from "@config/data-type-mode";

export type ViewChangePayload = {
    dataType: DataTypeSwitcherMode;
};

export class ViewBus {
    private static listeners: Set<(view: ViewChangePayload) => void> = new Set();
    private static state: ViewChangePayload = {
        dataType: SessionSettingsManager.get().lastActiveDataType,
    };

    static subscribe(cb: (view: ViewChangePayload) => void) {
        this.listeners.add(cb);
        cb(this.state);
    }

    static update(partial: Partial<ViewChangePayload>) {
        this.state = { ...this.state, ...partial };
        for (const cb of this.listeners) cb(this.state);
    }

    static getState() {
        return this.state;
    }
}

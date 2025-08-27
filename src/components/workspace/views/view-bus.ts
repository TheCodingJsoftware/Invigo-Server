import {SessionSettingsManager} from "@core/settings/session-settings";
import {DataTypeSwitcherMode} from "@config/data-type-mode";
import {AssemblyViewMode} from "@config/assembly-view-mode";
import {PartViewMode} from "@config/part-view-mode";
import {NestViewMode} from "@config/nest-view-mode";
import {JobViewMode} from "@config/job-view-mode";

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
        this.state = {...this.state, ...partial};

        // const next = { ...this.state, ...partial };
        // if (next.dataType === this.state.dataType && next.viewMode === this.state.viewMode) {
        //     return;
        // }
        // this.state = next;
        for (const cb of this.listeners) cb(this.state);
    }

    static getState() {
        return this.state;
    }
}

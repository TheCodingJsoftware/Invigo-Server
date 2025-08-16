import { SettingsManager } from "@core/settings/settings";
import { DataTypeSwitcherMode } from "@config/data-type-mode";
import { AssemblyViewMode } from "@config/assembly-view-mode";
import { PartViewMode } from "@config/part-view-mode";
import { NestViewMode } from "@config/nest-view-mode";
import { JobViewMode } from "@config/job-view-mode";

interface ViewSettings {
    lastActiveDataType: DataTypeSwitcherMode;
    lastActivePartView: PartViewMode;
    lastActiveAssemblyView: AssemblyViewMode;
    lastActiveNestView: NestViewMode;
    lastActiveJobView: JobViewMode;
}

const defaultViewSettings: ViewSettings = {
    lastActiveDataType: DataTypeSwitcherMode.Part,
    lastActivePartView: PartViewMode.Global,
    lastActiveAssemblyView: AssemblyViewMode.Global,
    lastActiveNestView: NestViewMode.Global,
    lastActiveJobView: JobViewMode.Global,
};

export const ViewSettingsManager = new SettingsManager<ViewSettings>(
    "view_settings",
    defaultViewSettings
);
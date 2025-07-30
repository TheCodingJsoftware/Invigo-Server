import { SettingsManager } from "./settings";
import { DataTypeSwitcherMode } from "@config/data-type-mode";
import { AssemblyViewMode } from "@config/assembly-view-mode";
import { PartViewMode } from "@config/part-view-mode";
import { NestViewMode } from "@config/nest-view-mode";
import { JobViewMode } from "@config/job-view-mode";

interface SessionSettings {
    lastActiveDataType: DataTypeSwitcherMode;
    lastActiveView: AssemblyViewMode | PartViewMode | NestViewMode | JobViewMode;
}

const defaultSessionSettings: SessionSettings = {
    lastActiveDataType: DataTypeSwitcherMode.Part,
    lastActiveView: AssemblyViewMode.Global,
};

export const SessionSettingsManager = new SettingsManager<SessionSettings>(
    "session_settings",
    defaultSessionSettings
);
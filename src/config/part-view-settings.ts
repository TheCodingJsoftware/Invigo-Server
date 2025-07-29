import { SettingsManager } from "@utils/settings";
import { PartViewMode } from "@config/part-view-mode";

interface PartViewSettings {
    viewMode: PartViewMode;
}

const defaultPartSettings: PartViewSettings = {
    viewMode: PartViewMode.Global,
};

export const PartViewSettingsManager = new SettingsManager<PartViewSettings>(
    "part_settings",
    defaultPartSettings
);
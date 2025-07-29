import { SettingsManager } from "@utils/settings";
import { AssemblyViewMode } from "@config/assembly-view-mode";

interface AssemblyViewSettings {
    viewMode: AssemblyViewMode;
}

const defaultAssemblyViewSettings: AssemblyViewSettings = {
    viewMode: AssemblyViewMode.Global,
};

export const AssemblyViewSettingsManager = new SettingsManager<AssemblyViewSettings>(
    "assembly_view_settings",
    defaultAssemblyViewSettings
);


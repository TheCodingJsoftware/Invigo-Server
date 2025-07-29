import { SettingsManager } from "@utils/settings";
import { NestViewMode } from "@config/nest-view-mode";

interface NestViewSettings {
    viewMode: NestViewMode;
}

const defaultNestSettings: NestViewSettings = {
    viewMode: NestViewMode.Global,
};

export const NestViewSettingsManager = new SettingsManager<NestViewSettings>(
    "nest_settings",
    defaultNestSettings
);
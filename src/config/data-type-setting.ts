import { SettingsManager } from "@utils/settings";
import { DataTypeSwitcherMode } from "@config/data-type-mode";

interface DataTypeSettings {
    viewMode: DataTypeSwitcherMode;
}

const defaultDataTypeSettings: DataTypeSettings = {
    viewMode: DataTypeSwitcherMode.Part,
};

export const DataTypeSettingsManager = new SettingsManager<DataTypeSettings>(
    "data_type_settings",
    defaultDataTypeSettings
);
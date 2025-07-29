import { SettingsManager } from "@utils/settings";
import { JobViewMode } from "@config/job-view-mode";

interface JobViewSettings {
    viewMode: JobViewMode;
}

const defaultJobSettings: JobViewSettings = {
    viewMode: JobViewMode.Global,
};

export const JobViewSettingsManager = new SettingsManager<JobViewSettings>(
    "job_settings",
    defaultJobSettings
);
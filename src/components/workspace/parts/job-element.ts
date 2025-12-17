import { SettingsManager } from "@core/settings/settings";
import { JobData } from "@interfaces/job";
import { WorkspaceDateRange } from "@models/workspace-date-range";
import { PartsTable } from "@components/workspace/parts/parts-table";
import { applyScopedBeerTheme } from "@config/material-theme-cookie";
import { AreYouSureDialog } from "@components/common/dialog/are-you-sure-dialog";
import { PartRow } from "@components/workspace/parts/part-row";
import { SnackbarComponent } from "@components/common/snackbar/snackbar-component";
import { FileViewerDialog } from "@components/common/dialog/file-viewer-dialog";
import { PartData } from "@components/workspace/parts/part-container";
import morphdom from "morphdom"

interface JobSettings {
    isCollapsed: boolean;
}

export class JobElement {
    readonly element: HTMLElement;
    readonly articleContent: HTMLDivElement;
    jobId: number;
    jobName?: string;
    parts: PartData[];
    jobSettings: SettingsManager<JobSettings>;
    private jobDataStore: SettingsManager<{ data?: JobData; ts?: number }>;

    constructor(jobId: number, parts: PartData[]) {
        this.jobId = jobId;
        this.parts = parts;

        this.jobSettings = new SettingsManager(`JobSettings:${this.jobId}`, { isCollapsed: false });
        this.jobDataStore = new SettingsManager<{ data?: JobData; ts?: number }>(`JobData:${this.jobId}`, {});

        this.element = document.createElement("article");
        this.element.classList.add("round", "border");
        this.element.setAttribute("data-job-id", this.jobId.toString());
        // this.element.style.contentVisibility = "auto";
        // this.element.style.containIntrinsicSize = "100%";

        this.articleContent = document.createElement("div");
    }

    async initialize() {
        const t0 = performance.now();
        this.element.appendChild(this.createArticleHeader());
        this.element.appendChild(this.articleContent);
        const jd0 = performance.now();
        const jobData = await this.getJobDataCached();
        const jdMs = performance.now() - jd0;
        const flowtagTimeline = jobData.job_data.flowtag_timeline;
        const activeRange = WorkspaceDateRange.getActiveRange();
        const f0 = performance.now();
        const filteredParts = this.parts.filter(part => {
            const isCompleted = part.is_completed;
            if (isCompleted) return true;
            const flowtag = part.current_flowtag;
            if (!flowtag) return false;
            const timelineEntry = flowtagTimeline[flowtag];
            if (!timelineEntry) return false;
            const start = timelineEntry.starting_date ? new Date(timelineEntry.starting_date) : null;
            const end = timelineEntry.ending_date ? new Date(timelineEntry.ending_date) : null;
            if (!start || !end) return false;
            const now = new Date();
            const isOverdue = end < now;
            part.is_overdue = isOverdue;
            part.part_timeline = timelineEntry;
            if (isOverdue) return true;
            if (activeRange) {
                const overlaps = start <= activeRange.end && end >= activeRange.start;
                return overlaps;
            }
            return true;
        });
        const fMs = performance.now() - f0;
        this.parts = filteredParts;
        if (this.parts.length === 0) {
            console.log(JSON.stringify({
                handler: "JobElement.initialize",
                jobId: this.jobId,
                partsAfterFilter: 0,
                total_ms: +(performance.now() - t0).toFixed(3),
                jobData_ms: +jdMs.toFixed(3),
                filter_ms: +fMs.toFixed(3)
            }));
            return;
        }
        const tbl0 = performance.now();
        const partsTable = new PartsTable();
        await partsTable.loadData(this.parts);
        // this.articleContent.appendChild(partsTable.table);
        const newTable = partsTable.table;              // the fresh table to show
        const oldTable = this.articleContent.querySelector<HTMLTableElement>("table.parts-table");

        if (oldTable) {
            // Diff & patch existing table in place
            morphdom(oldTable, newTable, { childrenOnly: false });
        } else {
            // First mount
            this.articleContent.appendChild(newTable);
        }

        const tblMs = performance.now() - tbl0;
        if (this.jobSettings.get().isCollapsed) {
            this.collapseArticleContent();
        }
        console.log(JSON.stringify({
            handler: "JobElement.initialize",
            jobId: this.jobId,
            partsAfterFilter: this.parts.length,
            jobData_ms: +jdMs.toFixed(3),
            filter_ms: +fMs.toFixed(3),
            table_ms: +tblMs.toFixed(3),
            total_ms: +(performance.now() - t0).toFixed(3)
        }));
    }


    // Stale-while-revalidate: use cache, refresh in background
    async getJobDataCached(): Promise<JobData> {
        const cached = this.jobDataStore.get();
        const ttlMs = 60 * 60 * 1000;
        if (cached.data && cached.ts && Date.now() - cached.ts < ttlMs) {
            this.refreshJobData();
            return cached.data;
        } else {
            return this.refreshJobData();
        }
    }


    // Fetch fresh data, update cache, and update UI
    async refreshJobData(): Promise<JobData> {
        try {
            const response = await fetch(`/api/workspace/get/job/${this.jobId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch job data: ${response.statusText}`);
            }

            const data: JobData = await response.json();

            this.jobDataStore.set({ data, ts: Date.now() });

            this.applyJobDataToUI(data);

            return data;
        } catch (err) {
            const fallback = this.jobDataStore.get().data as JobData | undefined;
            if (fallback) return fallback;
            throw err;
        }
    }


    // Update UI based on job data
    async applyJobDataToUI(data: JobData) {
        const title = this.element.querySelector(`#job-${this.jobId}`) as HTMLElement;
        if (title) {
            this.jobName = data.job_data.name;
            title.textContent = data.job_data.name;
            await applyScopedBeerTheme(this.element, data.job_data.color, `job-${this.jobId}`);
        }
    }

    private showEmptyMessage(message: string): void {
        const empty = document.createElement("p");
        empty.className = "center-align";
        empty.textContent = message;

        this.element.replaceChildren(empty);
    }

    private createArticleHeader(): HTMLElement {
        const header = document.createElement("div");
        header.classList.add("row");

        const title = document.createElement("h5");
        title.id = `job-${this.jobId}`;
        title.classList.add("max");

        const split = document.createElement("nav");
        split.className = "group split small";

        const markCompleteButton = document.createElement("button");
        markCompleteButton.classList.add("left-round", "square", "small");
        markCompleteButton.innerHTML = `
            <i>done_all</i>
            <div class="tooltip">
                <span>Mark Complete</span>
            </div>
        `.trim();
        markCompleteButton.onclick = async () => {
            const dialog = new AreYouSureDialog(
                "Are you sure?",
                "Are you sure you want to mark all parts in this job as complete?"
            );

            const confirmed = await dialog.show();
            if (!confirmed) return; // user pressed No or Cancel

            for (const part of this.parts) {
                PartRow.incrementFlowtagIndex(part);
            }

            new SnackbarComponent({
                message: "All parts marked complete!",
                type: "green",
                icon: "done_all"
            });
        }

        // Open all files
        const openFilesButton = document.createElement("button");
        openFilesButton.classList.add("no-round", "square", "small");
        openFilesButton.innerHTML = `
            <i>preview</i>
            <div class="tooltip">
                <span>Open Files</span>
            </div>
        `.trim();
        openFilesButton.onclick = () => {
            new FileViewerDialog(this.jobName, this.parts)
        }

        // Add collapse/expand button
        const toggleButton = document.createElement("button");
        toggleButton.classList.add("right-round", "square", "small", "toggle-button");
        toggleButton.innerHTML = "<i>expand_less</i><div class='tooltip'>Expand/Collapse</div>";
        toggleButton.onclick = () => this.collapseArticleContent();

        split.appendChild(markCompleteButton);
        split.appendChild(openFilesButton);
        split.appendChild(toggleButton);

        header.appendChild(title);
        header.appendChild(split);

        return header;
    }

    private collapseArticleContent(collapse?: boolean) {
        const toggleButton = this.element.querySelector(".toggle-button") as HTMLButtonElement;
        const toggleButtonIcon = toggleButton.querySelector('i') as HTMLElement;
        this.articleContent.classList.toggle('hidden');
        const isCollapsed = this.articleContent.classList.contains('hidden')
        toggleButtonIcon.classList.toggle("rotate-180", isCollapsed);
        toggleButtonIcon.classList.toggle("rotate-0", !isCollapsed);

        this.jobSettings.set({ "isCollapsed": isCollapsed })
    }
}

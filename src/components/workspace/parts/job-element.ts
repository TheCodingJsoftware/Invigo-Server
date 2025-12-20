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
import morphdom from "morphdom";

interface JobSettings {
    isCollapsed: boolean;
}


export async function fetchJobData(jobId: number): Promise<JobData> {
    const response = await fetch(`/api/workspace/get/job/${jobId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch job data: ${response.statusText}`);
    }

    const data: JobData = await response.json();
    return data;
}


export class JobElement {
    readonly element: HTMLElement;
    readonly articleContent: HTMLDivElement;
    readonly jobId: number;
    jobName?: string;
    jobData!: JobData;
    parts: PartData[];
    jobSettings: SettingsManager<JobSettings>;

    constructor(jobId: number, parts: PartData[]) {
        this.jobId = jobId;
        this.parts = parts;

        this.jobSettings = new SettingsManager(`JobSettings:${this.jobId}`, {
            isCollapsed: false
        });

        this.element = document.createElement("article");
        this.element.classList.add("round", "border");
        this.element.setAttribute("data-job-id", String(this.jobId));

        this.articleContent = document.createElement("div");
    }

    async initialize(): Promise<void> {
        const t0 = performance.now();

        this.element.appendChild(this.createArticleHeader());
        this.element.appendChild(this.articleContent);

        const jd0 = performance.now();
        this.jobData = await fetchJobData(this.jobId);
        await this.applyJobDataToUI(this.jobData);
        const jdMs = performance.now() - jd0;

        const flowtagTimeline = this.jobData.job_data.flowtag_timeline;
        const activeRange = WorkspaceDateRange.getActiveRange();

        const f0 = performance.now();
        const filteredParts = this.parts.filter(part => {
            if (part.is_completed) return true;

            const flowtag = part.current_flowtag;
            if (!flowtag) return false;

            const timelineEntry = flowtagTimeline[flowtag];
            if (!timelineEntry) return false;

            const start = timelineEntry.starting_date
                ? new Date(timelineEntry.starting_date)
                : null;

            const end = timelineEntry.ending_date
                ? new Date(timelineEntry.ending_date)
                : null;

            if (!start || !end) return false;

            const now = new Date();
            const isOverdue = end < now;

            part.is_overdue = isOverdue;
            part.job_data = this.jobData;
            part.part_timeline = timelineEntry;

            if (isOverdue) return true;

            if (activeRange) {
                return start <= activeRange.end && end >= activeRange.start;
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
                jobData_ms: +jdMs.toFixed(3),
                filter_ms: +fMs.toFixed(3),
                total_ms: +(performance.now() - t0).toFixed(3)
            }));
            return;
        }

        const tbl0 = performance.now();
        const partsTable = new PartsTable();
        await partsTable.loadData(this.parts);

        const newTable = partsTable.table;
        const oldTable =
            this.articleContent.querySelector<HTMLTableElement>("table.parts-table");

        if (oldTable) {
            morphdom(oldTable, newTable, { childrenOnly: false });
        } else {
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

    private async applyJobDataToUI(data: JobData): Promise<void> {
        const title = this.element.querySelector<HTMLElement>(`#job-${this.jobId}`);
        if (!title) return;

        this.jobName = data.job_data.name;
        title.textContent = data.job_data.name;

        await applyScopedBeerTheme(
            this.element,
            data.job_data.color,
            `job-${this.jobId}`
        );
    }

    private createArticleHeader(): HTMLElement {
        const header = document.createElement("div");
        header.classList.add("row");

        header.ondblclick = () => this.collapseArticleContent();

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

            applyScopedBeerTheme(
                dialog.element,
                this.jobData.job_data.color,
                `are-you-sure-dialog-job-${this.jobId}`
            );

            if (!(await dialog.show())) return;

            for (const part of this.parts) {
                PartRow.incrementFlowtagIndex(part);
            }

            new SnackbarComponent({
                message: "All parts marked complete!",
                type: "green",
                icon: "done_all"
            });
        };

        const openFilesButton = document.createElement("button");
        openFilesButton.classList.add("no-round", "square", "small");
        openFilesButton.innerHTML = `
            <i>preview</i>
            <div class="tooltip">
                <span>Open Files</span>
            </div>
        `.trim();

        openFilesButton.onclick = () => {
            const dialog = new FileViewerDialog(this.jobName, this.parts);
            applyScopedBeerTheme(
                dialog.element,
                this.jobData.job_data.color,
                `file-viewer-dialog-job-${this.jobId}`
            );
        };

        const toggleButton = document.createElement("button");
        toggleButton.classList.add("right-round", "square", "small", "toggle-button");
        toggleButton.innerHTML =
            "<i>expand_less</i><div class='tooltip'>Expand/Collapse</div>";

        toggleButton.onclick = () => this.collapseArticleContent();

        split.appendChild(markCompleteButton);
        split.appendChild(openFilesButton);
        split.appendChild(toggleButton);

        header.appendChild(title);
        header.appendChild(split);

        return header;
    }

    private collapseArticleContent(): void {
        const toggleButton =
            this.element.querySelector<HTMLButtonElement>(".toggle-button");
        if (!toggleButton) return;

        const icon = toggleButton.querySelector("i");
        if (!icon) return;

        this.articleContent.classList.toggle("hidden");
        const isCollapsed = this.articleContent.classList.contains("hidden");

        icon.classList.toggle("rotate-180", isCollapsed);
        icon.classList.toggle("rotate-0", !isCollapsed);

        this.jobSettings.set({ isCollapsed });
    }
}

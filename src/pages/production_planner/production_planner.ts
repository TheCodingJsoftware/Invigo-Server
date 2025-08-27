import "beercss";
import "@utils/theme";
import {Timeline, TimelineOptions} from "vis-timeline/esnext";
import {DataSet} from "vis-data";
import {DataGroup, DataItem} from "vis-timeline/declarations";
import "@static/css/vis-timeline-graph2d.min.css";
import {SnackbarComponent} from "@components/common/snackbar/snackbar-component";
import {loadTheme} from "@utils/theme";

export interface ContactInfo {
    name: string;
    email: string;
    phone: string;
    password: string;
}

export interface BusinessInfo {
    name: string;
    email: string;
    phone: string;
    address: string;
    gst_rate: number;
    pst_rate: number;
    gst_number: string;
    pst_number: string;
    business_number: string;
}

export interface PriceSettings {
    item_overhead: number;
    mil_thickness: number;
    cost_for_laser: number;
    sheet_overhead: number;
    item_profit_margin: number;
    sheet_profit_margin: number;
    components_use_overhead: boolean;
    match_item_cogs_to_sheet: boolean;
    components_use_profit_margin: boolean;
}

export interface TimelineEntry {
    ending_date: string;
    starting_date: string;
}

export interface FlowtagTimeline {
    [tagName: string]: TimelineEntry;
}

export interface JobItems {
    id: number;
    name: string;
    job_data: {
        color: string;
        ship_to: string;
        PO_number: number;
        ending_date: string;
        contact_info: ContactInfo;
        order_number: number;
        business_info: BusinessInfo;
        starting_date: string;
        price_settings: PriceSettings;
        flowtag_timeline: FlowtagTimeline;
        moved_job_to_workspace: boolean;
    }
    type: number;
}

function getOnColor(hex: string) {
    let mode = ui("mode");
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Relative luminance (0 = dark, 1 = light)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Auto detect mode if needed
    if (mode === "auto") {
        mode = luminance > 0.5 ? "light" : "dark";
    }

    // Material 3 style onPrimary selection
    // Light mode: background light → use dark foreground
    // Dark mode: background dark → use light foreground
    if (mode === "light") {
        return luminance < 0.45 ? "#FFFFFF" : "#000000"; // tweak threshold for better M3 feel
    } else {
        return luminance > 0.6 ? "#000000" : "#FFFFFF";
    }
}

type WorkspaceFlowtagTimeline = Record<
    string,
    { starting_date: string; ending_date: string }
>;

type JobTimelinePayload = {
    id: number;
    flowtag_timeline: WorkspaceFlowtagTimeline;
};

const changedJobIds = new Set<number>();

function toISOStringSafe(date: string | Date | number | null | undefined): string {
    if (!date) return "";
    return (date instanceof Date ? date : new Date(date)).toISOString();
}

function buildJobProcessTimelines(items: DataItem[]): JobTimelinePayload[] {
    const jobs: Record<number, JobTimelinePayload> = {};

    for (const {group, content, start, end} of items) {
        console.log(items)
        const jobId = typeof group === "string" ? parseInt(group, 10) : group;
        if (!jobId) continue;

        if (!jobs[jobId]) {
            jobs[jobId] = {
                id: jobId,
                flowtag_timeline: {},
            };
        }

        jobs[jobId].flowtag_timeline[String(content)] = {
            starting_date: toISOStringSafe(start),
            ending_date: toISOStringSafe(end),
        };
    }

    return Object.values(jobs);
}

function getTimelineHeight(): number {
    const header = document.querySelector("header");
    const headerHeight = header ? header.offsetHeight : 0;
    const padding = 20;
    return window.innerHeight - headerHeight - padding;
}

class JobTimeline {
    private readonly container: HTMLElement;
    private readonly timeline: Timeline | null = null;
    private readonly items: DataSet<DataItem>;
    private readonly groups: DataSet<DataGroup>;

    constructor(container: HTMLElement, options: TimelineOptions = {}) {
        this.container = container;

        this.items = new DataSet<DataItem>([]);
        this.groups = new DataSet<DataGroup>([]);

        function customOrder(a: any, b: any) {
            return a.id - b.id;
        }

        const defaultOptions: TimelineOptions = {
            editable: true,
            order: customOrder,
            stack: true,
            maxHeight: getTimelineHeight(),
            showTooltips: true,
            multiselect: true,
            zoomable: true,
            verticalScroll: true,
            horizontalScroll: true,
            zoomKey: "ctrlKey",
            showCurrentTime: true,
            orientation: {
                axis: "top",
                item: "top",
            },
            groupOrder: (a: DataGroup, b: DataGroup) => (a.id as number) - (b.id as number), // group order by job id
            tooltipOnItemUpdateTime: {
                template: (item: any) => {
                    const start = item.start
                        ? new Date(item.start).toLocaleString()
                        : "N/A";
                    const end = item.end ? new Date(item.end).toLocaleString() : "N/A";
                    return `<div>
                    <b>${item.content}</b><br/>
                    Start: ${start}<br/>
                    End: ${end}
                  </div>`;
                },
            },
            onMoving: (item, callback) => {
                // If user tries to drag into another group, block it
                changedJobIds.add(item.group as number)
                if (item.group !== this.items.get(item.id)?.group) {
                    item.group = this.items.get(item.id)?.group; // reset to original
                }
                callback(item); // always call callback
            },
            onMove: (item, callback) => {
                if (item.group !== this.items.get(item.id)?.group) {
                    item.group = this.items.get(item.id)?.group;
                }

                this.items.update(item as any);

                changedJobIds.add(item.group as number);

                callback(item);
            }
        };

        const mergedOptions = {...defaultOptions, ...options};

        this.timeline = new Timeline(this.container, [], mergedOptions);
        this.timeline.setOptions(mergedOptions);
        this.timeline.setGroups(this.groups);
        this.timeline.setItems(this.items);
        this.timeline.on("click", (event: any) => {
            // DataSet change events: add/update/remove
            if (event && event.items) {
                event.items.forEach((itemId: string | number) => {
                    const item = this.items.get(itemId);
                    if (!item) return;
                    this.onItemChange(item);
                });
            }
        });

        window.addEventListener("resize", () => {
            if (this.timeline) {
                this.timeline.setOptions({maxHeight: getTimelineHeight()});
            }
        });
    }

    onItemChange(item: DataItem) {
        const jobId = typeof item.group === "string" ? parseInt(item.group, 10) : item.group;
        if (jobId) {
            changedJobIds.add(jobId);
        }
    }

    public loadJobs(jobs: JobItems[]) {
        this.items.clear();
        this.groups.clear();

        jobs.forEach((job) => {
            const jobGroupId = job.id;

            // Add top-level job group
            this.groups.add({
                id: `J${jobGroupId}`,
                content: job.name,
                nestedGroups: [jobGroupId], // one nested groups
            });

            const processesGroupId = jobGroupId;
            this.groups.add({
                id: processesGroupId,
                content: "",
            })

            const colorClass = `job-color-${jobGroupId}`;

            // Add process timeline
            Object.entries(job.job_data.flowtag_timeline || {}).forEach(([flowName, range], idx) => {
                this.items.add({
                    id: `process-${jobGroupId}-${idx}`,
                    group: processesGroupId,
                    content: flowName,
                    start: new Date(range.starting_date).toISOString(),
                    end: new Date(range.ending_date).toISOString(),
                    title: job.job_data.ship_to,
                    className: colorClass,
                });
            });

            // Add dynamic CSS for job color
            if (!document.getElementById(`job-color-style-${jobGroupId}`)) {
                const style = document.createElement("style");
                style.id = `job-color-style-${jobGroupId}`;
                const bgColor = job.job_data.color;
                const textColor = getOnColor(bgColor);

                style.innerHTML = `
                    .vis-item.${colorClass} {
                        background-color: ${bgColor};
                        border-color: ${bgColor};
                        color: ${textColor};
                        border-radius: 0.625rem;
                        border: .0625rem solid var(--outline-variant);
                    }
                    .vis-item.vis-selected.${colorClass} {
                        background-color: ${bgColor};
                        color: ${textColor};
                        border-radius: 0.625rem;
                        outline: .125rem solid var(--primary);
                        outline-offset: 0.25rem;
                    }
                    .vis-item.vis-item-overflow.vis-item-content.${colorClass} {
                        background-color: red !important;
                        color: ${textColor};
                    }
                `;
                document.head.appendChild(style);
            }
        });

        // Set the items and groups to the timeline
        if (this.timeline) {
            this.timeline.setGroups(this.groups);
            this.timeline.setItems(this.items.get());
        }
    }


    public getItems(): DataItem[] {
        return this.items.get();
    }
}

async function loadJobItemsTimeline() {
    const jobItemsTimelineSaveButton = document.getElementById("save-button") as HTMLButtonElement;

    const container = document.getElementById("job-timeline");
    if (!container) {
        throw new Error("Missing #job-items-timeline in DOM");
    }

    try {
        const res = await fetch("/api/production_planner/job/timeline");
        if (!res.ok) throw new Error("Failed to fetch jobs");
        const data = await res.json();

        const jobs: JobItems[] = Object.values(data);

        const jobTimeline = new JobTimeline(container);
        jobTimeline.loadJobs(jobs);

        jobItemsTimelineSaveButton.addEventListener("click", async () => {
            const items = jobTimeline.getItems();
            const payload = buildJobProcessTimelines(items);

            // Filter only changed jobs
            const filteredPayload = payload.filter(job => changedJobIds.has(job.id));

            console.log(filteredPayload);

            try {
                const response = await fetch("/api/production_planner/job/timeline", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(filteredPayload),
                });

                if (!response.ok) {
                    const text = await response.text();
                    new SnackbarComponent({
                        id: "error",
                        type: "error",
                        message: `Failed to save timeline: ${response.status} ${text}`,
                        icon: "error",
                        duration: 1000,
                    })
                    throw new Error(`Failed to save timeline: ${response.status} ${text}`);
                }

                const result = await response.json();
                new SnackbarComponent({
                    id: "success",
                    type: "green",
                    message: "Timeline saved successfully",
                    icon: "save",
                    duration: 1000,
                })
                changedJobIds.clear();
            } catch (err) {
                new SnackbarComponent({
                    id: "error",
                    type: "error",
                    message: `Error posting timeline: ${err}`,
                    icon: "error",
                    duration: 1000,
                })
                console.error("Error posting timeline:", err);
            }
        });

    } catch (err) {
        console.error("Failed to load jobs:", err);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    loadTheme("dark");
    // Promise.all([loadJobProcessTimeline(), loadJobItemsTimeline()]);
    await loadJobItemsTimeline()
});

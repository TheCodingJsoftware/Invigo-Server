import "beercss";
import "@utils/theme";
import { Timeline, TimelineOptions } from "vis-timeline/esnext";
import { DataSet } from "vis-data";
import { DataGroup, DataItem } from "vis-timeline/declarations";
import "@static/css/vis-timeline-graph2d.min.css";
import { SnackbarComponent } from "@components/common/snackbar/snackbar-component";
import { extractCssVar, getCachedThemeCss } from "@config/material-theme-cookie";

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

export function getOnColor(hex: string): string {
    let mode = ui("mode");
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // relative luminance helper
    function luminance(r: number, g: number, b: number) {
        const srgb = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    }

    // contrast ratio helper
    function contrast(l1: number, l2: number) {
        const brightest = Math.max(l1, l2);
        const darkest = Math.min(l1, l2);
        return (brightest + 0.05) / (darkest + 0.05);
    }

    const lumBg = luminance(r, g, b);
    const lumWhite = luminance(255, 255, 255);
    const lumBlack = luminance(0, 0, 0);

    const contrastWhite = contrast(lumBg, lumWhite);
    const contrastBlack = contrast(lumBg, lumBlack);

    // Auto detect mode if needed
    if (mode === "auto") {
        mode = lumBg > 0.5 ? "light" : "dark";
    }

    // Pick the one with higher contrast if it meets WCAG AA (>=4.5)
    if (contrastWhite >= 4.5 && contrastWhite >= contrastBlack) return "#FFFFFF";
    if (contrastBlack >= 4.5 && contrastBlack >= contrastWhite) return "#000000";

    // Otherwise: fall back to complementary hue for guaranteed visibility
    const hsl = rgbToHsl(r, g, b);
    hsl[0] = (hsl[0] + 180) % 360; // shift hue
    hsl[2] = mode === "light" ? 20 : 80; // tweak lightness based on mode
    return hslToHex(hsl[0], hsl[1], hsl[2]);

    // helpers for HSL conversion
    function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h *= 60;
        }
        return [h, s * 100, l * 100];
    }

    function hslToHex(h: number, s: number, l: number): string {
        s /= 100;
        l /= 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        if (0 <= h && h < 60) {
            r = c;
            g = x;
            b = 0;
        } else if (60 <= h && h < 120) {
            r = x;
            g = c;
            b = 0;
        } else if (120 <= h && h < 180) {
            r = 0;
            g = c;
            b = x;
        } else if (180 <= h && h < 240) {
            r = 0;
            g = x;
            b = c;
        } else if (240 <= h && h < 300) {
            r = x;
            g = 0;
            b = c;
        } else if (300 <= h && h < 360) {
            r = c;
            g = 0;
            b = x;
        }
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
    }
}


type WorkspaceFlowtagTimeline = Record<
    string,
    {
        starting_date: string;
        ending_date: string;
        // duration_dates: number;
        // before_end_days: number;
        // after_start_days: number;
    }
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

    for (const { group, content, start, end } of items) {
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
    const padding = 18;
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

        const mergedOptions = { ...defaultOptions, ...options };

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
                this.timeline.setOptions({ maxHeight: getTimelineHeight() });
            }
        });
    }

    onItemChange(item: DataItem) {
        const jobId = typeof item.group === "string" ? parseInt(item.group, 10) : item.group;
        if (jobId) {
            changedJobIds.add(jobId);
        }
    }

    public async loadJobs(jobs: JobItems[]) {
        this.items.clear();
        this.groups.clear();

        jobs.forEach(async (job) => {
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
                const { light, dark } = await getCachedThemeCss(job.job_data.color);

                const primaryLight = extractCssVar(light, "primary");
                const primaryDark = extractCssVar(dark, "primary");

                const onPrimaryLight = extractCssVar(light, "on-primary");
                const onPrimaryDark = extractCssVar(dark, "on-primary");

                const style = document.createElement("style");
                style.id = `job-color-style-${jobGroupId}`;

                style.innerHTML = `
                    body.light .vis-item.${colorClass} {
                        background-color: ${primaryLight};
                        border-color: ${primaryLight};
                        color: ${onPrimaryLight};
                        border-radius: 0.625rem;
                        border: .0625rem solid var(--outline-variant);
                    }
                    body.light .vis-item.vis-selected.${colorClass} {
                        background-color: ${primaryLight};
                        color: ${onPrimaryLight};
                        border-radius: 0.625rem;
                        outline: .125rem solid ${primaryLight};
                        outline-offset: 0.25rem;
                    }
                    body.light .vis-item.vis-item-overflow.vis-item-content.${colorClass} {
                        background-color: red !important;
                        color: ${onPrimaryLight};
                    }

                    body.dark .vis-item.${colorClass} {
                        background-color: ${primaryDark};
                        border-color: ${primaryDark};
                        color: ${onPrimaryDark};
                        border-radius: 0.625rem;
                        border: .0625rem solid var(--outline-variant);
                    }
                    body.dark .vis-item.vis-selected.${colorClass} {
                        background-color: ${primaryDark};
                        color: ${onPrimaryDark};
                        border-radius: 0.625rem;
                        outline: .125rem solid ${primaryDark};
                        outline-offset: 0.25rem;
                    }
                    body.dark .vis-item.vis-item-overflow.vis-item-content.${colorClass} {
                        background-color: red !important;
                        color: ${onPrimaryDark};
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
                        color: "error",
                        message: `Failed to save timeline: ${response.status} ${text}`,
                        icon: "error",
                        duration: 1000,
                    })
                    throw new Error(`Failed to save timeline: ${response.status} ${text}`);
                }

                const result = await response.json();
                new SnackbarComponent({
                    id: "success",
                    color: "green",
                    message: "Timeline saved successfully",
                    icon: "save",
                    duration: 1000,
                })
                changedJobIds.clear();
            } catch (err) {
                new SnackbarComponent({
                    id: "error",
                    color: "error",
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
    await loadJobItemsTimeline()
});

import "beercss";
import "@utils/theme";
import {Timeline, TimelineOptions} from "vis-timeline/esnext";
import {DataSet} from "vis-data";
import {DataGroup, DataItem} from "vis-timeline/declarations";
import "@static/css/vis-timeline-graph2d.min.css";
import {loadTheme} from "@utils/theme";
import {SnackbarComponent} from "@components/common/snackbar/snackbar-component";

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

export interface AssemblyTimeline {
    [assemblyName: string]: TimelineEntry;
}

export interface PartTimeline {
    [partName: string]: TimelineEntry;
}

export interface JobFlowtag {
    id: number;
    name: string;
    type: number;
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
    assembly_timeline: AssemblyTimeline;
    item_timeline: PartTimeline;
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

export function buildJobProcessTimelines(items: DataItem[]): JobTimelinePayload[] {
    const jobs: Record<number, JobTimelinePayload> = {};

    for (const {group, content, start, end} of items) {
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

//
// class JobProcessTimeline {
//     private container: HTMLElement;
//     private timeline: Timeline | null = null;
//     private items: DataSet<DataItem>;
//     private groups: DataSet<DataGroup>;
//
//     constructor(container: HTMLElement, options: TimelineOptions = {}) {
//         this.container = container;
//
//         this.items = new DataSet<DataItem>([]);
//         this.groups = new DataSet<DataGroup>([]);
//
//         function customOrder(a: any, b: any) {
//             return a.id - b.id;
//         }
//
//         const defaultOptions: TimelineOptions = {
//             editable: true,
//             order: customOrder,
//             stack: true,
//             showTooltips: true,
//             multiselect: true,
//             zoomable: true,
//             verticalScroll: true,
//             horizontalScroll: true,
//             zoomKey: "ctrlKey",
//             showCurrentTime: true,
//             orientation: {
//                 axis: "top",
//                 item: "top",
//             },
//             groupOrder: (a: DataGroup, b: DataGroup) => (a.id as number) - (b.id as number), // group order by job id
//             tooltipOnItemUpdateTime: {
//                 template: (item: any) => {
//                     const start = item.start
//                         ? new Date(item.start).toLocaleString()
//                         : "N/A";
//                     const end = item.end ? new Date(item.end).toLocaleString() : "N/A";
//                     return `<div>
//                     <b>${item.content}</b><br/>
//                     Start: ${start}<br/>
//                     End: ${end}
//                   </div>`;
//                 },
//             },
//             onMoving: (item, callback) => {
//                 console.log(item.group);
//                 // If user tries to drag into another group, block it
//                 changedJobIds.add(item.group as number)
//                 if (item.group !== this.items.get(item.id)?.group) {
//                     item.group = this.items.get(item.id)?.group; // reset to original
//                 }
//                 callback(item); // always call callback
//             },
//         };
//
//         const mergedOptions = {...defaultOptions, ...options};
//
//         this.timeline = new Timeline(this.container, [], mergedOptions);
//         this.timeline.setOptions(mergedOptions);
//         this.timeline.setGroups(this.groups);
//         this.timeline.setItems(this.items);
//         this.timeline.on("click", (event: any) => {
//             // DataSet change events: add/update/remove
//             if (event && event.items) {
//                 event.items.forEach((itemId: string | number) => {
//                     const item = this.items.get(itemId);
//                     if (!item) return;
//                     this.onItemChange(item);
//                 });
//             }
//         });
//     }
//
//     onItemChange(item: DataItem) {
//         const jobId = typeof item.group === "string" ? parseInt(item.group, 10) : item.group;
//         if (jobId) {
//             changedJobIds.add(jobId);
//         }
//     }
//
//     public loadJobs(jobs: JobFlowtag[]) {
//         this.items.clear();
//         this.groups.clear();
//
//         jobs.forEach((job) => {
//             const groupId = job.id;
//             this.groups.add({
//                 id: groupId,
//                 content: job.name,
//             });
//
//             // color class for items
//             const colorClass = `job-color-${groupId}`;
//
//             Object.entries(job.flowtag_timeline || {}).forEach(
//                 ([flowName, range], idx) => {
//                     this.items.add({
//                         id: `${groupId}-${idx}`,
//                         group: groupId,
//                         content: flowName,
//                         start: new Date(range.starting_date).toISOString(),
//                         end: new Date(range.ending_date).toISOString(),
//                         title: flowName,
//                         className: colorClass,
//                     });
//                 }
//             );
//
//             // add dynamic CSS for job color
//             if (!document.getElementById(`job-color-style-${groupId}`)) {
//                 const style = document.createElement("style");
//                 style.id = `job-color-style-${groupId}`;
//                 style.innerHTML = `
//                 .vis-item.${colorClass} {
//                     background-color: ${job.color};
//                     border-color: ${job.color};
//                     color: black;
//                 }
//                 .vis-item.vis-selected.${colorClass} {
//                     background-color: ${job.color};
//                     border-color: ${job.color};
//                     color: white;
//                 }
//             `;
//                 document.head.appendChild(style);
//             }
//         });
//     }
//
//
//     public getItems(): DataItem[] {
//         return this.items.get();
//     }
// }

class JobTimeline {
    private readonly container: HTMLElement;
    private readonly timeline: Timeline | null = null;
    private readonly processes: DataSet<DataItem>;
    private readonly items: DataSet<DataItem>;
    private readonly assemblies: DataSet<DataItem>;
    private readonly groups: DataSet<DataGroup>;

    constructor(container: HTMLElement, options: TimelineOptions = {}) {
        this.container = container;

        this.processes = new DataSet<DataItem>([]);
        this.items = new DataSet<DataItem>([]);
        this.assemblies = new DataSet<DataItem>([]);
        this.groups = new DataSet<DataGroup>([]);

        function customOrder(a: any, b: any) {
            return a.id - b.id;
        }

        const defaultOptions: TimelineOptions = {
            editable: true,
            order: customOrder,
            stack: true,
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
    }

    onItemChange(item: DataItem) {
        const jobId = typeof item.group === "string" ? parseInt(item.group, 10) : item.group;
        if (jobId) {
            changedJobIds.add(jobId);
        }
    }

    public loadJobs(jobs: JobItems[]) {
        this.processes.clear();
        this.items.clear();
        this.assemblies.clear();
        this.groups.clear();

        jobs.forEach((job) => {
            const jobGroupId = job.id;

            // Add top-level job group
            this.groups.add({
                id: jobGroupId,
                content: job.name,
                nestedGroups: [jobGroupId * 10 + 1, jobGroupId * 10 + 2, jobGroupId * 10 + 3], // three nested groups
            });

            const processesGroupId = jobGroupId * 10 + 1;
            this.groups.add({
                id: processesGroupId,
                content: "Processes",
            })

            // Nested group for items
            const itemsGroupId = jobGroupId * 10 + 2;
            this.groups.add({
                id: itemsGroupId,
                content: "Items",
            });

            // Nested group for assemblies
            const assembliesGroupId = jobGroupId * 10 + 3;
            this.groups.add({
                id: assembliesGroupId,
                content: "Assemblies",
            });

            const colorClass = `job-color-${jobGroupId}`;

            // Add process timeline
            Object.entries(job.job_data.flowtag_timeline || {}).forEach(([flowName, range], idx) => {
                this.items.add({
                    id: `process-${jobGroupId}-${idx}`,
                    group: processesGroupId,
                    content: flowName,
                    start: new Date(range.starting_date).toISOString(),
                    end: new Date(range.ending_date).toISOString(),
                    title: flowName,
                    className: colorClass,
                });
            });


            // Add item timeline
            Object.entries(job.item_timeline || {}).forEach(([itemName, range], idx) => {
                this.items.add({
                    id: `item-${jobGroupId}-${idx}`,
                    group: itemsGroupId,
                    content: itemName,
                    start: new Date(range.starting_date).toISOString(),
                    end: new Date(range.ending_date).toISOString(),
                    title: itemName,
                    className: colorClass,
                });
            });

            // Add assembly timeline
            Object.entries(job.assembly_timeline || {}).forEach(([assemblyName, range], idx) => {
                this.assemblies.add({
                    id: `assembly-${jobGroupId}-${idx}`,
                    group: assembliesGroupId,
                    content: assemblyName,
                    start: new Date(range.starting_date).toISOString(),
                    end: new Date(range.ending_date).toISOString(),
                    title: assemblyName,
                    className: colorClass,
                });
            });

            // Add dynamic CSS for job color
            if (!document.getElementById(`job-color-style-${jobGroupId}`)) {
                const style = document.createElement("style");
                style.id = `job-color-style-${jobGroupId}`;
                style.innerHTML = `
                .vis-item.${colorClass} {
                    background-color: ${job.job_data.color};
                    border-color: ${job.job_data.color};
                    color: black;
                }
                .vis-item.vis-selected.${colorClass} {
                    background-color: ${job.job_data.color};
                    border-color: ${job.job_data.color};
                    color: white;
                }
            `;
                document.head.appendChild(style);
            }
        });

        // Set the items and groups to the timeline
        if (this.timeline) {
            this.timeline.setGroups(this.groups);
            this.timeline.setItems([...this.items.get(), ...this.assemblies.get()]);
        }
    }


    public getItems(): DataItem[] {
        return this.items.get();
    }
}

// async function loadJobProcessTimeline() {
//     const jobProcessSaveButton = document.getElementById("job-process-save-button") as HTMLButtonElement;
//
//     const container = document.getElementById("job-process-timeline");
//     if (!container) {
//         throw new Error("Missing #job-process-timeline in DOM");
//     }
//
//     try {
//         const res = await fetch("/api/production_planner/job/process/timeline");
//         if (!res.ok) throw new Error("Failed to fetch jobs");
//         const data = await res.json();
//
//         const jobs: JobFlowtag[] = Object.values(data);
//
//         const jobTimeline = new JobProcessTimeline(container);
//         jobTimeline.loadJobs(jobs);
//
//         jobProcessSaveButton.addEventListener("click", async () => {
//             const items = jobTimeline.getItems();
//             const payload = buildJobProcessTimelines(items);
//
//             // Filter only changed jobs
//             const filteredPayload = payload.filter(job => changedJobIds.has(job.id));
//
//             try {
//                 const response = await fetch("/api/production_planner/job/process/timeline", {
//                     method: "POST",
//                     headers: {
//                         "Content-Type": "application/json",
//                     },
//                     body: JSON.stringify(filteredPayload),
//                 });
//
//                 if (!response.ok) {
//                     const text = await response.text();
//                     new SnackbarComponent({
//                         id: "error",
//                         type: "error",
//                         message: `Failed to save timeline: ${response.status} ${text}`,
//                         icon: "error",
//                         duration: 1000,
//                     })
//                     throw new Error(`Failed to save timeline: ${response.status} ${text}`);
//                 }
//
//                 const result = await response.json();
//                 new SnackbarComponent({
//                     id: "success",
//                     type: "green",
//                     message: "Timeline saved successfully",
//                     icon: "check",
//                     duration: 1000,
//                 })
//                 changedJobIds.clear();
//             } catch (err) {
//                 new SnackbarComponent({
//                     id: "error",
//                     type: "error",
//                     message: `Error posting timeline: ${err}`,
//                     icon: "error",
//                     duration: 1000,
//                 })
//                 console.error("Error posting timeline:", err);
//             }
//         });
//
//     } catch (err) {
//         console.error("Failed to load jobs:", err);
//     }
// }

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
            return

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
                    icon: "check",
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
    loadTheme("light");
    // Promise.all([loadJobProcessTimeline(), loadJobItemsTimeline()]);
    await loadJobItemsTimeline()
});

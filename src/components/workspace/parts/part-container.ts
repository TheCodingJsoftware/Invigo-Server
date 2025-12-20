import { LaserCutPartData } from "@interfaces/laser-cut-part";
import { PartDataService } from "@components/workspace/parts/part-data.service";
import { WorkspaceWebSocket } from "@core/websocket/workspace-websocket";
import { Loading } from "@components/common/loading/loading";
import { WorkspaceSort } from "@models/workspace-sort";
import { WorkspaceFilter } from "@models/workspace-filter";
import { SearchInput } from "@components/common/input/search-input";
import { invertImages } from "@utils/theme";
import { PartSelectionManager } from "@components/workspace/parts/part-selection-manager";
import { PartsTable } from "@components/workspace/parts/parts-table";
import { JobData } from "@interfaces/job";
import { TimelineEntry } from "../../../pages/production_planner/production_planner";
import { JobElement } from "@components/workspace/parts/job-element";

export interface PartData {
    group_id: number;
    job_id: number;
    job_data: JobData;
    name: string;
    flowtag: string[];
    flowtag_index: number;
    flowtag_status_index: number;
    recut: boolean;
    recoat: boolean;
    current_flowtag: string;
    is_completed: boolean;
    is_timing: boolean;
    quantity: number;
    start_time: string;
    end_time: string;
    meta_data: LaserCutPartData["meta_data"];
    workspace_data: LaserCutPartData["workspace_data"];
    created_at: string;
    modified_at: string;
    // This does not come from workspace db
    is_overdue: boolean;
    part_timeline: TimelineEntry;
}

type PartPageData = Array<PartData>;

export class PartContainer {
    readonly element: HTMLElement;

    constructor() {
        this.element = document.createElement("div");

        WorkspaceWebSocket.on("grouped_parts_job_view_changed", async (message) => {
            await this.load();
        });

        PartSelectionManager.onChange((rows) => {
            PartSelectionManager.update(rows);
        });
    }

    async load() {
        const t0 = performance.now();
        Loading.show();

        // fetch
        const f0 = performance.now();
        let data: PartPageData = await PartDataService.getParts();
        const fetchMs = performance.now() - f0;

        // filter visibility
        const fv0 = performance.now();
        const usedMaterials = Array.from(new Set(data.map(p => p.meta_data.material).filter(Boolean)));
        const usedThicknesses = Array.from(new Set(data.map(p => p.meta_data.gauge).filter(Boolean)));
        this.updateFilterVisibility(usedMaterials, usedThicknesses);
        const fvMs = performance.now() - fv0;

        // search filter
        let searchMs = 0;
        const q = (WorkspaceFilter.searchQuery ?? "").trim().toLowerCase();
        if (q) {
            const s0 = performance.now();
            const terms = q.split(/\s+/).filter(Boolean);
            data = data.filter(p => {
                const hay = [
                    p.name,
                    p.current_flowtag,
                    p.meta_data.material,
                    p.meta_data.gauge,
                    p.meta_data.part_dim,
                    String(p.quantity ?? ""),
                    String(p.meta_data.weight ?? ""),
                    String(p.meta_data.machine_time ?? ""),
                ].filter(Boolean).join(" ").toLowerCase();
                return terms.every(t => hay.includes(t));
            });
            searchMs = performance.now() - s0;
        }

        // material/thickness filters
        const f0b = performance.now();
        data = data.filter(p => {
            const materialFilters = Object.entries(WorkspaceFilter.getManager().get())
                .filter(([k, v]) => k.startsWith("show_material:") && v === true)
                .map(([k]) => k.slice("show_material:".length));
            if (materialFilters.length && !materialFilters.includes(p.meta_data?.material)) return false;

            const thicknessFilters = Object.entries(WorkspaceFilter.getManager().get())
                .filter(([k, v]) => k.startsWith("show_thickness:") && v === true)
                .map(([k]) => k.slice("show_thickness:".length));
            if (thicknessFilters.length && !thicknessFilters.includes(p.meta_data?.gauge)) return false;

            return true;
        });
        const filterMs = performance.now() - f0b;

        // sort
        const srt0 = performance.now();
        data.sort((a, b) => {
            const settings = WorkspaceSort.getManager().get();
            const comparisons: Array<[boolean, number]> = [
                [settings.sortByName, a.name.localeCompare(b.name)],
                [settings.sortByCurrentProcess, a.flowtag_index - b.flowtag_index],
                [settings.sortByQuantity, a.quantity - b.quantity],
                [settings.sortByMaterial, a.meta_data.material.localeCompare(b.meta_data.material)],
                [settings.sortByThickness, a.meta_data.gauge.localeCompare(b.meta_data.gauge)],
                [settings.sortByCreatedTime, new Date(a.created_at).getTime() - new Date(b.created_at).getTime()],
                [settings.sortByModifiedTime, new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime()],
                [settings.sortByBendHits, a.meta_data.bend_hits - b.meta_data.bend_hits],
                [settings.sortBySurfaceArea, a.meta_data.surface_area - b.meta_data.surface_area],
                [settings.sortByWeight, a.meta_data.weight - b.meta_data.weight],
                [settings.sortBySize, a.meta_data.part_dim.localeCompare(b.meta_data.part_dim)],
                [settings.sortByMachineTime, a.meta_data.machine_time - b.meta_data.machine_time],
            ];
            for (const [enabled, result] of comparisons) {
                if (enabled && result !== 0) {
                    return settings.reverse ? -result : result;
                }
            }
            return 0;
        });
        const sortMs = performance.now() - srt0;

        if (!data || data.length === 0) {
            this.showEmptyMessage("No parts available. All parts are completed or filtered.");
            Loading.hide();
            SearchInput.setLoading(false);
            SearchInput.setResultsCount(data.length);
            console.log(JSON.stringify({
                handler: "PartContainer.load",
                parts: 0,
                fetch_ms: +fetchMs.toFixed(3),
                filterVisibility_ms: +fvMs.toFixed(3),
                searchFilter_ms: +searchMs.toFixed(3),
                filter_ms: +filterMs.toFixed(3),
                sort_ms: +sortMs.toFixed(3),
                total_ms: +(performance.now() - t0).toFixed(3)
            }));
            return;
        }

        const jt0 = performance.now();
        await this.loadJobTables(data);
        const jtMs = performance.now() - jt0;

        Loading.hide();
        SearchInput.setLoading(false);
        SearchInput.setResultsCount(data.length);

        console.log(JSON.stringify({
            handler: "PartContainer.load",
            parts: data.length,
            fetch_ms: +fetchMs.toFixed(3),
            filterVisibility_ms: +fvMs.toFixed(3),
            searchFilter_ms: +searchMs.toFixed(3),
            filter_ms: +filterMs.toFixed(3),
            sort_ms: +sortMs.toFixed(3),
            jobTables_ms: +jtMs.toFixed(3),
            total_ms: +(performance.now() - t0).toFixed(3)
        }));
    }

    private async loadGlobalTable(data: PartPageData) {
        const fragment = document.createDocumentFragment();
        const article = document.createElement("article");
        article.classList.add("round", "border");

        const globalTable = new PartsTable();
        await globalTable.loadData(data);

        globalTable.table.classList.add("global-table");
        globalTable.table.classList.add("scroll");
        globalTable.thead.classList.add("fixed");

        article.appendChild(globalTable.table);

        fragment.appendChild(article);

        requestIdleCallback(() => {
            this.element.replaceChildren(fragment);
            invertImages();
        });
    }

    private async loadJobTables(data: PartPageData) {
        const scrollY = this.saveScroll();
        const t0 = performance.now();
        const fragment = document.createDocumentFragment();
        const groups = this.groupPartsByJob(data);
        const sortedJobIds = Array.from(groups.keys())
            .filter((id): id is number => id !== null)
            .sort((a, b) => a - b);

        let jobCount = 0;
        let jobTotalMs = 0;
        for (const jobId of sortedJobIds) {
            const parts = groups.get(jobId)!;
            const j0 = performance.now();
            const jobElement = new JobElement(jobId, parts);
            await jobElement.initialize();
            const jMs = performance.now() - j0;
            jobTotalMs += jMs;

            if (jobElement.parts.length === 0) continue;
            if (!jobElement.element.hasChildNodes()) continue;

            fragment.appendChild(jobElement.element);
            jobCount++;
            console.log(JSON.stringify({
                handler: "PartContainer.loadJobTables.job",
                jobId,
                parts: jobElement.parts.length,
                ms: +jMs.toFixed(3)
            }));
        }

        requestIdleCallback(() => {
            this.element.replaceChildren(fragment);

            requestAnimationFrame(() => {
                this.restoreScroll(scrollY);
                invertImages();
            });

            console.log(JSON.stringify({
                handler: "PartContainer.loadJobTables",
                jobs: jobCount,
                totalParts: data.length,
                jobInit_ms: +jobTotalMs.toFixed(3),
                total_ms: +(performance.now() - t0).toFixed(3)
            }));
        });
    }

    private groupPartsByJob(data: PartPageData): Map<number | null, PartData[]> {
        return data.reduce((groups, part) => {
            const jobId = part.job_id ?? null;
            if (!groups.has(jobId)) {
                groups.set(jobId, []);
            }
            groups.get(jobId)!.push(part);
            return groups;
        }, new Map<number | null, PartData[]>());
    }

    updateFilterVisibility(usedMaterials: string[], usedThicknesses: string[]) {
        const materialSet = new Set(usedMaterials);
        const thicknessSet = new Set(usedThicknesses);

        document.querySelectorAll<HTMLElement>("nav.right [data-filter-type='material']").forEach(el => {
            const value = el.dataset.value!;
            if (materialSet.has(value)) {
                el.classList.remove("hidden");
            } else {
                el.classList.add("hidden");
            }
        });

        document.querySelectorAll<HTMLElement>("nav.right [data-filter-type='thickness']").forEach(el => {
            const value = el.dataset.value!;
            if (thicknessSet.has(value)) {
                el.classList.remove("hidden");
            } else {
                el.classList.add("hidden");
            }
        });
    }

    private showEmptyMessage(message: string): void {
        const empty = document.createElement("p");
        empty.className = "center-align";
        empty.textContent = message;

        this.element.replaceChildren(empty);
    }

    private saveScroll(): number {
        return window.scrollY;
    }

    private restoreScroll(y: number) {
        requestAnimationFrame(() => {
            window.scrollTo({
                top: y,
                behavior: "auto"
            });
        });
    }
}

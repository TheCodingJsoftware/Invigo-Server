import { LaserCutPartData } from "@interfaces/laser-cut-part";
import { PartViewMode } from "@config/part-view-mode";
import { PartDataService } from "@components/workspace/parts/part-data.service";
import { WorkspaceWebSocket } from "@core/websocket/workspace-websocket";
import { ViewSettingsManager } from "@core/settings/view-settings";
import { Loading } from "@components/common/loading/loading";
import { WorkspaceSort } from "@models/workspace-sort";
import { WorkspaceFilter } from "@models/workspace-filter";
import { SearchInput } from "@components/common/input/search-input";
import { invertImages } from "@utils/theme";
import { PartSelectionManager } from "@components/workspace/parts/part-selection-manager";
import { PartsTable } from "@components/workspace/parts/parts-table";
import { CookieSettingsManager } from "@core/settings/cookies";

export interface PartData {
    group_id: number;
    job_id?: number;
    name: string;
    flowtag: string[];
    flowtag_index: number;
    flowtag_status_index: number;
    recut: boolean;
    recoat: boolean;
    current_flowtag: string;
    is_completed: boolean;
    quantity: number;
    meta_data: LaserCutPartData["meta_data"];
    workspace_data: LaserCutPartData["workspace_data"];
    created_at: string;
    updated_at: string;
}

type PartPageData = Array<PartData>;

interface JobSettings {
    isCollapsed: boolean;
}

class JobElement {
    readonly element: HTMLElement;
    readonly articleContent: HTMLDivElement;
    jobId: number;
    parts: PartData[];
    jobSettings: CookieSettingsManager<JobSettings>;

    constructor(jobId: number, parts: PartData[]) {
        this.jobId = jobId;
        this.parts = parts;
        this.jobSettings = new CookieSettingsManager(`jobSettings:${this.jobId}`, { isCollapsed: false });

        this.element = document.createElement("article");
        this.element.classList.add("round", "border");

        this.articleContent = document.createElement("div");
        this.articleContent.classList.add(".article-content");
    }

    async initialize() {
        this.element.appendChild(this.createArticleHeader());
        this.element.appendChild(this.articleContent);
        const partsTable = new PartsTable();
        await partsTable.loadData(this.parts);
        this.articleContent.appendChild(partsTable.table);

        if (this.jobSettings.get()["isCollapsed"]) {
            this.collapseArticleContent();
        }
    }

    private createArticleHeader(): HTMLElement {
        const header = document.createElement("header");
        header.classList.add("row", "middle-align");

        const title = document.createElement("h5");
        title.classList.add("max");
        title.textContent = `Job #${this.jobId}`;

        const actions = document.createElement("div");
        actions.classList.add("row");

        // Add collapse/expand button
        const toggleButton = document.createElement("button");
        toggleButton.classList.add("circle", "transparent", "toggle-button");
        toggleButton.innerHTML = "<i>expand_less</i>";
        toggleButton.onclick = () => this.collapseArticleContent();

        actions.appendChild(toggleButton);

        header.appendChild(title);
        header.appendChild(actions);

        return header;
    }

    private collapseArticleContent(collapse?: boolean) {
        const toggleButton = this.element.querySelector(".toggle-button");
        if (toggleButton) {
            this.articleContent.classList.toggle('hidden');
            const isCollapsed = this.articleContent.classList.contains('hidden')
            toggleButton.querySelector('i')!.textContent = isCollapsed ? 'expand_more' : 'expand_less';
            this.jobSettings.set({ "isCollapsed": isCollapsed })
        }
    }
}

export class PartPage {
    readonly element: HTMLElement;

    constructor() {
        this.element = document.createElement("div");

        WorkspaceWebSocket.on("grouped_parts_job_view_changed", async (message) => {
            console.log("Job view changed: ", message);
            const currentView = ViewSettingsManager.get().lastActivePartView;
            await this.load(currentView);
        });
        WorkspaceWebSocket.on("grouped_parts_global_view_changed", async (message) => {
            console.log("Global view changed: ", message)
            const currentView = ViewSettingsManager.get().lastActivePartView;
            await this.load(currentView);
        });

        PartSelectionManager.onChange((rows) => {
            PartSelectionManager.update(rows);
        });
    }

    async load(viewMode: PartViewMode) {
        Loading.show();
        let data: PartPageData = await PartDataService.getParts();

        const q = (WorkspaceFilter.searchQuery ?? "").trim().toLowerCase();
        if (q) {
            const terms = q.split(/\s+/).filter(Boolean);
            data = data.filter(p => {
                const hay = [
                    p.name,
                    p.current_flowtag,
                    p.meta_data?.material,
                    p.meta_data?.gauge,
                    p.meta_data?.part_dim,
                    String(p.quantity ?? ""),
                    String(p.meta_data?.weight ?? ""),
                    String(p.meta_data?.machine_time ?? ""),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return terms.every(t => hay.includes(t));
            });
        }

        data.sort((a, b) => {
            const settings = WorkspaceSort.getManager().get();

            const comparisons: Array<[boolean, number]> = [
                [settings.sortByName, a.name.localeCompare(b.name)],
                [settings.sortByCurrentProcess, a.flowtag_index - b.flowtag_index],
                [settings.sortByQuantity, a.quantity - b.quantity],
                [settings.sortByMaterial, a.meta_data.material.localeCompare(b.meta_data.material)],
                [settings.sortByThickness, a.meta_data.gauge.localeCompare(b.meta_data.gauge)],
                [settings.sortByCreatedTime, new Date(a.created_at).getTime() - new Date(b.created_at).getTime()],
                [settings.sortByModifiedTime, new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()],
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
        if (!data || data.length === 0) {
            this.showEmptyMessage("No parts available. All parts are completed or filtered.");
            Loading.hide();
            SearchInput.setLoading(false);
            SearchInput.setResultsCount(data.length);
            return;
        }

        if (viewMode == PartViewMode.Global) {
            await this.loadGlobalTable(data);
        }
        if (viewMode == PartViewMode.Job) {
            await this.loadJobTables(data);
        }
        Loading.hide();
        SearchInput.setLoading(false);
        SearchInput.setResultsCount(data.length);
    }

    private async loadGlobalTable(data: PartPageData) {
        const fragment = document.createDocumentFragment();
        const article = document.createElement("article");
        article.classList.add("round", "border");

        const globalTable = new PartsTable();
        await globalTable.loadData(data);

        article.appendChild(globalTable.table);

        fragment.appendChild(article);

        requestIdleCallback(() => {
            this.element.replaceChildren(fragment);
            invertImages();
        });
    }

    private async loadJobTables(data: PartPageData) {
        const fragment = document.createDocumentFragment();
        const groups = this.groupPartsByJob(data);
        const sortedJobIds = Array.from(groups.keys())
            .filter((id): id is number => id !== null)
            .sort((a, b) => a - b);

        for (const jobId of sortedJobIds) {
            const parts = groups.get(jobId)!;

            const jobElement = new JobElement(jobId, parts);
            await jobElement.initialize();

            fragment.appendChild(jobElement.element);
        }

        requestIdleCallback(() => {
            this.element.replaceChildren(fragment);
            invertImages();
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

    private showEmptyMessage(message: string): void {
        const empty = document.createElement("p");
        empty.className = "center-align";
        empty.textContent = message;

        this.element.replaceChildren(empty);
    }
}

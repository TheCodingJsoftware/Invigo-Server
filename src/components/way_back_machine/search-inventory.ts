import { Component } from "@models/component";
import { LaserCutPart } from "@models/laser-cut-part";
import { Sheet } from "@models/sheet";
import { fetchJSON } from "@utils/fetch-json";
import Fuse from "fuse.js";

export type SearchItem = {
    id: number;
    type: InventoryType;
    label: string;
    subtitle: string;
    raw: Sheet | Component | LaserCutPart;
};

export type InventoryType = "component" | "sheet" | "laser-cut-part";

export class SearchInventory extends EventTarget {
    private root!: HTMLDivElement;
    private menu!: HTMLMenuElement;
    public activeInput!: HTMLInputElement;
    public launcherInput!: HTMLInputElement;

    private lastTypedQuery = "";

    public items: SearchItem[] = [];
    public fuse!: Fuse<SearchItem>;

    constructor(private mount: HTMLElement) {
        super();
    }

    async init() {
        this.build();
        await this.loadInventory();
        this.buildFuse();
        this.wireUI();
    }

    private build() {
        this.root = document.createElement("div");
        this.root.className = "center field large prefix round fill large-width";
        this.root.id = "search-field";

        const searchIcon = document.createElement("i");
        searchIcon.className = "front";
        searchIcon.textContent = "search";

        this.launcherInput = document.createElement("input");
        this.launcherInput.readOnly = true;

        const output = document.createElement("output");
        output.textContent = "Search the selected inventory";

        this.menu = document.createElement("menu");
        this.menu.className = "min";

        const headerLi = document.createElement("li");

        const headerField = document.createElement("div");
        headerField.className = "field large prefix";

        const backIcon = document.createElement("i");
        backIcon.className = "front";
        backIcon.textContent = "arrow_back";

        this.activeInput = document.createElement("input");
        this.activeInput.autocomplete = "off";

        headerField.appendChild(backIcon);
        headerField.appendChild(this.activeInput);

        headerLi.appendChild(headerField);
        this.menu.appendChild(headerLi);

        this.root.appendChild(searchIcon);
        this.root.appendChild(this.launcherInput);
        this.root.appendChild(output);
        this.root.appendChild(this.menu);

        this.mount.appendChild(this.root);
    }

    private async loadInventory() {
        const [components, sheets, laserCutParts] = await Promise.all([
            fetchJSON<Component[]>("/components_inventory/get_all"),
            fetchJSON<Sheet[]>("/sheets_inventory/get_all"),
            fetchJSON<LaserCutPart[]>("/laser_cut_parts_inventory/get_all"),
        ]);

        this.items = [
            ...components.map(c => ({
                id: c.id,
                type: "component" as const,
                label: c.part_name,
                subtitle: "Component",
                raw: c,
            })),
            ...sheets.map(s => ({
                id: s.id,
                type: "sheet" as const,
                label: s.name,
                subtitle: "Sheet",
                raw: s,
            })),
            ...laserCutParts.map(p => ({
                id: p.id,
                type: "laser-cut-part" as const,
                label: p.name,
                subtitle: "Laser Cut Part",
                raw: p,
            })),
        ];
    }

    private buildFuse() {
        this.fuse = new Fuse(this.items, {
            threshold: 0.45,
            ignoreLocation: true,
            minMatchCharLength: 2,
            includeScore: true,
            keys: ["label"],
        });
    }

    private wireUI() {
        this.launcherInput.addEventListener("click", () => {
            this.launcherInput.blur();
            this.menu.classList.add("active");
            this.activeInput.value = this.lastTypedQuery;

            requestAnimationFrame(() =>
                this.activeInput.focus({ preventScroll: true })
            );

            if (this.lastTypedQuery.length >= 2) {
                this.search();
            }
        });

        this.activeInput.addEventListener(
            "input",
            this.debounce(() => this.search(), 150)
        );

        this.menu
            .querySelector(".front")
            ?.addEventListener("click", () =>
                this.menu.classList.remove("active")
            );
    }

    private debounce<T extends (...args: any[]) => void>(fn: T, delay = 200) {
        let timer: number;
        return (...args: Parameters<T>) => {
            clearTimeout(timer);
            timer = window.setTimeout(() => fn(...args), delay);
        };
    }

    public setSearchQuery(q: string) {
        this.launcherInput.value = q;
        this.activeInput.value = q;
        this.lastTypedQuery = q;
    }

    private search() {
        const q = this.activeInput.value.trim();
        this.lastTypedQuery = q;

        this.clearResults();
        if (q.length < 2) return;

        this.fuse.search(q).slice(0, 25).forEach(r => {
            const li = document.createElement("li");
            li.className = "result";
            li.innerHTML = `
                <i>history</i>
                <div>
                    <div>${r.item.label}</div>
                    <small>${r.item.subtitle}</small>
                </div>
            `;
            li.onclick = () => this.select(r.item);
            this.menu.appendChild(li);
        });
    }

    private clearResults() {
        this.menu
            .querySelectorAll("li.result")
            .forEach(li => li.remove());
    }

    private select(item: SearchItem) {
        this.launcherInput.value = item.label;
        this.lastTypedQuery = item.label;
        this.clearResults();
        this.menu.classList.remove("active");

        // 🔔 Emit signal
        this.dispatchEvent(
            new CustomEvent<SearchItem>("select", { detail: item })
        );
    }
}

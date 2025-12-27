import { Component } from "@models/component";
import { LaserCutPart } from "@models/laser-cut-part";
import { Sheet } from "@models/sheet";
import { debounce } from "@utils/debounce";
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
    private backButton!: HTMLElement;
    private clearButton!: HTMLElement;

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
        this.launcherInput.placeholder = "Search";
        this.launcherInput.autocomplete = "off";
        this.launcherInput.readOnly = true;

        this.menu = document.createElement("menu");
        this.menu.className = "min top-round";

        const headerLi = document.createElement("li");

        const headerField = document.createElement("div");
        headerField.className = "field large prefix suffix";

        this.backButton = document.createElement("i");
        this.backButton.className = "front";
        this.backButton.textContent = "arrow_back";

        this.activeInput = document.createElement("input");
        this.activeInput.placeholder = "Search";
        this.activeInput.autocomplete = "off";

        this.clearButton = document.createElement("i");
        this.clearButton.className = "end clickable";
        this.clearButton.textContent = "close";
        this.clearButton.setAttribute("role", "button");
        this.clearButton.tabIndex = 0;
        this.clearButton.style.cursor = "pointer";
        this.clearButton.style.pointerEvents = "auto";
        this.clearButton.classList.add("hidden");

        headerField.appendChild(this.backButton);
        headerField.appendChild(this.activeInput);
        headerField.appendChild(this.clearButton);

        headerLi.appendChild(headerField);
        this.menu.appendChild(headerLi);

        this.root.appendChild(searchIcon);
        this.root.appendChild(this.launcherInput);
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
            this.clearButton.classList.remove("hidden");
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
            debounce(() => this.search(), 150)
        );

        this.clearButton.addEventListener("click", (e) => {
            e.stopPropagation();

            this.activeInput.value = "";
            this.launcherInput.value = "";
            this.lastTypedQuery = "";

            this.clearResults();
            this.menu.classList.remove("active");
            this.clearButton.classList.add("hidden");
        });

        this.backButton.addEventListener("click", () => {
            this.menu.classList.remove("active");
            this.clearButton.classList.add("hidden");
        });
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
                <i>search</i>
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

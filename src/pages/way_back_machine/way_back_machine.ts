import "beercss";
import "@utils/theme";
import { Sheet } from "@models/sheet";
import { Component } from "@models/component";
import { LaserCutPart } from "@models/laser-cut-part";
import Fuse, { IFuseOptions } from "fuse.js";
import { Graph2d } from "vis-timeline/esnext";
import { DataSet } from "vis-data";
import type { DataGroup } from "vis-timeline/declarations";
import "@static/css/vis-timeline-graph2d.min.css";

/* =========================
   DOM REFERENCES
   ========================= */
const itemType = document.getElementById("item-type") as HTMLDivElement;
const components = document.getElementById("components") as HTMLAnchorElement;
const laserCutParts = document.getElementById("laser-cut-parts") as HTMLAnchorElement;
const sheets = document.getElementById("sheets") as HTMLAnchorElement;

const launcherInput = document.getElementById("search-launcher") as HTMLInputElement;
const activeInput = document.getElementById("search-active") as HTMLInputElement;
const menu = document.getElementById("search-menu") as HTMLMenuElement;

/* =========================
   SEARCH INDEXES
   ========================= */
let sheetIndex: Fuse<Sheet>;
let componentIndex: Fuse<Component>;
let laserCutIndex: Fuse<LaserCutPart>;
let inventory: any | null = null;
let lastTypedQuery = "";
let selectedItem: Sheet | Component | LaserCutPart | null = null;


/* =========================
   TYPES
   ========================= */

type BaseHistoryEntry = {
    version: number;
    modified_by: string;
    created_at: string; // ISO
    created_at_formatted: string;
    event_type: string;
    details?: Record<string, any>;
};

type OrderHistoryEntry = BaseHistoryEntry & {
    quantity_change: {
        from_quantity: number | null;
        to_quantity: number;
    };
    details?: {
        new_orders?: {
            order_pending_quantity: number;
        }[];
        removed_orders?: {
            order_pending_quantity: number;
        }[];
    };
};

type QuantityHistoryEntry = BaseHistoryEntry & {
    from_quantity: number;
    to_quantity: number;
};

type PriceHistoryEntry = BaseHistoryEntry & {
    from_price: number;
    to_price: number;
};

type HistoryResponse<T> = {
    success: boolean;
    history_entries: T[];
};

type FullHistoryResponse = {
    order?: HistoryResponse<OrderHistoryEntry>;
    quantity?: HistoryResponse<QuantityHistoryEntry>;
    price?: HistoryResponse<PriceHistoryEntry>;
};

/* =========================
   UTILITIES
   ========================= */
function debounce<T extends (...args: any[]) => void>(fn: T, delay = 200) {
    let timer: number;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    };
}

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await window.fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<T>;
}

type HistoryRoutes = {
    order?: (id: string) => string;
    quantity?: (id: string) => string;
    price?: (id: string) => string;
};

const HISTORY_ROUTE_MAP: Record<string, HistoryRoutes> = {
    components: {
        order: id => `/get_order_history/component/${id}`,
        quantity: id => `/get_quantity_history/component/${id}`,
        price: id => `/get_price_history/component/${id}`,
    },
    sheets: {
        order: id => `/get_order_history/sheet/${id}`,
        quantity: id => `/get_quantity_history/sheet/${id}`,
        price: id => `/get_price_history/sheet/${id}`,
    },
    "laser-cut-parts": {
        quantity: id => `/get_quantity_history/laser_cut_part/${id}`,
    },
};

function getItemIdentifier(item: any): string {
    return String(item.id);
}

function sortByDate<T extends { created_at: string }>(entries: T[]): T[] {
    return entries
        .slice()
        .sort(
            (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
        );
}

function parseQuantityHistory(
    history: HistoryResponse<QuantityHistoryEntry>,
    group: string
) {
    if (!history.success) return [];

    return sortByDate(history.history_entries).map(e => ({
        x: e.created_at,
        y: e.to_quantity,
        group,
    }));
}

function parsePriceHistory(
    history: HistoryResponse<PriceHistoryEntry>,
    group: string
) {
    if (!history.success) return [];

    return sortByDate(history.history_entries).map(e => ({
        x: e.created_at,
        y: e.to_price,
        group,
    }));
}

function parseOrderHistory(
    history: HistoryResponse<OrderHistoryEntry>,
    group: string
) {
    if (!history.success) return [];

    let pending = 0;

    return sortByDate(history.history_entries).map(e => {
        if (e.details?.new_orders) {
            pending += e.details.new_orders.reduce(
                (sum, o) => sum + o.order_pending_quantity,
                0
            );
        }

        if (e.details?.removed_orders) {
            pending -= e.details.removed_orders.reduce(
                (sum, o) => sum + o.order_pending_quantity,
                0
            );
        }

        return {
            x: e.created_at,
            y: pending,
            group,
        };
    });
}


/* =========================
   DATA LOADERS
   ========================= */
const getAllSheets = () =>
    fetchJSON<Sheet[]>("/sheets_inventory/get_all");

const getAllComponents = () =>
    fetchJSON<Component[]>("/components_inventory/get_all");

const getAllLaserCutParts = () =>
    fetchJSON<LaserCutPart[]>("/laser_cut_parts_inventory/get_all");

async function loadAllInventory() {
    const [sheets, components, laserCutParts] = await Promise.all([
        getAllSheets(),
        getAllComponents(),
        getAllLaserCutParts(),
    ]);
    return { sheets, components, laserCutParts };
}

async function fetchHistoryData(
    type: string,
    item: any
): Promise<FullHistoryResponse> {
    const routes = HISTORY_ROUTE_MAP[type];
    if (!routes) {
        throw new Error(`No history routes for type: ${type}`);
    }

    const id = getItemIdentifier(item);

    const promises: [
        Promise<HistoryResponse<OrderHistoryEntry>> | Promise<undefined>,
        Promise<HistoryResponse<QuantityHistoryEntry>> | Promise<undefined>,
        Promise<HistoryResponse<PriceHistoryEntry>> | Promise<undefined>,
    ] = [
            routes.order
                ? fetchJSON<HistoryResponse<OrderHistoryEntry>>(routes.order(id))
                : Promise.resolve(undefined),

            routes.quantity
                ? fetchJSON<HistoryResponse<QuantityHistoryEntry>>(routes.quantity(id))
                : Promise.resolve(undefined),

            routes.price
                ? fetchJSON<HistoryResponse<PriceHistoryEntry>>(routes.price(id))
                : Promise.resolve(undefined),
        ];

    const [order, quantity, price] = await Promise.all(promises);

    return { order, quantity, price };
}


function buildHistoryGroups(): DataSet<DataGroup> {
    const groups = new DataSet<DataGroup>();

    groups.add({
        id: "quantity",
        content: "Quantity",
        options: {
            drawPoints: { style: "circle", size: 6 },
            shaded: { orientation: "bottom" },
        },
    });

    groups.add({
        id: "price",
        content: "Price",
        options: {
            yAxisOrientation: "right",
            drawPoints: { style: "square" },
        },
    });

    groups.add({
        id: "orders",
        content: "Pending Orders",
        options: {
            style: "bar",
        },
    });
    return groups;
}



/* =========================
   FUSE SETUP
   ========================= */
function buildIndexes(
    sheets: Sheet[],
    components: Component[],
    laserCutParts: LaserCutPart[]
) {
    const options: IFuseOptions<any> = {
        threshold: 0.45,
        ignoreLocation: true,
        minMatchCharLength: 2,
        includeScore: true,
        keys: ["name", "part_name", "part_number"],
    };

    sheetIndex = new Fuse(sheets, options);
    componentIndex = new Fuse(components, options);
    laserCutIndex = new Fuse(laserCutParts, options);
}

function getActiveIndex(): Fuse<any> | null {
    const type = getSelectedItemType();
    if (type === "sheets") return sheetIndex;
    if (type === "components") return componentIndex;
    if (type === "laser-cut-parts") return laserCutIndex;
    return null;
}

/* =========================
   SEARCH UI
   ========================= */
function clearResults() {
    menu.querySelectorAll("li.result").forEach(li => li.remove());
}

function closeMenu() {
    menu.classList.remove("active");
    launcherInput.blur();
}

function renderResults(results: any[]) {
    clearResults();

    results.slice(0, 25).forEach(r => {
        const li = document.createElement("li");
        li.className = "result";
        if (r.item.part_name) {
            li.innerHTML = `
                <i>history</i>
                <div>${r.item.part_name}</div>
            `;
        } else {
            li.innerHTML = `
                <i>history</i>
                <div>${r.item.name}</div>
            `;
        }
        li.onclick = () => {
            selectedItem = r.item;
            if (r.item.part_name) {
                lastTypedQuery = r.item.part_name;
                launcherInput.value = r.item.part_name;
            } else {
                lastTypedQuery = r.item.name;
                launcherInput.value = r.item.name;
            }
            clearResults();
            closeMenu();
            runSearch();
            setURLParams();
        };

        menu.appendChild(li);
    });
}

function renderHistoryGraph(
    container: HTMLElement,
    history: FullHistoryResponse
) {
    const items: any[] = [];

    if (history.quantity)
        items.push(...parseQuantityHistory(history.quantity, "quantity"));

    if (history.price)
        items.push(...parsePriceHistory(history.price, "price"));

    if (history.order)
        items.push(...parseOrderHistory(history.order, "orders"));

    const dataset = new DataSet(items);
    const groups = buildHistoryGroups();

    return new Graph2d(container, dataset, groups, {
        height: "800px",
        legend: {
            enabled: true,
            left: {
                position: "bottom-right",
            },
        },
        dataAxis: { showMinorLabels: false },
    });
}

function onActiveSearchInput() {
    const query = activeInput.value.trim();
    lastTypedQuery = query;

    if (query.length < 2) {
        clearResults();
        return;
    }

    const index = getActiveIndex();
    if (!index) return;

    renderResults(index.search(query));
}
const debouncedActiveSearch = debounce(onActiveSearchInput, 150);

/* =========================
   SEARCH + STATE
   ========================= */
function getSelectedItemType(): string {
    return itemType.querySelector(".active")!.id;
}

function getSelectedItem(itemName: string): Component | Sheet | LaserCutPart | null {
    if (!inventory) return null;

    const type = getSelectedItemType();
    if (type === "sheets") {
        for (const sheet of inventory.sheets) {
            if (sheet.name === itemName) return sheet;
        }
    } else if (type === "components") {
        for (const component of inventory.components) {
            if (component.part_name === itemName) return component;
        }
    } else if (type === "laser-cut-parts") {
        for (const laserCutPart of inventory.laserCutParts) {
            if (laserCutPart.name === itemName) return laserCutPart;
        }
    }

    return null;
}

async function runSearch() {
    const type = getSelectedItemType();
    if (!type || !selectedItem) return;

    try {
        const history = await fetchHistoryData(type, selectedItem);
        if (!history) return; // guard

        const container = document.getElementById("visualization")!;
        container.innerHTML = "";

        renderHistoryGraph(container, history);
    } catch (err) {
        console.error("Failed to load history:", err);
    }
}

function setURLParams() {
    const params = new URLSearchParams(window.location.search);
    params.set("itemType", getSelectedItemType());
    params.set("search", launcherInput.value);
    history.replaceState(null, "", `${window.location.pathname}?${params}`);
}

function loadURLParams() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("itemType") || "components";
    const search = params.get("search") || "";
    lastTypedQuery = search || "";
    if (search) {
        launcherInput.value = search
        activeInput.value = search;
    }
    itemType.querySelectorAll("a").forEach(a => a.classList.remove("active"));
    itemType.querySelector(`#${type}`)?.classList.add("active");
    selectedItem = getSelectedItem(lastTypedQuery);
}

function itemTypeChanged(item: HTMLAnchorElement) {
    itemType.querySelectorAll("a").forEach(a => a.classList.remove("active"));
    item.classList.add("active");
    setURLParams();
    runSearch();
}

/* =========================
   EVENT WIRING
   ========================= */
window.addEventListener("popstate", runSearch);

document.addEventListener("DOMContentLoaded", async () => {
    inventory = await loadAllInventory();
    loadURLParams();

    buildIndexes(
        inventory.sheets,
        inventory.components,
        inventory.laserCutParts
    );

    components.onclick = () => itemTypeChanged(components);
    laserCutParts.onclick = () => itemTypeChanged(laserCutParts);
    sheets.onclick = () => itemTypeChanged(sheets);
    launcherInput.addEventListener("click", () => {
        launcherInput.blur();               // ← REQUIRED
        menu.classList.add("active");

        activeInput.value = lastTypedQuery;

        requestAnimationFrame(() => {
            activeInput.focus({ preventScroll: true });
        });

        if (lastTypedQuery.length >= 2) {
            onActiveSearchInput();
        }
    });

    activeInput.addEventListener("input", debouncedActiveSearch);
    menu.querySelector(".front")?.addEventListener("click", closeMenu);

    runSearch();
});

import "beercss";
import "@utils/theme";
import { Sheet } from "@models/sheet";
import { Component } from "@models/component";
import { LaserCutPart } from "@models/laser-cut-part";
import Fuse, { IFuseOptions } from "fuse.js";
import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Tooltip,
    Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";
import zoomPlugin from "chartjs-plugin-zoom";

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Tooltip,
    Legend,
    zoomPlugin
);

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

let chartInstance: Chart | null = null;

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
   NORMALIZED DATA MODEL
   ========================= */
type SeriesPoint = { x: string; y: number };

type NormalizedHistory = {
    quantity?: SeriesPoint[];
    price?: SeriesPoint[];
    orders?: SeriesPoint[];
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

function sortByDate<T extends { created_at: string }>(entries: T[]): T[] {
    return entries
        .slice()
        .sort(
            (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
        );
}

/* =========================
   HISTORY PARSERS
   ========================= */
function parseQuantity(history?: HistoryResponse<QuantityHistoryEntry>) {
    if (!history?.success) return undefined;
    return sortByDate(history.history_entries).map(e => ({
        x: e.created_at,
        y: e.to_quantity,
    }));
}

function parsePrice(history?: HistoryResponse<PriceHistoryEntry>) {
    if (!history?.success) return undefined;
    return sortByDate(history.history_entries).map(e => ({
        x: e.created_at,
        y: e.to_price,
    }));
}

function parseOrders(history?: HistoryResponse<OrderHistoryEntry>) {
    if (!history?.success) return undefined;

    let pending = 0;
    return sortByDate(history.history_entries).map(e => {
        if (e.details?.new_orders)
            pending += e.details.new_orders.reduce((s, o) => s + o.order_pending_quantity, 0);
        if (e.details?.removed_orders)
            pending -= e.details.removed_orders.reduce((s, o) => s + o.order_pending_quantity, 0);
        return { x: e.created_at, y: pending };
    });
}

function normalizeHistory(history: FullHistoryResponse): NormalizedHistory {
    return {
        quantity: parseQuantity(history.quantity),
        price: parsePrice(history.price),
        orders: parseOrders(history.order),
    };
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

/* =========================
   CHART.JS RENDERER
   ========================= */

function trendColor(ctx: any) {
    const { p0, p1 } = ctx;
    if (!p0 || !p1) return "#999";
    return p1.parsed.y >= p0.parsed.y
        ? "#4caf50"   // increase → green
        : "#f44336";  // decrease → red
}

function renderChart(container: HTMLElement, data: NormalizedHistory) {
    container.innerHTML = `<canvas></canvas>`;
    const ctx = container.querySelector("canvas")!;

    chartInstance?.destroy();

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            datasets: [data.quantity && {

                label: "Quantity",
                data: data.quantity,
                borderColor: "#4caf50",
                pointRadius: 6,
                pointHoverRadius: 5,
                tension: 0.1,

                segment: {
                    borderColor: trendColor,
                },

                // POINT COLORS — match segment trend
                pointBackgroundColor: (ctx: any) => {
                    const i = ctx.dataIndex;
                    const data = ctx.dataset.data;

                    // If only one point, default to neutral
                    if (data.length < 2) return "#4caf50";

                    // First point: compare to second
                    if (i === 0) {
                        return data[1].y >= data[0].y ? "#4caf50" : "#f44336";
                    }

                    // All others: compare previous → current
                    return ctx.parsed.y >= data[i - 1].y ? "#4caf50" : "#f44336";
                },

                pointBorderColor: (ctx: any) => {
                    const i = ctx.dataIndex;
                    const data = ctx.dataset.data;

                    if (data.length < 2) return "#4caf50";

                    if (i === 0) {
                        return data[1].y >= data[0].y ? "#4caf50" : "#f44336";
                    }

                    return ctx.parsed.y >= data[i - 1].y ? "#4caf50" : "#f44336";
                },
            },
            data.price && {
                label: "Price",
                data: data.price,
                borderColor: "#2196f3",
                borderDash: [10, 4],
                borderWidth: 2,
                yAxisID: "y1",
                pointRadius: 6,
                pointHoverRadius: 5,
                tension: 0.1,
            },
            data.orders && {
                label: "Pending Orders",
                data: data.orders,
                borderColor: "#ff9800",
                borderDash: [2, 6],
                borderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 5,
                tension: 0.1,
            },
            ].filter(Boolean) as any[],
        }, options: {
            interaction: {
                mode: "nearest",
                intersect: false,
            },
            scales: {
                x: {
                    type: "time",
                },
                y: {
                    beginAtZero: true,
                },
                y1: {
                    position: "right",
                    grid: { drawOnChartArea: false },
                },
            },
            plugins: {
                legend: {
                    display: true,
                },
                tooltip: {
                    enabled: true,
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: "x",
                        modifierKey: "ctrl", // prevent accidental pans
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true,
                        },
                        mode: "x",
                    },
                },
            },
        },

    });
}

/* =========================
   SEARCH + STATE
   ========================= */

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
    if (!selectedItem) return;

    const type = itemType.querySelector(".active")!.id;
    const id = selectedItem.id;

    const routes: any = {
        components: {
            order: `/get_order_history/component/${id}`,
            quantity: `/get_quantity_history/component/${id}`,
            price: `/get_price_history/component/${id}`,
        },
        sheets: {
            order: `/get_order_history/sheet/${id}`,
            quantity: `/get_quantity_history/sheet/${id}`,
            price: `/get_price_history/sheet/${id}`,
        },
        "laser-cut-parts": {
            quantity: `/get_quantity_history/laser_cut_part/${id}`,
        },
    }[type];

    const [order, quantity, price] = await Promise.all([
        routes.order
            ? fetchJSON<HistoryResponse<OrderHistoryEntry>>(routes.order)
            : Promise.resolve(undefined),

        routes.quantity
            ? fetchJSON<HistoryResponse<QuantityHistoryEntry>>(routes.quantity)
            : Promise.resolve(undefined),

        routes.price
            ? fetchJSON<HistoryResponse<PriceHistoryEntry>>(routes.price)
            : Promise.resolve(undefined),
    ]);

    const normalized = normalizeHistory({ order, quantity, price });

    const container = document.getElementById("visualization")!;
    container.innerHTML = "";
    renderChart(container, normalized);
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
        launcherInput.blur();
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

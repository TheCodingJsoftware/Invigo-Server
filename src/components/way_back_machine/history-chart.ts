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
import { SearchItem } from "@components/way_back_machine/search-inventory";
import zoomPlugin from "chartjs-plugin-zoom";
import { fetchJSON } from "@utils/fetch-json";

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

type SeriesPoint = { x: string; y: number };

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

type NormalizedHistory = {
    quantity?: SeriesPoint[];
    price?: SeriesPoint[];
    orders?: SeriesPoint[];
};


export class HistoryChart {
    private chart: Chart | null = null;

    constructor(public container: HTMLElement) {
        this.container = container;
    }

    private destroy() {
        this.chart?.destroy();
        this.chart = null;
    }

    public renderChart(data: NormalizedHistory) {
        this.destroy();

        this.container.innerHTML = `<canvas></canvas>`;
        const ctx = this.container.querySelector("canvas")!;

        this.chart = new Chart(ctx, {
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
                        borderColor: this.trendColor,
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

    private sortByDate<T extends { created_at: string }>(entries: T[]): T[] {
        return entries
            .slice()
            .sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
            );
    }

    private normalize(history: FullHistoryResponse): NormalizedHistory {
        return {
            quantity: history.quantity?.success
                ? this.sortByDate(history.quantity.history_entries).map(e => ({
                    x: e.created_at,
                    y: e.to_quantity,
                }))
                : undefined,
            price: history.price?.success
                ? this.sortByDate(history.price.history_entries).map(e => ({
                    x: e.created_at,
                    y: e.to_price,
                }))
                : undefined,
            orders: history.order?.success
                ? (() => {
                    let pending = 0;
                    return this.sortByDate(history.order.history_entries).map(e => {
                        pending +=
                            (e.details?.new_orders ?? []).reduce(
                                (s, o) => s + o.order_pending_quantity,
                                0
                            ) -
                            (e.details?.removed_orders ?? []).reduce(
                                (s, o) => s + o.order_pending_quantity,
                                0
                            );
                        return { x: e.created_at, y: pending };
                    });
                })()
                : undefined,
        };
    }

    public async fetchHistory(item: SearchItem): Promise<NormalizedHistory> {
        const base = {
            component: "component",
            sheet: "sheet",
            "laser-cut-part": "laser_cut_part",
        }[item.type];

        // Quantity exists for all inventory types
        const quantity = await fetchJSON<
            HistoryResponse<QuantityHistoryEntry>
        >(`/get_quantity_history/${base}/${item.id}`).catch(() => undefined);

        // Laser cut parts: quantity ONLY
        if (item.type === "laser-cut-part") {
            return this.normalize({ quantity });
        }

        // Components & sheets: full history
        const [order, price] = await Promise.all([
            fetchJSON<HistoryResponse<OrderHistoryEntry>>(
                `/get_order_history/${base}/${item.id}`
            ).catch(() => undefined),
            fetchJSON<HistoryResponse<PriceHistoryEntry>>(
                `/get_price_history/${base}/${item.id}`
            ).catch(() => undefined),
        ]);

        return this.normalize({ order, quantity, price });
    }

    private trendColor(ctx: any) {
        const { p0, p1 } = ctx;
        if (!p0 || !p1) return "#999";
        return p1.parsed.y >= p0.parsed.y
            ? "#4caf50"   // increase → green
            : "#f44336";  // decrease → red
    }
}
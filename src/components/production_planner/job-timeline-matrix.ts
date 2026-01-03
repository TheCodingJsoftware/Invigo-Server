import { Chart, registerables } from "chart.js";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";

Chart.register(...registerables, MatrixController, MatrixElement);

const MS_DAY = 24 * 60 * 60 * 1000;

// === FIXED SIZING (what you asked for) ===
const CELL = 16; // 10x10 squares
const GAP = 2;   // 2px gap between squares

// -------------------- date helpers --------------------
function startOfDayLocal(ts: number): number {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function parseDayTs(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const t = d.getTime();
    if (Number.isNaN(t)) return null;
    return startOfDayLocal(t);
}

function daysInYear(year: number): number {
    const feb29 = new Date(year, 1, 29);
    return feb29.getMonth() === 1 ? 366 : 365;
}

function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
}

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 250) {
    let t: number | undefined;
    return (...args: Parameters<T>) => {
        if (t) window.clearTimeout(t);
        t = window.setTimeout(() => fn(...args), wait);
    };
}

// -------------------- heatmap color --------------------
type RGBA = [number, number, number, number];

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function lerpColor(c1: RGBA, c2: RGBA, t: number): string {
    const r = Math.round(lerp(c1[0], c2[0], t));
    const g = Math.round(lerp(c1[1], c2[1], t));
    const b = Math.round(lerp(c1[2], c2[2], t));
    const a = lerp(c1[3], c2[3], t);
    return `rgba(${r},${g},${b},${a})`;
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

const LOW_GRAY: RGBA = [150, 150, 150, 0.45];   // very light neutral
const GREEN: RGBA = [120, 190, 140, 0.55];   // soft mint green
const YELLOW: RGBA = [245, 220, 160, 0.85];   // warm sand / amber
const RED: RGBA = [235, 160, 150, 0.95];   // muted coral red
const DARK_RED: RGBA = [200, 120, 120, 1.00];   // brick / rose

function heatColor(value: number, maxV: number): string {
    if (!maxV || value <= 0) return `rgba(${LOW_GRAY.join(",")})`;

    let t = clamp(value / maxV, 0, 1);
    t = smoothstep(t);

    if (t < 0.35) {
        const u = smoothstep(t / 0.35);
        return lerpColor(LOW_GRAY, GREEN, u);
    }
    if (t < 0.65) {
        const u = smoothstep((t - 0.35) / 0.30);
        return lerpColor(GREEN, YELLOW, u);
    }
    if (t < 0.85) {
        const u = smoothstep((t - 0.65) / 0.20);
        return lerpColor(YELLOW, RED, u);
    }
    const u = smoothstep((t - 0.85) / 0.15);
    return lerpColor(RED, DARK_RED, u);
}

// -------------------- axis helpers --------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// -------------------- types --------------------
type ApiJobMap = Record<
    string,
    {
        id: number;
        name: string;
        job_data?: {
            starting_date?: string | null;
            ending_date?: string | null;
            flowtag_timeline?: Record<
                string,
                {
                    starting_date?: string | null;
                    ending_date?: string | null;
                    duration_days?: number;
                    before_end_days?: number;
                    after_start_days?: number;
                }
            >;
        };
    }
>;

type HeatCell = { x: number; y: number; v: number; dayTs: number };

type HeatmapResult = {
    cells: HeatCell[];
    minDay: number;
    days: number;
    maxV: number;
    weekOffset: number;
    weeks: number;
    xLabels: string[];
};

type JobTimelineMatrixOptions = {
    endpoint?: string;
    pollMs?: number;
    days?: number;
    windowStart?: "today" | "year";
    weekStart?: "sunday" | "monday";
};

const overloadLegendPlugin = {
    id: "overloadLegend",

    afterDraw(chart: any, _args: any, opts: any) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;

        const title = opts?.title ?? "Overload";
        const labels = opts?.labels ?? ["", "Low", "", "", "High"];

        // Layout
        const pad = 6;
        const inset = 10;     // distance from bottom/right edge
        const barH = 10;

        // Width: don't exceed 260, but also don't exceed available chart width
        const maxW = 260;
        const availW = Math.max(80, chartArea.right - chartArea.left - inset * 2);
        const barW = Math.min(maxW, availW);

        // Text sizing (approx)
        const titleH = 14;
        const labelH = 14;

        // Total legend height
        const legendH = titleH + pad + barH + pad + labelH;

        // Anchor bottom-right inside chartArea
        const x0 = chartArea.right - inset - barW + 15;
        const y0 = chartArea.bottom + 45;

        ctx.save();

        // Optional: subtle background box so it stays readable over cells
        const boxPadX = 8;
        const boxPadY = 6;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(
            x0 - boxPadX,
            y0 - boxPadY,
            barW + boxPadX * 2,
            legendH + boxPadY * 2,
            6
        );
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.font = "12px";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.fillStyle = "#bbb";
        ctx.fillText(title, x0, y0);

        // Gradient bar
        const barY = y0 + titleH + pad;
        const grad = ctx.createLinearGradient(x0, 0, x0 + barW, 0);

        grad.addColorStop(0.0, `rgba(${LOW_GRAY.join(",")})`);
        grad.addColorStop(0.35, `rgba(${GREEN.join(",")})`);
        grad.addColorStop(0.65, `rgba(${YELLOW.join(",")})`);
        grad.addColorStop(0.85, `rgba(${RED.join(",")})`);
        grad.addColorStop(1.0, `rgba(${DARK_RED.join(",")})`);

        ctx.fillStyle = grad;
        ctx.fillRect(x0, barY, barW, barH);

        // Border
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.strokeRect(x0, barY, barW, barH);

        // Labels under bar
        ctx.font = "11px";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#bbb";

        const stops = [0, 0.35, 0.65, 0.85, 1];
        const labelY = barY + barH + pad;

        for (let i = 0; i < stops.length; i++) {
            const s = stops[i];
            const label = labels[i] ?? "";
            if (!label) continue;

            const lx = x0 + barW * s;
            const align =
                i === 0 ? "left" :
                    i === stops.length - 1 ? "right" :
                        "center";

            ctx.textAlign = align;
            ctx.fillText(label, lx, labelY);
        }

        ctx.restore();
    },
};

Chart.register(overloadLegendPlugin);


export class JobTimelineMatrix {
    private readonly canvas: HTMLCanvasElement;
    private chart: Chart | null = null;

    private readonly endpoint: string;
    private readonly pollMs: number;
    private readonly days: number;
    private readonly windowStart: "today" | "year";
    private readonly weekStart: "sunday" | "monday";

    private timer: number | null = null;
    private aborter: AbortController | null = null;
    private lastSignature: string | null = null;

    private readonly refreshDebounced: () => void;

    constructor(canvasId: string, options: JobTimelineMatrixOptions = {}) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvas) throw new Error(`JobTimelineMatrix: canvas #${canvasId} not found`);
        this.canvas = canvas;

        // IMPORTANT: ensure parent scrolls horizontally instead of squishing canvas
        // (You can also do this in HTML/CSS; we do it defensively here.)
        const parent = this.canvas.parentElement;
        if (parent) {
            parent.style.overflowX = "auto";
            parent.style.overflowY = "hidden";
        }
        this.canvas.style.display = "block";

        this.endpoint = options.endpoint ?? "/api/production_planner/job/timeline";
        this.pollMs = options.pollMs ?? 5000;
        this.days = options.days ?? 365;
        this.windowStart = options.windowStart ?? "year";
        this.weekStart = options.weekStart ?? "monday";

        this.refreshDebounced = debounce(() => void this.fetchAndRender(), 250);
    }

    public start() {
        this.stop();
        this.refreshDebounced();
        this.timer = window.setInterval(() => this.refreshDebounced(), this.pollMs);
    }

    public stop() {
        if (this.timer) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
        if (this.aborter) {
            this.aborter.abort();
            this.aborter = null;
        }
    }

    public destroy() {
        this.stop();
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    public async refreshNow() {
        await this.fetchAndRender();
    }

    // -------------------- window + labels --------------------
    private getWindowRange(): { minDay: number; days: number } {
        const year = new Date().getFullYear();

        if (this.windowStart === "today") {
            const minDay = startOfDayLocal(Date.now());
            return { minDay, days: this.days };
        }

        const minDay = startOfDayLocal(new Date(year, 0, 1).getTime());
        const days = daysInYear(year);
        return { minDay, days };
    }

    private mapDayOfWeek(dayTs: number): number {
        const js = new Date(dayTs).getDay(); // 0=Sun..6=Sat
        if (this.weekStart === "sunday") return js;
        return (js + 6) % 7; // monday-start => 0=Mon..6=Sun
    }

    private weekLabels(): string[] {
        return this.weekStart === "sunday"
            ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    }

    private computeWeekOffset(minDay: number): number {
        return this.mapDayOfWeek(minDay);
    }

    private weekIndexFromDayIndex(dayIndex: number, weekOffset: number): number {
        return Math.floor((dayIndex + weekOffset) / 7);
    }

    private computeXLabels(minDay: number, days: number, weekOffset: number): { weeks: number; xLabels: string[] } {
        const year = new Date(minDay).getFullYear();
        const weeks = Math.ceil((days + weekOffset) / 7);
        const labels = new Array<string>(weeks).fill("");

        for (let m = 0; m < 12; m++) {
            const monthStart = startOfDayLocal(new Date(year, m, 1).getTime());
            const dayIndex = Math.floor((monthStart - minDay) / MS_DAY);
            if (dayIndex < 0 || dayIndex >= days) continue;

            const w = clamp(this.weekIndexFromDayIndex(dayIndex, weekOffset), 0, weeks - 1);
            if (!labels[w]) labels[w] = MONTHS[m];
        }

        return { weeks, xLabels: labels };
    }

    // -------------------- polling + render --------------------
    private async fetchAndRender() {
        if (this.aborter) this.aborter.abort();
        this.aborter = new AbortController();

        let json: ApiJobMap;
        try {
            const res = await fetch(this.endpoint, { signal: this.aborter.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            json = (await res.json()) as ApiJobMap;
        } catch (e) {
            if ((e as any)?.name !== "AbortError") console.error("JobTimelineMatrix fetch failed:", e);
            return;
        }

        const signature = this.computeSignature(json);
        if (signature === this.lastSignature) return;
        this.lastSignature = signature;

        const heat = this.buildHeatmap(json);
        this.render(heat);
    }

    private computeSignature(json: ApiJobMap): string {
        const parts: string[] = [];
        const keys = Object.keys(json).sort();

        for (const k of keys) {
            const jd = json[k]?.job_data;
            if (!jd) continue;

            const tl = jd.flowtag_timeline ?? {};
            const fks = Object.keys(tl).sort();

            if (fks.length) {
                for (const fk of fks) {
                    const seg = tl[fk];
                    parts.push(`${k}|${fk}|${seg?.starting_date ?? ""}|${seg?.ending_date ?? ""}`);
                }
            } else {
                parts.push(`${k}|job|${jd.starting_date ?? ""}|${jd.ending_date ?? ""}`);
            }
        }

        return parts.join(";");
    }

    private buildHeatmap(json: ApiJobMap): HeatmapResult {
        const { minDay, days } = this.getWindowRange();

        const windowStart = minDay;
        const windowEnd = minDay + (days - 1) * MS_DAY;

        const weekOffset = this.computeWeekOffset(minDay);
        const { weeks, xLabels } = this.computeXLabels(minDay, days, weekOffset);

        const diff = new Int32Array(days + 1);

        const addRange = (startTs: number, endTs: number) => {
            const start = Math.min(startTs, endTs);
            const end = Math.max(startTs, endTs);

            if (end < windowStart || start > windowEnd) return;

            const clippedStart = Math.max(start, windowStart);
            const clippedEnd = Math.min(end, windowEnd);

            const startIdx = Math.floor((clippedStart - minDay) / MS_DAY);
            const endIdx = Math.floor((clippedEnd - minDay) / MS_DAY);

            if (startIdx < 0 || startIdx >= days) return;

            diff[startIdx] += 1;
            if (endIdx + 1 < diff.length) diff[endIdx + 1] -= 1;
        };

        for (const jobKey of Object.keys(json)) {
            const jd = json[jobKey]?.job_data;
            if (!jd) continue;

            const tl = jd.flowtag_timeline ?? {};
            const flowKeys = Object.keys(tl);

            if (flowKeys.length) {
                for (const fk of flowKeys) {
                    const seg = tl[fk];
                    const s = parseDayTs(seg?.starting_date ?? null);
                    const e = parseDayTs(seg?.ending_date ?? null);
                    if (s == null || e == null) continue;
                    addRange(s, e);
                }
            } else {
                const s = parseDayTs(jd.starting_date ?? null);
                const e = parseDayTs(jd.ending_date ?? null);
                if (s != null && e != null) addRange(s, e);
            }
        }

        const cells: HeatCell[] = [];
        let running = 0;
        let maxV = 0;

        for (let dayIndex = 0; dayIndex < days; dayIndex++) {
            running += diff[dayIndex];
            const v = running;
            if (v > maxV) maxV = v;

            const dayTs = minDay + dayIndex * MS_DAY;
            const x = this.weekIndexFromDayIndex(dayIndex, weekOffset);
            const y = this.mapDayOfWeek(dayTs);

            cells.push({ x, y, v, dayTs });
        }

        return { cells, minDay, days, maxV, weekOffset, weeks, xLabels };
    }

    private applyFixedCanvasWidth(weeks: number) {
        // Each week column consumes: CELL + GAP (except we leave a tiny pad)
        const plotW = weeks * (CELL + GAP);

        // plus left padding for y labels + a little right pad so last col never clips
        const extra = 80; // y-axis label space + breathing room
        this.canvas.width = plotW + extra;

        // Let CSS control height; canvas attribute height is optional.
        // If you want it locked to 7 rows exactly:
        // this.canvas.height = (CELL + GAP) * 7 + 60; // + top/bottom space for x labels
    }

    private render(heat: HeatmapResult) {
        this.applyFixedCanvasWidth(heat.weeks);

        const dataset = {
            label: "Job load",
            data: heat.cells,
            parsing: false as const,
            backgroundColor: (ctx: any) => heatColor(ctx.raw?.v ?? 0, heat.maxV),
            borderWidth: 0,
            borderRadius: 2,

            // FIXED sizing ALWAYS
            width: CELL,
            height: CELL,
        };

        const commonOptions: any = {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { left: 8, right: 16, top: 8, bottom: 70 } },
            plugins: {
                title: {
                    display: true,
                    text: "Process Load Heatmap",
                    padding: { bottom: 6 },
                    font: { size: 14, weight: "500" },
                },

                // your custom gradient legend
                overloadLegend: {
                    title: "Overload",
                    labels: ["", "Low", "Medium", "", "High"], // edit if you want
                },

                legend: { display: false },

                tooltip: {
                    callbacks: {
                        title: (items: any[]) => {
                            const raw = items?.[0]?.raw as HeatCell | undefined;
                            return raw ? new Date(raw.dayTs).toDateString() : "";
                        },
                        label: (item: any) => `Value: ${(item.raw as HeatCell).v}`,
                    },
                },
            },

            scales: {
                x: {
                    type: "category",
                    labels: heat.xLabels,
                    offset: true,
                    grid: { display: false },

                    // ensures category slots are CELL+GAP wide (visually),
                    // because the canvas width is computed from weeks*(CELL+GAP)
                    ticks: {
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0,
                        padding: 6,
                        callback: (val: any) => heat.xLabels?.[Number(val)] ?? "",
                    },
                },
                y: {
                    type: "linear",
                    min: -0.5,
                    max: 6.5,
                    grid: { display: false },
                    ticks: {
                        autoSkip: false,
                        stepSize: 1,
                        maxRotation: 0,
                        minRotation: 0,
                        padding: 6,
                        callback: (v: any) => this.weekLabels()[Number(v)] ?? "",
                    },
                    afterBuildTicks: (axis: any) => {
                        axis.ticks = [0, 1, 2, 3, 4, 5, 6].map((value) => ({ value }));
                    },
                },
            },
        };

        if (!this.chart) {
            this.chart = new Chart(this.canvas, {
                type: "matrix",
                data: { datasets: [dataset as any] },
                options: commonOptions,
            });
        } else {
            this.chart.data.datasets[0].data = heat.cells as any;

            const x = (this.chart.options.scales?.x as any);
            if (x) {
                x.type = "category";
                x.labels = heat.xLabels;
                x.offset = true;
            }

            // keep padding (right clip protection)
            (this.chart.options.layout as any) = commonOptions.layout;

            this.chart.update("none");
        }
    }
}

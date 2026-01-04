import { getBackgroundColor, getOnColor, RGBAToHexA } from "@utils/colors";
import { debounce } from "@utils/debounce";

const MS_DAY = 24 * 60 * 60 * 1000;

// -------------------- date helpers --------------------
function startOfDayLocal(ts: number): number {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function parseDayTs(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const t = new Date(dateStr).getTime();
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

// -------------------- heatmap color --------------------
type RGBA = [number, number, number, number];

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

function lerpColor(c1: RGBA, c2: RGBA, t: number): string {
    const r = Math.round(lerp(c1[0], c2[0], t));
    const g = Math.round(lerp(c1[1], c2[1], t));
    const b = Math.round(lerp(c1[2], c2[2], t));
    const a = lerp(c1[3], c2[3], t);
    return `rgba(${r},${g},${b},${a})`;
}

const LOW_GRAY: RGBA = [150, 150, 150, 0.0]; // very light neutral
const GREEN: RGBA = [120, 190, 140, 0.55]; // soft mint green
const YELLOW: RGBA = [245, 220, 160, 0.85]; // warm sand / amber
const RED: RGBA = [235, 160, 150, 0.95]; // muted coral red
const DARK_RED: RGBA = [200, 120, 120, 1.0]; // brick / rose

const LEGEND_COLORS: readonly RGBA[] = [LOW_GRAY, GREEN, YELLOW, RED, DARK_RED];

function heatColor(value: number, maxV: number): string {
    if (!maxV || value <= 0) return `rgba(${LOW_GRAY.join(",")})`;

    let t = clamp(value / maxV, 0, 1);
    t = smoothstep(t);

    if (t < 0.35) {
        const u = smoothstep(t / 0.35);
        return lerpColor(LOW_GRAY, GREEN, u);
    }

    if (t < 0.65) {
        const u = smoothstep((t - 0.35) / 0.3);
        return lerpColor(GREEN, YELLOW, u);
    }

    if (t < 0.85) {
        const u = smoothstep((t - 0.65) / 0.2);
        return lerpColor(YELLOW, RED, u);
    }

    const u = smoothstep((t - 0.85) / 0.15);
    return lerpColor(RED, DARK_RED, u);
}

// -------------------- axis helpers --------------------
const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
] as const;

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

export class TimelineMatrix {
    private endpoint = "/api/production_planner/job/timeline";
    private pollMs = 5000;

    private days = 365;
    private windowStart = "year";
    private weekStart = "sunday";

    chart: HTMLElement | null = null;

    private timer: number | null = null;
    private aborter: AbortController | null = null;
    private lastSignature: string | null = null;
    private readonly refreshDebounced: () => void;

    private scrollLeft = 0;
    private readonly scrollKey: string;
    private onScroll: ((e: Event) => void) | null = null;

    constructor(private parent: string) {
        this.refreshDebounced = debounce(() => void this.fetchAndRender(), 250);

        const parentElement = document.getElementById(this.parent);
        if (!parentElement) {
            throw new Error(`TimelineMatrix: parent element #${this.parent} not found`);
        }

        this.chart = document.createElement("div");
        this.chart.classList.add("grid");
        parentElement.appendChild(this.chart);

        this.scrollKey = `TimelineMatrix:${this.parent}:xscroll:${this.windowStart}:${this.weekStart}`;
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
        this.chart?.remove();
        this.chart = null;
    }

    public async refreshNow() {
        await this.fetchAndRender();
    }

    private computeSignature(json: ApiJobMap): string {
        const parts: string[] = [];
        const keys = Object.keys(json).sort();

        for (const jobKey of keys) {
            const jd = json[jobKey]?.job_data;
            if (!jd) continue;

            const tl = jd.flowtag_timeline ?? {};
            const flowKeys = Object.keys(tl).sort();

            if (flowKeys.length) {
                for (const fk of flowKeys) {
                    const seg = tl[fk];
                    parts.push(`${jobKey}|${fk}|${seg?.starting_date ?? ""}|${seg?.ending_date ?? ""}`);
                }
                continue;
            }

            parts.push(`${jobKey}|job|${jd.starting_date ?? ""}|${jd.ending_date ?? ""}`);
        }

        return parts.join(";");
    }

    // -------------------- window + labels --------------------
    private getWindowRange(): { minDay: number; days: number } {
        const year = new Date().getFullYear();

        if (this.windowStart === "today") {
            return { minDay: startOfDayLocal(Date.now()), days: this.days };
        }

        const minDay = startOfDayLocal(new Date(year, 0, 1).getTime());
        return { minDay, days: daysInYear(year) };
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

    private computeXLabels(
        minDay: number,
        days: number,
        weekOffset: number
    ): { weeks: number; xLabels: string[] } {
        const year = new Date(minDay).getFullYear();
        const weeks = Math.ceil((days + weekOffset) / 7);
        const xLabels = new Array<string>(weeks).fill("");

        for (let m = 0; m < 12; m++) {
            const monthStart = startOfDayLocal(new Date(year, m, 1).getTime());
            const dayIndex = Math.floor((monthStart - minDay) / MS_DAY);
            if (dayIndex < 0 || dayIndex >= days) continue;

            const w = clamp(this.weekIndexFromDayIndex(dayIndex, weekOffset), 0, weeks - 1);
            if (!xLabels[w]) xLabels[w] = MONTHS[m];
        }

        return { weeks, xLabels };
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
                continue;
            }

            const s = parseDayTs(jd.starting_date ?? null);
            const e = parseDayTs(jd.ending_date ?? null);
            if (s != null && e != null) addRange(s, e);
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

        this.render(this.buildHeatmap(json));
    }

    render(heat: HeatmapResult) {
        const cellSize = 32;

        const saved = this.scrollLeft || Number(localStorage.getItem(this.scrollKey) ?? "0") || 0;

        const content = document.createElement("nav");
        content.className = "s12 scroll group connected top-align bottom-padding small-round";
        content.style.display = "flex";

        // Important: detach old listener (old content element is being replaced)
        this.onScroll = null;

        // Save scrollLeft (debounced)
        const saveScroll = debounce(() => {
            this.scrollLeft = content.scrollLeft;
            localStorage.setItem(this.scrollKey, String(this.scrollLeft));
        }, 100);

        this.onScroll = () => saveScroll();
        content.addEventListener("scroll", this.onScroll, { passive: true });

        this.chart?.replaceChildren(content);

        // Restore scroll position (after attached)
        requestAnimationFrame(() => {
            content.scrollLeft = saved;
        });

        // ---- Fast lookup by local day ----
        const byDay = new Map<number, number>();
        for (const c of heat.cells) {
            byDay.set(startOfDayLocal(c.dayTs), c.v);
        }

        const year = new Date(heat.minDay).getFullYear();
        const weekdayLabels = this.weekLabels(); // respects monday/sunday

        for (let m = 0; m < 12; m++) {
            const first = new Date(year, m, 1);
            const last = new Date(year, m + 1, 0);
            const daysInMonth = last.getDate();

            // start-of-week aware (0 = weekStart)
            const startDow = this.mapDayOfWeek(first.getTime());
            const weekRows = Math.ceil((startDow + daysInMonth) / 7);

            const monthBox = document.createElement("div");
            monthBox.className = "no-margin no-padding grid no-space small-round border";
            monthBox.style.gridTemplateColumns = `repeat(7, ${cellSize}px)`;
            monthBox.style.gridAutoRows = `${cellSize}px`;

            const monthHeader = document.createElement("button");
            monthHeader.className = "chip primary no-border no-margin";
            monthHeader.textContent = MONTHS[m];
            monthHeader.style.gridColumn = "1 / -1";
            monthHeader.style.height = `${cellSize}px`;
            monthBox.appendChild(monthHeader);

            // weekday header row respects weekStart
            for (let d = 0; d < 7; d++) {
                const wd = document.createElement("button");
                wd.className = "fill no-border square no-round no-margin";
                wd.textContent = weekdayLabels[d];
                wd.style.width = `${cellSize}px`;
                wd.style.height = `${cellSize}px`;
                monthBox.appendChild(wd);
            }

            // ---- Data cells (weeks go DOWN) ----
            for (let w = 0; w < weekRows; w++) {
                for (let d = 0; d < 7; d++) {
                    const linear = w * 7 + d;
                    const dayNum = linear - startDow + 1;

                    if (dayNum < 1 || dayNum > daysInMonth) {
                        const empty = document.createElement("div");
                        empty.style.width = `${cellSize}px`;
                        empty.style.height = `${cellSize}px`;
                        monthBox.appendChild(empty);
                        continue;
                    }

                    const date = startOfDayLocal(new Date(year, m, dayNum).getTime());
                    const v = byDay.get(date) ?? 0;

                    const bg = heatColor(v, heat.maxV);

                    const btn = document.createElement("button");
                    btn.className = "chip square small-round no-margin no-padding no-border";
                    btn.style.width = `${cellSize}px`;
                    btn.style.height = `${cellSize}px`;
                    btn.style.background = bg;
                    btn.style.color = getOnColor(bg, { rgbaBackground: getBackgroundColor() });
                    btn.textContent = String(dayNum);

                    const tooltip = document.createElement("div");
                    tooltip.className = "tooltip right";

                    const tooltipDate = new Intl.DateTimeFormat("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    }).format(new Date(date));

                    const tooltipContent = document.createElement("div");
                    tooltipContent.innerHTML = `${tooltipDate}<br>${v} processes`;
                    tooltip.appendChild(tooltipContent);

                    btn.appendChild(tooltip);
                    monthBox.appendChild(btn);
                }
            }

            content.appendChild(monthBox);
        }

        // -------------------- legend container --------------------
        const legendContainer = document.createElement("div");
        legendContainer.className = "s12 row right-align";
        this.chart?.appendChild(legendContainer);

        const legendDiv = document.createElement("article");
        legendDiv.className = "border round surface-container-lowest";

        // -------------------- title --------------------
        const legendTitle = document.createElement("label");
        legendTitle.className = "bold no-line";
        legendTitle.textContent = "Overload";
        legendDiv.appendChild(legendTitle);

        // -------------------- colors row --------------------
        const colorsDiv = document.createElement("nav");
        colorsDiv.className = "group connected";
        legendDiv.appendChild(colorsDiv);

        // -------------------- color boxes --------------------
        LEGEND_COLORS.forEach((rgba, index) => {
            const colorString = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
            const hex = RGBAToHexA(colorString, true);

            const box = document.createElement("button");
            box.className = "chip";
            box.style.background = colorString;
            box.style.color = getOnColor(colorString, { rgbaBackground: getBackgroundColor() });

            if (index === 0) {
                box.textContent = "Low";
                box.classList.add("left-round")
            }
            if (index === Math.floor(LEGEND_COLORS.length / 2)) box.textContent = "Med";
            if (index === LEGEND_COLORS.length - 1) {
                box.textContent = "High";
                box.classList.add("right-round")
            }

            colorsDiv.appendChild(box);
        });

        // -------------------- attach --------------------
        legendContainer.appendChild(legendDiv);
    }
}

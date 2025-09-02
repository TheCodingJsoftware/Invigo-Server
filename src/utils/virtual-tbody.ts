// utils/virtual-tbody.ts
type IdleDeadlineLike = { timeRemaining(): number; didTimeout: boolean };

const requestIdle = (
    cb: (d?: IdleDeadlineLike) => void,
    opts?: { timeout?: number }
): number => {
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") return w.requestIdleCallback(cb, opts);
    return window.setTimeout(() => cb({timeRemaining: () => 0, didTimeout: true}), opts?.timeout ?? 1);
};

export class VirtualTbody<T> {
    private data: T[] = [];
    private start = 0;
    private end = 0;
    private rowMap = new Map<number, HTMLTableRowElement>();
    private topSpacer!: HTMLTableRowElement;
    private bottomSpacer!: HTMLTableRowElement;
    private raf = 0;

    constructor(
        private scrollContainer: HTMLElement,                        // element with overflow:auto
        private tbody: HTMLTableSectionElement,
        private colCount: number,
        private makeRow: (item: T, index: number) => HTMLTableRowElement,
        private opts: { rowHeight?: number; buffer?: number } = {}
    ) {
        this.opts.rowHeight ??= 44;   // px; set to your CSS row height
        this.opts.buffer ??= 8;       // rows of overscan

        this.resetSpacers();
        this.scrollContainer.addEventListener("scroll", this.onScroll, {passive: true});
        window.addEventListener("resize", this.scheduleUpdate, {passive: true});
    }

    setData(data: T[]) {
        this.data = data;
        this.rowMap.clear();
        // Remove everything but spacers
        this.tbody.replaceChildren(this.topSpacer, this.bottomSpacer);
        this.updateWindow(true);
    }

    destroy() {
        this.scrollContainer.removeEventListener("scroll", this.onScroll);
        window.removeEventListener("resize", this.scheduleUpdate);
        cancelAnimationFrame(this.raf);
    }

    // --- internals ---

    private resetSpacers() {
        const mkSpacer = () => {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = this.colCount;
            td.style.padding = "0";
            td.style.border = "0";
            td.style.height = "0px";
            tr.appendChild(td);
            return tr;
        };
        this.topSpacer = mkSpacer();
        this.bottomSpacer = mkSpacer();
        this.tbody.replaceChildren(this.topSpacer, this.bottomSpacer);
    }

    private onScroll = () => this.scheduleUpdate();

    private scheduleUpdate = () => {
        if (this.raf) return;
        this.raf = requestAnimationFrame(() => {
            this.raf = 0;
            this.updateWindow(false);
        }) as unknown as number; // unified with requestIdle fallback type
    };

    private updateWindow(force: boolean) {
        const {rowHeight, buffer} = this.opts;
        const total = this.data.length;
        const vh = this.scrollContainer.clientHeight || window.innerHeight;
        const st = this.scrollContainer.scrollTop;

        const visibleCount = Math.max(1, Math.ceil(vh / rowHeight!));
        const targetStart = Math.max(0, Math.floor(st / rowHeight!) - buffer!);
        const targetEnd = Math.min(total, targetStart + visibleCount + buffer! * 2);

        if (!force && targetStart === this.start && targetEnd === this.end) return;

        this.start = targetStart;
        this.end = targetEnd;

        // Update spacer heights
        (this.topSpacer.firstElementChild as HTMLElement).style.height = `${this.start * rowHeight!}px`;
        (this.bottomSpacer.firstElementChild as HTMLElement).style.height = `${(total - this.end) * rowHeight!}px`;

        // Reconcile rows
        const needed = new Set<number>();
        for (let i = this.start; i < this.end; i++) needed.add(i);

        // Remove rows we no longer need
        for (const [idx, tr] of [...this.rowMap]) {
            if (!needed.has(idx)) {
                tr.remove();
                this.rowMap.delete(idx);
            } else {
                needed.delete(idx); // already present
            }
        }

        if (needed.size === 0) return;

        const frag = document.createDocumentFragment();
        // Insert after topSpacer, in order
        const after = this.topSpacer.nextSibling;

        // Create missing rows in idle slices to avoid jank
        const toCreate = [...needed].sort((a, b) => a - b);
        const createSome = () => {
            const deadline = {timeRemaining: () => 8, didTimeout: false}; // consistent budget
            const budgetEnd = performance.now() + deadline.timeRemaining();

            while (toCreate.length && performance.now() < budgetEnd) {
                const i = toCreate.shift()!;
                const item = this.data[i];
                const tr = this.makeRow(item, i);
                this.rowMap.set(i, tr);
                frag.appendChild(tr);
            }

            if (toCreate.length) {
                // Append what we have and continue next idle slice
                this.tbody.insertBefore(frag, after);
                requestIdle(createSome, {timeout: 50});
            } else {
                this.tbody.insertBefore(frag, after);
            }
        };

        requestIdle(createSome, {timeout: 50});
    }
}

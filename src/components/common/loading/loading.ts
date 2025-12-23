export class Loading {
    private static element: HTMLDivElement;
    private static showTimer: number | null = null;
    private static hideTimer: number | null = null;
    private static shownAt: number | null = null;

    // Tune these
    private static readonly SHOW_DELAY = 250; // ms
    private static readonly MIN_VISIBLE = 300; // ms

    static init() {
        if (this.element) return;

        const loadingDiv = document.createElement("div");
        loadingDiv.classList.add("small-width", "small-height", "fixed", "center", "middle", "hidden");

        const loadingIndicator = document.createElement("div");
        loadingIndicator.classList.add("shape", "loading-indicator", "max", "rotate");

        loadingDiv.appendChild(loadingIndicator);
        document.body.appendChild(loadingDiv);

        this.element = loadingDiv;
    }

    static show() {
        this.init();

        // If already visible or scheduled, do nothing
        if (this.shownAt !== null || this.showTimer !== null) return;

        this.showTimer = window.setTimeout(() => {
            this.showTimer = null;
            this.shownAt = performance.now();
            this.element.classList.remove("hidden");
        }, this.SHOW_DELAY);
    }

    static hide() {
        // Cancel pending show
        if (this.showTimer !== null) {
            clearTimeout(this.showTimer);
            this.showTimer = null;
            return;
        }

        if (this.shownAt === null) return;

        const elapsed = performance.now() - this.shownAt;
        const remaining = this.MIN_VISIBLE - elapsed;

        const doHide = () => {
            this.element.classList.add("hidden");
            this.shownAt = null;
            this.hideTimer = null;
        };

        if (remaining > 0) {
            this.hideTimer = window.setTimeout(doHide, remaining);
        } else {
            doHide();
        }
    }
}

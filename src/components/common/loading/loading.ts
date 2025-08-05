export class Loading {
    private static element: HTMLDivElement;

    static init() {
        if (this.element) return;

        const loadingDiv = document.createElement("div");
        loadingDiv.classList.add("small-width", "small-height", "fixed", "center", "middle");

        const loadingIndicator = document.createElement("div");
        loadingIndicator.classList.add("shape", "loading-indicator", "max", "rotate");

        loadingDiv.appendChild(loadingIndicator);
        loadingDiv.classList.add("hidden");

        document.body.appendChild(loadingDiv);
        this.element = loadingDiv;
    }

    static show() {
        this.init();
        this.element.classList.remove("hidden");
    }

    static hide() {
        if (!this.element) return;
        this.element.classList.add("hidden");
    }
}

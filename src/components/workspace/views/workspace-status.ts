export class WorkspaceStatus {
    private static element: HTMLSpanElement;
    private static textNode: HTMLSpanElement;

    private static currentText = "";
    private static lastSync: number | null = null;
    private static timer: number | null = null;
    private static blurActive = false;

    static init(container: HTMLElement = document.body) {
        if (this.element) return;

        const wrapper = document.createElement("span");
        wrapper.className = "workspace-status fixed bottom right tiny-padding small-round small-text";

        const label = document.createElement("span");
        label.className = "bold";
        label.textContent = "Last sync:";

        this.textNode = document.createElement("span");
        this.textNode.className = "status-text small-margin";
        this.textNode.textContent = "never";

        wrapper.append(label, this.textNode);
        container.appendChild(wrapper);

        this.element = wrapper;

        // periodic refresh
        this.timer = window.setInterval(() => {
            this.render();
        }, 5_000);
    }

    static touch() {
        this.lastSync = Date.now();
        this.render();
    }

    private static render() {
        const text = this.lastSync
            ? this.formatAge(this.lastSync)
            : "never";

        if (text === this.currentText) return;
        this.currentText = text;

        this.textNode.textContent = text;

        // restart pulse animation
        this.textNode.classList.remove("animate");
        void this.textNode.offsetHeight;
        this.textNode.classList.add("animate");
    }

    private static formatAge(ts: number): string {
        const seconds = Math.floor((Date.now() - ts) / 1000);

        if (seconds < 5) return "just now";
        if (seconds < 60) return `${seconds}s ago`;

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        return `${Math.floor(hours / 24)}d ago`;
    }
}

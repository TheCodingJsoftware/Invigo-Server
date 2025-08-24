import {PartData} from "@components/workspace/parts/part-page";

export class TimerButton {
    private readonly data: PartData;
    private readonly element: HTMLButtonElement;
    private readonly icon: HTMLElement;
    private readonly tooltip: HTMLDivElement;

    private isTimerStarted: boolean = false;
    private startTime: number | null = null;
    private intervalId: number | null = null;

    constructor(data: PartData) {
        this.data = data;
        this.element = document.createElement("button");
        this.icon = document.createElement("i");
        this.tooltip = document.createElement("div");

        this.init();
    }

    toggle() {
        if (this.isTimerStarted) {
            this.stop();
        } else {
            this.start();
        }
    }

    onclick(handler: (data: PartData, ev: MouseEvent) => void): this {
        this.element.addEventListener("click", (ev) => {
            this.toggle();
            handler(this.data, ev);
        });
        return this;
    }

    getElement(): HTMLButtonElement {
        return this.element;
    }

    private init() {
        this.element.classList.add("chip", "border", "circle", "timer-btn");

        // icon + label
        this.icon.textContent = "play_arrow";

        // tooltip
        this.tooltip.classList.add("tooltip");
        this.tooltip.textContent = "0s";

        this.element.appendChild(this.icon);
        this.element.appendChild(this.tooltip);

        // Tooltip updates on hover
        this.element.addEventListener("mouseenter", () => this.updateTooltip());
    }

    private start() {
        this.isTimerStarted = true;
        this.startTime = Date.now();
        this.icon.textContent = "stop";
        this.element.classList.add("timing");

        // Update tooltip periodically
        this.intervalId = window.setInterval(() => this.updateTooltip(), 1000);
    }

    private stop() {
        this.isTimerStarted = false;
        this.startTime = null;
        this.icon.textContent = "play_arrow";
        this.element.classList.remove("timing");

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private updateTooltip() {
        if (!this.startTime) {
            this.tooltip.textContent = "0s";
            return;
        }
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        this.tooltip.textContent = `${mins}m ${secs}s`;
    }
}

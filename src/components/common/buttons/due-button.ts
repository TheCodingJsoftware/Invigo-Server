import { PartData } from "@components/workspace/parts/part-container";
import { UserContext } from "@core/auth/user-context";

export class DueButton {
    private readonly text: string;
    private readonly data: PartData;
    private readonly element: HTMLButtonElement;
    readonly #user = UserContext.getInstance().user;

    constructor(text: string, data: PartData) {
        this.text = text
        this.data = data;
        this.element = document.createElement("button");
        this.init();
    }

    init() {
        this.element.className = "chip small-round border blur tiny-margin";
        if (this.data.is_overdue) {
            const icon = document.createElement("i");
            icon.innerHTML = "assignment_late";
            this.element.classList.add("error");
            this.element.classList.remove("blur");
            this.element.appendChild(icon);
        }

        const span = document.createElement("span");
        span.textContent = this.getDueDate(this.data.part_timeline.ending_date);
        this.element.appendChild(span);

        if (!this.data.is_completed) {
            const tooltip = document.createElement("div");
            tooltip.className = "tooltip";
            tooltip.innerHTML = this.formatDateRange(
                this.data.part_timeline.starting_date,
                this.data.part_timeline.ending_date
            );
            this.element.appendChild(tooltip);
        }
    }

    getDueDate(endISO: string): string {
        const end = new Date(endISO);
        const now = new Date();
        const daysRemaining = Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let relativeMsg: string;
        if (daysRemaining > 0) {
            relativeMsg = `Due in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`;
        } else if (daysRemaining === 0) {
            relativeMsg = "Due today";
        } else {
            relativeMsg = `Overdue by ${Math.abs(daysRemaining)} day${daysRemaining !== -1 ? "s" : ""}`;
        }
        return relativeMsg;
    }

    formatDateRange(startISO: string, endISO: string): string {
        const start = new Date(startISO);
        const end = new Date(endISO);

        const formatter = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: start.getFullYear() !== end.getFullYear() ? "numeric" : undefined,
        });

        const startStr = formatter.format(start);
        const endStr = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(end);

        const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        return `
        Scheduled: ${startStr} – ${endStr}<br>
        (${durationDays} day${durationDays !== 1 ? "s" : ""} window)<br>
    `.trim();
    }

    getElement(): HTMLButtonElement {
        return this.element;
    }
}

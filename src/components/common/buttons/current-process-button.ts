import {PartData} from "@components/workspace/parts/part-container";
import {UserContext} from "@core/auth/user-context";
import {PermissionMap, WorkspacePermissions} from "@core/auth/workspace-permissions";

export class CurrentProcessButton {
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
        this.element.className = "small-round border vertical tiny-padding tiny-margin blur";

        if (this.#user.can(WorkspacePermissions.CanSeeProgressBar)) {
            const progress = document.createElement("progress");
            progress.className = "max";
            progress.value = this.data.flowtag_index;
            progress.max = this.data.flowtag.length;
            this.element.appendChild(progress);
        }

        if (this.data.is_overdue) {
            const icon = document.createElement("i");
            icon.innerHTML = "assignment_late";
            this.element.classList.add("error");
            this.element.classList.remove("blur");
            this.element.appendChild(icon);
        } else if (this.data.is_completed) {
            const icon = document.createElement("i");
            icon.innerHTML = "check";
            this.element.appendChild(icon);
        }

        const span = document.createElement("span");
        span.textContent = this.text;
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

    formatDateRange(startISO: string, endISO: string): string {
        const start = new Date(startISO);
        const end = new Date(endISO);
        const now = new Date();

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
        const daysRemaining = Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let relativeMsg: string;
        if (daysRemaining > 0) {
            relativeMsg = `Due in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`;
        } else if (daysRemaining === 0) {
            relativeMsg = "Due today";
        } else {
            relativeMsg = `Overdue by ${Math.abs(daysRemaining)} day${daysRemaining !== -1 ? "s" : ""}`;
        }

        return `
        Scheduled: ${startStr} – ${endStr}<br>
        (${durationDays} day${durationDays !== 1 ? "s" : ""} window)<br>
        ${relativeMsg}
    `.trim();
    }

    getElement(): HTMLButtonElement {
        return this.element;
    }
}

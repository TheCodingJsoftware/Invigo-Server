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
    }

    getElement(): HTMLButtonElement {
        return this.element;
    }
}

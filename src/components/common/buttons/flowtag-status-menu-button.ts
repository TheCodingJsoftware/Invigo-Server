import { PartData } from "@components/workspace/parts/part-page";
import { WorkspaceSettings } from "@core/settings/workspace-settings";

export class FlowtagStatusMenuButton {
    private readonly data: PartData;
    private readonly element: HTMLElement;
    private readonly select: HTMLSelectElement;

    constructor(data: PartData) {
        this.data = data;
        this.element = document.createElement("div");
        this.element.classList.add("field", "label", "suffix", "border", "round");
        this.select = document.createElement("select");
        this.init();
    }

    init() {
        for (const [statusName, flowtagStatus] of Object.entries(WorkspaceSettings.tags[this.data.current_flowtag].statuses)) {
            const option = document.createElement("option");
            option.innerHTML = statusName;
            option.value = statusName;
            this.select.appendChild(option);
        }
        this.select.selectedIndex = this.data.flowtag_status_index;
        this.element.appendChild(this.select);

        const label = document.createElement("label");
        label.textContent = "Status"
        this.element.appendChild(label);

        const arrowDropDown = document.createElement("i");
        arrowDropDown.innerHTML = "arrow_drop_down";
        this.element.appendChild(arrowDropDown);
    }

    selectionchange(handler: (data: PartData) => void): this {
        this.select.addEventListener("change", () => handler(this.data));
        return this;
    }

    getElement(): HTMLElement {
        return this.element;
    }

    getSelectedIndex(): number {
        return this.select.selectedIndex;
    }

    getSelectedStatusKey(): string {
        return this.select.value;
    }
}

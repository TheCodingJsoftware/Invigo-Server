import {PartData} from "@components/workspace/parts/part-container";
import {WorkspaceSettings} from "@core/settings/workspace-settings";

export class IncrementFlowtagButton {
    private readonly data: PartData;
    private readonly element: HTMLButtonElement;

    constructor(data: PartData) {
        this.data = data;
        this.element = document.createElement("button");
        this.init();
    }

    init() {
        const nextProcess = this.data.flowtag[this.data.flowtag_index + 1];
        if (nextProcess) {
            this.element.innerHTML = `
                <i>forward</i>
                <span>Move to ${nextProcess}</span>
            `.trim();
        } else {
            this.element.innerHTML = `
                <i>check</i>
                <span>Finished</span>
            `.trim();
        }

        if (nextProcess) {
            if (WorkspaceSettings.tags[this.data.current_flowtag].attribute.next_flow_tag_message) {
                const tooltip = document.createElement("div");
                tooltip.classList.add("tooltip", "left");
                tooltip.innerHTML = WorkspaceSettings.tags[this.data.current_flowtag].attribute.next_flow_tag_message;
                this.element.appendChild(tooltip);
            }
        }
    }

    onclick(handler: (data: PartData, ev: MouseEvent) => void): this {
        this.element.addEventListener("click", (ev) => handler(this.data, ev));
        return this;
    }

    getElement(): HTMLButtonElement {
        return this.element;
    }
}

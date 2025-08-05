import {DialogComponent} from "@components/common/dialog/dialog-component";
import {BooleanSettingKey, WorkspaceFilter} from "@models/workspace-filter";

interface SwitchConfig {
    title: string;
    description?: string;
    settingKey: BooleanSettingKey;
    iconOn?: string;
    iconOff?: string;
}

export class FilterDialog extends DialogComponent {
    workspaceFilterSettings: WorkspaceFilter
    private readonly bodyContent: HTMLDivElement;
    readonly applyButton: HTMLButtonElement;

    constructor(workspaceFilterSettings: WorkspaceFilter) {
        super({
            id: "filter-dialog",
            title: "Filter",
            position: "right",
            bodyContent: `<div class="filter-body"></div>`,
            footerContent: `
            <nav class="row right-align">
                <button id="apply-button">
                    <i>check</i>
                    <span>Apply</span>
                </button>
            </nav>
            `
        });

        this.workspaceFilterSettings = workspaceFilterSettings;
        this.bodyContent = super.query<HTMLDivElement>(".filter-body") as HTMLDivElement;
        this.applyButton = super.query<HTMLButtonElement>("#apply-button") as HTMLButtonElement;

        this.initialize();
    }

    initialize() {
        this.loadSettings();
    }

    createWorkspaceSwitch(config: SwitchConfig): HTMLElement {
        const { title, description, settingKey, iconOn, iconOff } = config;

        const container = document.createElement("div");
        container.className = "field middle-align";

        const nav = document.createElement("nav");
        container.appendChild(nav);

        const maxDiv = document.createElement("div");
        maxDiv.className = "max";

        const heading = document.createElement("h6");
        heading.textContent = title;
        maxDiv.appendChild(heading);

        if (description) {
            const desc = document.createElement("div");
            desc.textContent = description;
            maxDiv.appendChild(desc);
        }

        nav.appendChild(maxDiv);

        const label = document.createElement("label");
        label.className = iconOn && iconOff ? "switch icon" : "switch";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = WorkspaceFilter[settingKey];

        input.addEventListener("change", () => {
            WorkspaceFilter[settingKey] = input.checked;
        });

        label.appendChild(input);

        const span = document.createElement("span");

        if (iconOn && iconOff) {
            const iconOffEl = document.createElement("i");
            iconOffEl.textContent = iconOff;
            span.appendChild(iconOffEl);

            const iconOnEl = document.createElement("i");
            iconOnEl.textContent = iconOn;
            span.appendChild(iconOnEl);
        }

        label.appendChild(span);
        nav.appendChild(label);

        return container;
    }

    private loadSettings(){
        const showCompletedSwitch = this.createWorkspaceSwitch({
            title: "Show Completed",
            description: "Show completed parts or assemblies",
            settingKey: "showCompleted",
        });

        this.bodyContent.appendChild(showCompletedSwitch);
    }
}

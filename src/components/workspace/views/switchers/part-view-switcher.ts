import {PartViewConfig, PartViewMode} from "@config/part-view-mode";
import {WorkspacePermissions} from "@core/auth/workspace-permissions";
import {ViewSettingsManager} from "@core/settings/view-settings";
import {ViewBus} from "@components/workspace/views/view-bus";
import {UserContext} from "@core/auth/user-context";

export class PartViewSwitcher {
    element!: HTMLElement;
    readonly #user = Object.freeze(UserContext.getInstance().user);

    constructor() {
        this.element = document.createElement("header");
    }

    initialize() {
        this.render();
    }

    render() {
        const div = document.createElement("div");
        div.id = "part-view-switcher";
        div.classList.add("tabs", "center-align");

        Object.values(PartViewMode).forEach(mode => {
            // if (!this.#user.can(WorkspacePermissions[mode])) {
            //     return;
            // }
            const button = document.createElement("a");
            button.dataset.target = mode;
            button.dataset.ui = PartViewConfig[mode].dbView;
            button.innerHTML = `
                <i>${PartViewConfig[mode].icon}</i>
                <span>${PartViewConfig[mode].label}</span>
            `;
            button.addEventListener("click", () => {
                this.update(mode);
            });
            div.appendChild(button);
        });

        // const savedView = ViewSettingsManager.get().lastActivePartView;
        // const savedButton = div.querySelector(`a[data-target="${savedView}"]`) as HTMLElement;
        // if (savedButton) {
        //     savedButton.classList.add("active");
        //     ViewBus.update({ viewMode: savedView });
        // }

        this.element.appendChild(div);
        return this.element;
    }

    update(mode: PartViewMode) {
        const nav = this.element.querySelector("#part-view-switcher") as HTMLElement;
        nav.querySelectorAll("a").forEach(button => {
            button.classList.remove("active");
            if (button.dataset.target === mode) {
                button.classList.add("active");
                // ViewSettingsManager.set({ lastActivePartView: mode });
                // ViewBus.update({ viewMode: mode });
            }
        });
    }
}

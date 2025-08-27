import {JobViewConfig, JobViewMode} from "@config/job-view-mode";
import {WorkspacePermissions} from "@core/auth/workspace-permissions";
import {ViewSettingsManager} from "@core/settings/view-settings";
import {ViewBus} from "@components/workspace/views/view-bus";
import {UserContext} from "@core/auth/user-context";

export class JobViewSwitcher {
    element: HTMLElement;
    readonly #user = Object.freeze(UserContext.getInstance().user);

    constructor() {
        this.element = document.createElement("header");
    }

    initialize() {
        this.render();
    }

    render() {
        const div = document.createElement("div");
        div.id = "job-view-switcher";
        div.classList.add("tabs", "center-align");

        Object.values(JobViewMode).forEach(mode => {
            // if (!this.#user.can(WorkspacePermissions[mode])) {
            //     return;
            // }
            const button = document.createElement("a");
            button.dataset.target = mode;
            button.dataset.ui = JobViewConfig[mode].dbView;
            button.innerHTML = `
                <i>${JobViewConfig[mode].icon}</i>
                <span>${JobViewConfig[mode].label}</span>
            `;
            button.addEventListener("click", () => {
                this.update(mode);
            });
            div.appendChild(button);
        });

        // const savedView = ViewSettingsManager.get().lastActiveJobView;
        // const savedButton = div.querySelector(`a[data-target="${savedView}"]`) as HTMLElement;
        // if (savedButton) {
        //     savedButton.classList.add("active");
        //     ViewBus.update({viewMode: savedView});
        // }

        this.element.appendChild(div);
        return this.element;
    }

    update(mode: JobViewMode) {
        const nav = this.element.querySelector("#job-view-switcher") as HTMLElement;
        nav.querySelectorAll("a").forEach(button => {
            button.classList.remove("active");
            if (button.dataset.target === mode) {
                button.classList.add("active");
                // ViewSettingsManager.set({lastActiveJobView: mode});
                // ViewBus.update({viewMode: mode});
            }
        });
    }
}

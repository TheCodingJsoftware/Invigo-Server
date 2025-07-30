import {DataTypeSwitcherConfig, DataTypeSwitcherMode} from "@config/data-type-mode";
import {Permissions} from "@core/auth/permissions";
import {ViewSettingsManager} from "@core/settings/view-settings";
import {ViewBus} from "@components/workspace/views/view-bus";
import {UserContext} from "@core/auth/user-context";

export class DataTypeSwitcher {
    element!: HTMLElement;
    readonly #user = Object.freeze(UserContext.getInstance().user);

    constructor() {
        this.element = document.createElement("header");
    }

    initialize() {
        this.render();
    }

    render() {
        const nav = document.createElement("nav");
        nav.classList.add("tabbed", "primary-container");
        nav.id = "data-type-switcher";

        Object.values(DataTypeSwitcherMode).forEach(mode => {
            if (!this.#user.can(Permissions[mode])) {
                return;
            }
            const button = document.createElement("a");
            button.dataset.target = mode;
            button.innerHTML = `
                <i>${DataTypeSwitcherConfig[mode].icon}</i>
                <span>${DataTypeSwitcherConfig[mode].label}</span>
            `;
            button.addEventListener("click", () => {
                this.update(mode);
            });
            nav.appendChild(button);
        });

        const savedView = ViewSettingsManager.get().lastActiveDataType;
        const savedButton = nav.querySelector(`a[data-target="${savedView}"]`) as HTMLElement;
        if (savedButton) {
            savedButton.classList.add("active");
            ViewBus.update({ dataType: savedView });
        }

        this.element.appendChild(nav);
        return this.element;
    }

    update(mode: DataTypeSwitcherMode) {
        const nav = this.element.querySelector("#data-type-switcher") as HTMLElement;
        nav.querySelectorAll("a").forEach(button => {
            button.classList.remove("active");
            if (button.dataset.target === mode) {
                button.classList.add("active");
                ViewSettingsManager.set({ lastActiveDataType: mode });
                ViewBus.update({ dataType: mode });
            }
        });
    }
}

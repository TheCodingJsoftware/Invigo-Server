import "beercss";
import "@static/css/workspace.css";
import { FilterMenuButton } from "@components/common/buttons/filter-menu-button";
import { SortMenuButton } from "@components/common/buttons/sort-menu-button";
import { DialogComponent } from "@components/common/dialog/dialog-component";
import { SearchInput } from "@components/common/input/search-input";
import { PartContainer } from "@components/workspace/parts/part-container";
import { ViewSwitcherPanel } from "@components/workspace/views/switchers/view-switcher-panel";
import { ViewBus, ViewChangePayload } from "@components/workspace/views/view-bus";
import { DataTypeSwitcherMode } from "@config/data-type-mode";
import { UserContext } from '@core/auth/user-context';
import { SessionSettingsManager } from "@core/settings/session-settings";
import { ViewSettingsManager } from "@core/settings/view-settings";
import { WorkspaceSettings } from "@core/settings/workspace-settings";
import { WorkspaceWebSocket } from "@core/websocket/workspace-websocket";
import { BooleanSettingKey, WorkspaceFilter } from "@models/workspace-filter";
import { loadAnimationStyleSheet } from "@utils/theme"
import { DateRangeButton } from "@components/common/buttons/date-range-button";
import { SheetSettingsModel } from "@core/settings/sheet-settings-model";
import { ToggleButton } from "@components/common/buttons/toggle-button";
import { AppearanceDialog } from "@components/common/dialog/appearance-dialog";

let pageLoaded = false;


class PageHost {
    readonly element: HTMLElement;
    private partPage: PartContainer;

    constructor() {
        this.element = document.createElement("section");
        this.partPage = new PartContainer();
    }

    initialize() {
        ViewBus.subscribe(view => this.render(view));
        this.render(ViewBus.getState());

        this.element.appendChild(this.partPage.element);
    }

    private render(view: ViewChangePayload) {
        if (!pageLoaded) {
            return;
        }
        this.element.innerHTML = "";

        switch (view.dataType) {
            case DataTypeSwitcherMode.Part:
                this.renderPartPage();
                break;
            case DataTypeSwitcherMode.Assembly:
                this.renderAssemblyPage();
                break;
            case DataTypeSwitcherMode.Job:
                this.renderJobPage();
                break;
        }
        ViewSettingsManager.set({ lastActiveDataType: view.dataType });
        SessionSettingsManager.set({
            lastActiveDataType: view.dataType,
        });
    }

    private async renderJobPage() {
        const page = document.createElement("div");
        page.textContent = `Job Page`;
        this.element.appendChild(page);
    }

    private async renderPartPage() {
        if (!this.element.contains(this.partPage.element)) {
            this.element.appendChild(this.partPage.element);
        }

        // morphdom will handle all the smart updates from here
        await this.partPage.load();
    }

    private renderAssemblyPage() {
        const page = document.createElement("div");
        page.textContent = `Assembly Page`;
        this.element.appendChild(page);
    }
}

class WorkspacePage {
    mainElement: HTMLElement;
    readonly #user = Object.freeze(UserContext.getInstance().user);
    private viewSwitcherPanel: ViewSwitcherPanel;
    private pageHost: PageHost;
    private workspaceFilterSettings: WorkspaceFilter = new WorkspaceFilter();
    private searchInput!: SearchInput;

    constructor() {
        this.mainElement = document.querySelector("main") as HTMLElement;
        this.pageHost = new PageHost();
        this.viewSwitcherPanel = new ViewSwitcherPanel();
        this.initialize();
    }

    initialize() {
        WorkspaceWebSocket.connect();
        WorkspaceWebSocket.onReconnect(() => {
            this.resyncState();
        });

        this.loadHeader();
        this.loadTopNav();
        this.loadRightNav();
        this.loadLeftNav();
        pageLoaded = true;
        ViewBus.update({
            dataType: SessionSettingsManager.get().lastActiveDataType,
        });
    }

    resyncState() {
        ViewBus.update({
            dataType: SessionSettingsManager.get().lastActiveDataType,
        });
    }

    loadHeader() {
        this.viewSwitcherPanel.initialize();
        this.pageHost.initialize();
        this.mainElement.appendChild(this.viewSwitcherPanel.element);
        this.mainElement.appendChild(this.pageHost.element);
    }

    loadTopNav() {
        const nav = document.createElement("nav");
        nav.className = "tiny-space fixed top transparent";

        const toolbar = document.createElement("nav");
        toolbar.className = "toolbar medium-elevate blur"

        const headline = document.createElement("h6");
        headline.className = "max left-align m l";
        headline.innerText = "Workspace";

        const themeButton = document.createElement("button");
        themeButton.id = "theme-button";
        themeButton.classList.add("circle", "transparent");
        themeButton.innerHTML = "<i>palette</i>"
        themeButton.onclick = () => this.appearanceDialog();

        const filterButton = new FilterMenuButton();
        filterButton.onToggle.connect(({ key, value }) => {
            this.resyncState();
        })

        const sortButton = new SortMenuButton();
        sortButton.onToggle.connect(({ key, value }) => {
            this.resyncState();
        });

        const dateRangeButton = new DateRangeButton();

        if (SearchInput.element) {
            SearchInput.onChange.connect(() => {
                this.resyncState();
            })
            SearchInput.onSearch.connect(() => {
                this.resyncState();
            })
            toolbar.appendChild(SearchInput.element);
        }
        nav.appendChild(toolbar);
        toolbar.appendChild(dateRangeButton.button);
        toolbar.appendChild(sortButton.button);
        toolbar.appendChild(filterButton.button);
        toolbar.appendChild(themeButton);

        document.body.appendChild(nav);
    }

    loadRightNav() {
        const nav = document.createElement("nav");
        nav.classList.add("right", "min", "m", "l", "no-space");
        //
        // const materialsFieldset = document.createElement("fieldset");
        // materialsFieldset.classList.add("surface-container", "small-round", "small-width");
        // const materialsLegend = document.createElement("legend");
        // materialsLegend.innerText = "Materials";
        // materialsFieldset.appendChild(materialsLegend);
        //
        // const materialsContainer = document.createElement("div");
        // materialsContainer.className = "grid no-space"
        //
        // materialsFieldset.appendChild(materialsContainer);

        for (const material of SheetSettingsModel.materials) {
            const key = `show_material:${material}` as BooleanSettingKey;
            // @ts-ignore
            const checkbox = new ToggleButton(material, material, WorkspaceFilter[key]);
            checkbox.element.classList.add("responsive", "no-margin", "hidden");
            checkbox.element.dataset.filterType = "material";

            checkbox.onChange = (val: boolean) => {
                // @ts-ignore
                WorkspaceFilter[key] = val;
                this.resyncState();
            };

            nav.appendChild(checkbox.element);
        }

        //
        // const thicknessFieldset = document.createElement("fieldset");
        // thicknessFieldset.classList.add("surface-container", "small-round", "small-width");
        // const thicknessLegend = document.createElement("legend");
        // thicknessLegend.innerText = "Thicknesses";
        // thicknessFieldset.appendChild(thicknessLegend);
        // const thicknessContainer = document.createElement("div");
        // thicknessContainer.className = "grid no-space"
        // thicknessFieldset.appendChild(thicknessContainer);
        const spacer = document.createElement("hr");
        spacer.className = "small-margin";
        nav.appendChild(spacer);

        for (const thickness of SheetSettingsModel.thicknesses) {
            const key = `show_thickness:${thickness}` as BooleanSettingKey;
            // @ts-ignore
            const checkbox = new ToggleButton(thickness, thickness, WorkspaceFilter[key]);
            checkbox.element.classList.add("responsive", "hidden");
            checkbox.element.dataset.filterType = "thickness";

            checkbox.onChange = (val: boolean) => {
                // @ts-ignore
                WorkspaceFilter[key] = val;
                this.resyncState();
            };

            nav.appendChild(checkbox.element);
        }

        // nav.appendChild(materialsFieldset);
        // nav.appendChild(thicknessFieldset);

        document.body.appendChild(nav);
    }

    loadLeftNav() {
        const nav = document.createElement("nav");
        nav.classList.add("left", "min", "m", "l");
        const homeButton = document.createElement("a");
        homeButton.innerHTML = `
            <i>home</i>
            <span>Home</span>
        `
        homeButton.href = "/";

        const profileButton = document.createElement("a");
        profileButton.innerHTML = `
            <i>person</i>
            <span>Profile</span>
        `
        profileButton.onclick = () => this.showProfile();


        nav.appendChild(homeButton);
        nav.appendChild(profileButton);
        document.body.appendChild(nav);
    }

    appearanceDialog() {
        new AppearanceDialog();
    }

    showProfile() {
        new DialogComponent({
            id: "profile-dialog",
            title: this.#user.name,
            position: "left",
            bodyContent: `
                    <fieldset class="wrap small-round surface-container">
                        <legend>Roles</legend>
                        <nav class = "row no-space wrap">
                            ${this.#user.roles.map(role => `
                            <button class="chip tiny-margin">
                                <i>assignment_ind</i>
                                <span>${role}</span>
                            </button>
                            `).join("")}
                        </nav>
                    </fieldset>
                    <fieldset class="wrap small-round surface-container">
                        <legend>Permissions</legend>
                            <ul class="list border">
                                ${this.#user.permissions.map(permission => `
                                <li>
                                    <div class="max">
                                        <span class="bold">${permission.label}</span>
                                        <div>${permission.description}</div>
                                    </div>
                                </li>
                                `).join("")}
                            </ul>
                    </fieldset>`,
        }
        );
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    loadAnimationStyleSheet();
    await SheetSettingsModel.init();
    await WorkspaceSettings.init();
    await UserContext.init();

    await Promise.all([
        WorkspaceFilter.init(),
        SearchInput.init()
    ]);

    new WorkspacePage();
});
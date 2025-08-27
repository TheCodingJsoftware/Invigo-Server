import "beercss";
import '@static/css/style.css';
import '@static/css/theme.css';
import {FilterMenuButton} from "@components/common/buttons/filter-menu-button";
import {SortMenuButton} from "@components/common/buttons/sort-menu-button";
import {DialogComponent} from "@components/common/dialog/dialog-component";
import {SearchInput} from "@components/common/input/search-input";
import {PartContainer} from "@components/workspace/parts/part-container";
import {ViewSwitcherPanel} from "@components/workspace/views/switchers/view-switcher-panel";
import {ViewBus, ViewChangePayload} from "@components/workspace/views/view-bus";
import {DataTypeSwitcherMode} from "@config/data-type-mode";
import {UserContext} from '@core/auth/user-context';
import {SessionSettingsManager} from "@core/settings/session-settings";
import {ViewSettingsManager} from "@core/settings/view-settings";
import {WorkspaceSettings} from "@core/settings/workspace-settings";
import {WorkspaceWebSocket} from "@core/websocket/workspace-websocket";
import {BooleanSettingKey, WorkspaceFilter} from "@models/workspace-filter";
import {invertImages, loadAnimationStyleSheet, loadTheme, toggleTheme} from "@utils/theme"
import {DateRangeButton} from "@components/common/buttons/date-range-button";
import {SheetSettingsModel} from "@core/settings/sheet-settings-model";
import {ToggleButton} from "@components/common/buttons/toggle-button";

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
        ViewSettingsManager.set({lastActiveDataType: view.dataType});
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
        this.element.innerHTML = "";
        this.element.appendChild(this.partPage.element);
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
        this.loadThemeSettings();
        this.registerSocketHandlers();
        pageLoaded = true;
        ViewBus.update({
            dataType: SessionSettingsManager.get().lastActiveDataType,
        });
    }

    resyncState() {
        // this.mainElement.innerHTML = "";
        ViewBus.update({
            dataType: SessionSettingsManager.get().lastActiveDataType,
        });
    }

    registerSocketHandlers() {
        // WorkspaceWebSocket.on("job_created", ({ job }) => this.addJob(job));
        // WorkspaceWebSocket.on("job_updated", ({ job }) => this.updateJob(job));
        // WorkspaceWebSocket.on("job_deleted", ({ job_id }) => this.removeJob(job_id));
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

        const themeToggleButton = document.createElement("button");
        themeToggleButton.id = "theme-toggle";
        themeToggleButton.classList.add("circle", "transparent");
        themeToggleButton.innerHTML = "<i>dark_mode</i>"

        const filterButton = new FilterMenuButton();
        filterButton.onToggle.connect(({key, value}) => {
            this.resyncState();
        })

        const sortButton = new SortMenuButton();
        sortButton.onToggle.connect(({key, value}) => {
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
        toolbar.appendChild(themeToggleButton);

        document.body.appendChild(nav);
    }

    loadRightNav() {
        const nav = document.createElement("nav");
        nav.classList.add("right", "min");

        const materialsFieldset = document.createElement("fieldset");
        materialsFieldset.classList.add("surface-container", "small-round");
        const materialsLegend = document.createElement("legend");
        materialsLegend.innerText = "Materials";
        materialsFieldset.appendChild(materialsLegend);

        const materialsContainer = document.createElement("div");
        materialsContainer.className = "grid no-space"

        materialsFieldset.appendChild(materialsContainer);

        for (const material of SheetSettingsModel.materials) {
            const key = `show_material:${material}` as BooleanSettingKey;
            // @ts-ignore
            const checkbox = new ToggleButton(material, material, WorkspaceFilter[key]);
            checkbox.element.classList.add("s12", "m12", "l12", "tiny-margin");

            checkbox.onChange = (val: boolean) => {
                // @ts-ignore
                WorkspaceFilter[key] = val;
                this.resyncState();
            };

            materialsContainer.appendChild(checkbox.element);
        }


        const thicknessFieldset = document.createElement("fieldset");
        thicknessFieldset.classList.add("surface-container", "small-round");
        const thicknessLegend = document.createElement("legend");
        thicknessLegend.innerText = "Thicknesses";
        thicknessFieldset.appendChild(thicknessLegend);
        const thicknessContainer = document.createElement("div");
        thicknessContainer.className = "grid no-space"
        thicknessFieldset.appendChild(thicknessContainer);
        for (const thickness of SheetSettingsModel.thicknesses) {
            const key = `show_thickness:${thickness}` as BooleanSettingKey;
            // @ts-ignore
            const checkbox = new ToggleButton(thickness, thickness, WorkspaceFilter[key]);
            checkbox.element.classList.add("s6", "m6", "l6", "tiny-margin");

            checkbox.onChange = (val: boolean) => {
                // @ts-ignore
                WorkspaceFilter[key] = val;
                this.resyncState();
            };

            thicknessContainer.appendChild(checkbox.element);
        }

        nav.appendChild(materialsFieldset);
        nav.appendChild(thicknessFieldset);

        document.body.appendChild(nav);
    }

    loadLeftNav() {
        const nav = document.createElement("nav");
        nav.classList.add("left", "min");
        const homeButton = document.createElement("button");
        homeButton.className = "square round extra";
        const homeIcon = document.createElement("i");
        homeIcon.innerText = "home";
        homeButton.appendChild(homeIcon);
        homeButton.onclick = () => window.location.href = "/";

        const profileButton = document.createElement("button");
        profileButton.classList.add("border", "large", "circle");
        profileButton.innerHTML = `
            <i>person</i>
        `
        profileButton.onclick = () => this.showProfile();


        nav.appendChild(homeButton);
        nav.appendChild(profileButton);
        document.body.appendChild(nav);
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
                                        <h6 class="small">${permission.label}</h6>
                                        <div>${permission.description}</div>
                                    </div>
                                </li>
                                `).join("")}
                            </ul>
                    </fieldset>`,
            }
        );
    }

    loadThemeSettings() {
        const toggleThemeButton = document.getElementById('theme-toggle') as HTMLButtonElement;
        const toggleThemeIcon = toggleThemeButton.querySelector('i') as HTMLElement;
        toggleThemeIcon.innerText = ui("mode") === "dark" ? "light_mode" : "dark_mode";

        toggleThemeButton.addEventListener('click', () => {
            toggleTheme();
            invertImages();
            toggleThemeIcon.innerText = ui("mode") === "dark" ? "light_mode" : "dark_mode";
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    loadTheme(localStorage.getItem("mode") || "dark");
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
import "beercss";
import '@static/css/style.css';
import '@static/css/theme.css';
import { FilterMenuButton } from "@components/common/buttons/filter-menu-button";
import { SortMenuButton } from "@components/common/buttons/sort-menu-button";
import { DialogComponent } from "@components/common/dialog/dialog-component";
import { SearchInput } from "@components/common/input/search-input";
import { PartPage } from "@components/workspace/parts/part-page";
import { ViewSwitcherPanel } from "@components/workspace/views/switchers/view-switcher-panel";
import { ViewBus, ViewChangePayload } from "@components/workspace/views/view-bus";
import { AssemblyViewMode } from "@config/assembly-view-mode";
import { DataTypeSwitcherMode } from "@config/data-type-mode";
import { JobViewMode } from "@config/job-view-mode";
import { NestViewMode } from "@config/nest-view-mode";
import { PartViewMode } from "@config/part-view-mode";
import { UserContext } from '@core/auth/user-context';
import { SessionSettingsManager } from "@core/settings/session-settings";
import { ViewSettingsManager } from "@core/settings/view-settings";
import { WorkspaceSettings } from "@core/settings/workspace-settings";
import { WorkspaceWebSocket } from "@core/websocket/workspace-websocket";
import { WorkspaceFilter } from "@models/workspace-filter";
import { loadAnimationStyleSheet, toggleTheme, loadTheme, invertImages } from "@utils/theme"
import {DateRangeButton} from "@components/common/buttons/date-range-button";

let pageLoaded = false;


class PageHost {
    readonly element: HTMLElement;
    private partPage: PartPage;

    constructor() {
        this.element = document.createElement("section");
        this.partPage = new PartPage();
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
                this.renderPartPage(ViewSettingsManager.get().lastActivePartView);
                break;
            case DataTypeSwitcherMode.Assembly:
                this.renderAssemblyPage(ViewSettingsManager.get().lastActiveAssemblyView);
                break;
            case DataTypeSwitcherMode.Nest:
                this.renderNestPage(ViewSettingsManager.get().lastActiveNestView);
                break;
            case DataTypeSwitcherMode.Job:
                this.renderJobPage(ViewSettingsManager.get().lastActiveJobView);
                break;
        }
        ViewSettingsManager.set({ lastActiveDataType: view.dataType });
        SessionSettingsManager.set({
            lastActiveDataType: view.dataType,
            lastActiveView: view.viewMode,
        });
    }

    private async renderJobPage(mode: JobViewMode) {
        const page = document.createElement("div");
        page.textContent = `Job Page: ${mode}`;
        this.element.appendChild(page);
    }

    private async renderPartPage(mode: PartViewMode) {
        this.element.innerHTML = "";
        this.element.appendChild(this.partPage.element);
        await this.partPage.load(mode);
    }

    private renderAssemblyPage(mode: AssemblyViewMode) {
        const page = document.createElement("div");
        page.textContent = `Assembly Page: ${mode}`;
        this.element.appendChild(page);
    }

    private renderNestPage(mode: NestViewMode) {
        const page = document.createElement("div");
        page.textContent = `Nest Page: ${mode}`;
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
        this.loadThemeSettings();
        this.registerSocketHandlers();
        pageLoaded = true;
        ViewBus.update({ dataType: SessionSettingsManager.get().lastActiveDataType, viewMode: SessionSettingsManager.get().lastActiveView });
    }

    resyncState() {
        // this.mainElement.innerHTML = "";
        ViewBus.update({ dataType: SessionSettingsManager.get().lastActiveDataType, viewMode: SessionSettingsManager.get().lastActiveView });
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
        nav.classList.add("top", "row");

        const homeButton = document.createElement("button");
        homeButton.classList.add("square", "round", "extra");
        const homeIcon = document.createElement("i");
        homeIcon.innerText = "home";
        homeButton.appendChild(homeIcon);
        homeButton.onclick = () => window.location.href = "/";

        const headline = document.createElement("h6");
        headline.classList.add("max", "left-align");
        headline.innerText = "Workspace";

        const themeToggleButton = document.createElement("button");
        themeToggleButton.id = "theme-toggle";
        themeToggleButton.classList.add("circle", "transparent");
        themeToggleButton.innerHTML = "<i>dark_mode</i>"

        const filterButton = new FilterMenuButton();
        filterButton.onToggle.connect(({ key, value }) => {
            this.resyncState();
        })

        const sortButton = new SortMenuButton();
        sortButton.onToggle.connect(({ key, value }) => {
            this.resyncState();
        });

        const dateRangeButton = new DateRangeButton();

        const profileButton = document.createElement("button");
        profileButton.classList.add("border", "large", "circle");
        profileButton.innerHTML = `
            <i>person</i>
        `
        profileButton.onclick = () => this.showProfile();

        nav.appendChild(homeButton); 2
        nav.appendChild(headline);
        if (SearchInput.element) {
            SearchInput.onChange.connect(() => {
                this.resyncState();
            })
            SearchInput.onSearch.connect(() => {
                this.resyncState();
            })
            nav.appendChild(SearchInput.element);
        }
        nav.appendChild(dateRangeButton.button);
        nav.appendChild(sortButton.button);
        nav.appendChild(filterButton.button);
        nav.appendChild(themeToggleButton);
        nav.appendChild(profileButton);

        document.body.appendChild(nav);
    }

    showProfile() {
        new DialogComponent({
            id: "profile-dialog",
            title: this.#user.name,
            position: "right",
            bodyContent: `
                    <nav class = "row no-space wrap">
                        ${this.#user.roles.map(role => `
                        <button class="chip tiny-margin">
                            <i>assignment_ind</i>
                            <span>${role}</span>
                        </button>
                        `).join("")}
                    </nav>
                    <fieldset class="wrap small-round">
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
    await UserContext.init();
    await WorkspaceSettings.load();
    await WorkspaceFilter.init();
    await SearchInput.init();
    new WorkspacePage();
});
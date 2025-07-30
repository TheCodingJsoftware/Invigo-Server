import "beercss";
import '@static/css/style.css';
import '@static/css/theme.css';
import {UserContext} from '@core/auth/user-context';
import {loadAnimationStyleSheet, toggleTheme, loadTheme, invertImages} from "@utils/theme"
import {DialogComponent} from "@components/common/dialog/dialog-component";
import {PartViewConfig, PartViewMode} from "@config/part-view-mode";
import {AssemblyViewMode} from "@config/assembly-view-mode";
import {DataTypeSwitcherMode} from "@config/data-type-mode";
import {NestViewMode} from "@config/nest-view-mode";
import {JobViewMode} from "@config/job-view-mode";
import {SessionSettingsManager} from "@core/settings/session-settings";
import {ViewSettingsManager} from "@core/settings/view-settings";
import {ViewBus, ViewChangePayload} from "@components/workspace/views/view-bus";
import {ViewSwitcherPanel} from "@components/workspace/views/switchers/view-switcher-panel";
import {WorkspaceWebSocket} from "@core/websocket/workspace-websocket";

let pageLoaded = false;

class PartRow {
    readonly element: HTMLTableRowElement;

    constructor(data: Record<string, unknown>) {
        this.element = document.createElement("tr");
        for (const val of Object.values(data)) {
            const td = document.createElement("td");
            td.textContent = typeof val === "object" ? JSON.stringify(val) : String(val);
            this.element.appendChild(td);
        }
    }
}

class PartPage {
    readonly element: HTMLElement;
    private table!: HTMLTableElement;

    constructor() {
        this.element = document.createElement("div");
    }

    async load(mode: PartViewMode) {
        const response = await fetch(`/api/part_view?view=${PartViewConfig[mode].dbView}`);
        const data = await response.json();
        this.render(data);
    }

    private render(data: Record<string, unknown>[]) {
        this.element.innerHTML = "";
        if (!data.length) return;
        console.log(data);

        this.table = document.createElement("table");
        this.table.classList.add("striped", "border", "rounded");

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        for (const key of Object.keys(data[0])) {
            const th = document.createElement("th");
            th.textContent = key;
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);
        this.table.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (const row of data) {
            const rowView = new PartRow(row);
            tbody.appendChild(rowView.element);
        }

        this.table.appendChild(tbody);
        this.element.appendChild(this.table);
    }
}

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
        this.loadLeftNav();
        this.loadThemeSettings();
        this.registerSocketHandlers();
        pageLoaded = true;
        ViewBus.update({ dataType: SessionSettingsManager.get().lastActiveDataType, viewMode: SessionSettingsManager.get().lastActiveView });
    }

    resyncState() {
        this.mainElement.innerHTML = "";
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

        const profileButton = document.createElement("button");
        profileButton.classList.add("border", "large", "circle");
        profileButton.innerHTML = `
            <i>person</i>
        `
        profileButton.onclick = () => this.showProfile();

        const headline = document.createElement("h6");
        headline.classList.add("max", "left-align");
        headline.innerText = "Workspace";

        const themeToggleButton = document.createElement("button");
        themeToggleButton.id = "theme-toggle";
        themeToggleButton.classList.add("circle", "transparent");
        const themeToggleIcon = document.createElement("i");
        themeToggleIcon.innerText = "dark_mode";
        themeToggleButton.appendChild(themeToggleIcon);


        nav.appendChild(headline);
        nav.appendChild(themeToggleButton);
        nav.appendChild(profileButton);

        document.body.appendChild(nav);
    }

    loadLeftNav() {
        const nav = document.createElement("nav");
        nav.classList.add("left");

        const homeButton = document.createElement("button");
        homeButton.classList.add("square", "round", "extra");
        const homeIcon = document.createElement("i");
        homeIcon.innerText = "home";
        homeButton.appendChild(homeIcon);
        homeButton.onclick = () => window.location.href = "/";

        nav.appendChild(homeButton);

        document.body.appendChild(nav);
    }

    showProfile() {
        function formatText(text: string): string {
            return text
                .replace(/_/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase());
        }

        const dialog = new DialogComponent(`
            <nav class="row">
                <button class="extra circle border transparent">
                    <i>person</i>
                </button>
                <h5 class="max">${this.#user.name}</h5>
                <div class="max"></div>
                <button class="circle transparent" id="close-btn">
                    <i>close</i>
                </button>
            </nav>
            <nav class = "row no-space wrap">
            ${this.#user.roles.map(r => `
                <button class="chip tiny-margin">
                    <i>assignment_ind</i>
                    <span>${formatText(r)}</span>
                </button>
                `).join("")}
            </nav>
            <fieldset class="wrap small-round">
                <legend>Permissions</legend>
                    <ul class="list border">
                        ${this.#user.permissions.map(p => `
                            <li>
                                <a>
                                    <div class="max">
                                        <h6 class="small">${formatText(p.label)}</h6>
                                        <div>${formatText(p.description)}</div>
                                    </div>
                                </a>
                            </li>
                            `).join("")}
                    </ul>
            </fieldset>`,
            {
                id: "profile-dialog",
                position: "right",
                autoRemove: true
            }
        );

        dialog.query<HTMLButtonElement>("#close-btn")?.addEventListener("click", () => {
            ui("#profile-dialog");
        });

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
    loadTheme();
    loadAnimationStyleSheet();
    await UserContext.initialize();
    new WorkspacePage();
});
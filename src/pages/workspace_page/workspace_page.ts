import "beercss";
import '@static/css/style.css';
import '@static/css/theme.css';
import { User } from "@auth/user";
import { loadAnimationStyleSheet, toggleTheme, loadTheme, invertImages } from "@utils/theme"
import { DialogComponent } from "@components/dialog-component";
import { JobData, JobMetaData } from "@interfaces/job";
import { LaserCutPartData } from "@interfaces/laser-cut-part";
import { PartViewConfig, PartViewMode } from "@config/part-view-mode";
import { AssemblyViewConfig, AssemblyViewMode } from "@config/assembly-view-mode";
import { DataTypeSwitcherConfig, DataTypeSwitcherMode } from "@config/data-type-mode";
import { DataTypeSettingsManager } from "@config/data-type-setting";
import { Permissions } from "@auth/permissions";
import { NestViewConfig, NestViewMode } from "@config/nest-view-mode";
import { JobViewConfig, JobViewMode } from "@config/job-view-mode";
import { SessionSettingsManager } from "@config/session-settings";
import { ViewSettingsManager } from "@config/view-settings";

interface WorkspaceJobData {
    id: number;
    name: string;
    job_data: JobMetaData;
    created_at: string;
    modified_at: string;
}

let user: User;
let pageLoaded = false;

type WorkspaceMessage =
    | { type: "job_created"; job: WorkspaceJobData }
    | { type: "job_updated"; job: WorkspaceJobData }
    | { type: "job_deleted"; job_id: number }
    | { type: "assembly_created"; job_id: number; data: any }
    | { type: "assembly_updated"; job_id: number; data: any }
    | { type: "assembly_deleted"; job_id: number; data: any }
    | { type: "part_created"; part: PartData }
    | { type: "part_updated"; part_id: number; delta: Partial<PartData> }
    | { type: "part_deleted"; part_id: number; };

type Listener<T extends WorkspaceMessage> = (data: T) => void;

export class WorkspaceWebSocket {
    private static socket: WebSocket;
    private static listeners: Partial<{ [K in WorkspaceMessage["type"]]: Listener<any>[] }> = {};
    static reconnectHandlers: (() => void)[] = [];

    static connect() {
        this.socket = new WebSocket(`ws://${location.host}/ws/workspace`);
        this.socket.onmessage = (event) => {
            const message: WorkspaceMessage = JSON.parse(event.data);
            this.listeners[message.type]?.forEach((cb) => cb(message));
        };

        this.socket.onclose = () => {
            setTimeout(() => {
                this.connect();
                this.reconnectHandlers.forEach((fn) => fn());
            }, 1000);
        };
    }

    static onReconnect(handler: () => void) {
        this.reconnectHandlers.push(handler);
    }

    static on<T extends WorkspaceMessage["type"]>(type: T, handler: Listener<Extract<WorkspaceMessage, { type: T }>>) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type]!.push(handler);
    }
}

type ViewChangePayload = {
    dataType: DataTypeSwitcherMode;
    viewMode: AssemblyViewMode | PartViewMode | NestViewMode | JobViewMode;
};

class ViewBus {
    private static listeners: Set<(view: ViewChangePayload) => void> = new Set();
    private static state: ViewChangePayload = {
        dataType: SessionSettingsManager.get().lastActiveDataType,
        viewMode: SessionSettingsManager.get().lastActiveView,
    };

    static subscribe(cb: (view: ViewChangePayload) => void) {
        this.listeners.add(cb);
        cb(this.state);
    }

    static update(partial: Partial<ViewChangePayload>) {
        this.state = { ...this.state, ...partial };

        // const next = { ...this.state, ...partial };
        // if (next.dataType === this.state.dataType && next.viewMode === this.state.viewMode) {
        //     return;
        // }
        // this.state = next;
        for (const cb of this.listeners) cb(this.state);
    }

    static getState() {
        return this.state;
    }
}

class ViewSwitcherPanel {
    readonly element: HTMLElement;

    private dataTypeSwitcher = new DataTypeSwitcher();
    private partViewSwitcher = new PartViewSwitcher();
    private assemblyViewSwitcher = new AssemblyViewSwitcher();
    private nestViewSwitcher = new NestViewSwitcher();
    private jobViewSwitcher = new JobViewSwitcher();

    constructor() {
        this.element = document.createElement("div");
    }

    initialize() {
        if (user.can(Permissions.SwitchDataTypes)) {
            this.dataTypeSwitcher.initialize();
            this.element.appendChild(this.dataTypeSwitcher.element);
        }
        if (user.can(Permissions.SwitchPartView)) {
            this.partViewSwitcher.initialize();
            this.element.appendChild(this.partViewSwitcher.element);
        }
        if (user.can(Permissions.SwitchAssemblyView)) {
            this.assemblyViewSwitcher.initialize();
            this.element.appendChild(this.assemblyViewSwitcher.element);
        }
        if (user.can(Permissions.SwitchNestView)) {
            this.nestViewSwitcher.initialize();
            this.element.appendChild(this.nestViewSwitcher.element);
        }
        if (user.can(Permissions.SwitchJobView)) {
            this.jobViewSwitcher.initialize();
            this.element.appendChild(this.jobViewSwitcher.element);
        }

        ViewBus.subscribe((view) => {
            if (user.can(Permissions.SwitchPartView)) {
                this.partViewSwitcher.element.style.display = view.dataType === DataTypeSwitcherMode.Part ? "block" : "none";
            }
            if (user.can(Permissions.SwitchAssemblyView)) {
                this.assemblyViewSwitcher.element.style.display = view.dataType === DataTypeSwitcherMode.Assembly ? "block" : "none";
            }
            if (user.can(Permissions.SwitchNestView)) {
                this.nestViewSwitcher.element.style.display = view.dataType === DataTypeSwitcherMode.Nest ? "block" : "none";
            }
            if (user.can(Permissions.SwitchJobView)) {
                this.jobViewSwitcher.element.style.display = view.dataType === DataTypeSwitcherMode.Job ? "block" : "none";
            }
        });
    }
}

class DataTypeSwitcher {
    element!: HTMLElement;
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
            if (!user.can(Permissions[mode])) {
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

        const savedView = DataTypeSettingsManager.get().viewMode;
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
                DataTypeSettingsManager.set({ viewMode: mode });
                ViewBus.update({ dataType: mode });
            }
        });
    }
}

class AssemblyViewSwitcher {
    element!: HTMLElement;
    constructor() {
        this.element = document.createElement("header");
    }

    initialize() {
        this.render();
    }

    render() {
        const div = document.createElement("div");
        div.classList.add("tabs", "center-align");
        div.id = "assembly-view-switcher";

        Object.values(AssemblyViewMode).forEach(mode => {
            if (!user.can(Permissions[mode])) {
                return;
            }
            const button = document.createElement("a");
            button.dataset.target = mode;
            button.dataset.ui = AssemblyViewConfig[mode].dbView;
            button.innerHTML = `
                <i>${AssemblyViewConfig[mode].icon}</i>
                <span>${AssemblyViewConfig[mode].label}</span>
            `;
            button.addEventListener("click", () => {
                this.update(mode);
            });
            div.appendChild(button);
        });

        const savedView = ViewSettingsManager.get().lastActiveAssemblyView;
        const savedButton = div.querySelector(`a[data-target="${savedView}"]`) as HTMLElement;
        if (savedButton) {
            savedButton.classList.add("active");
            ViewBus.update({ viewMode: savedView });
        }

        this.element.appendChild(div);
        return this.element;
    }

    update(mode: AssemblyViewMode) {
        const nav = this.element.querySelector("#assembly-view-switcher") as HTMLElement;
        nav.querySelectorAll("a").forEach(button => {
            button.classList.remove("active");
            if (button.dataset.target === mode) {
                button.classList.add("active");
                ViewSettingsManager.set({ lastActiveAssemblyView: mode });
                ViewBus.update({ viewMode: mode });
            }
        });
    }
}

class PartViewSwitcher {
    element!: HTMLElement;
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
            if (!user.can(Permissions[mode])) {
                return;
            }
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

        const savedView = ViewSettingsManager.get().lastActivePartView;
        const savedButton = div.querySelector(`a[data-target="${savedView}"]`) as HTMLElement;
        if (savedButton) {
            savedButton.classList.add("active");
            ViewBus.update({ viewMode: savedView });
        }

        this.element.appendChild(div);
        return this.element;
    }

    update(mode: PartViewMode) {
        const nav = this.element.querySelector("#part-view-switcher") as HTMLElement;
        nav.querySelectorAll("a").forEach(button => {
            button.classList.remove("active");
            if (button.dataset.target === mode) {
                button.classList.add("active");
                ViewSettingsManager.set({ lastActivePartView: mode });
                ViewBus.update({ viewMode: mode });
            }
        });
    }
}

class NestViewSwitcher {
    element: HTMLElement;
    constructor() {
        this.element = document.createElement("header");
    }

    initialize() {
        this.render();
    }

    render() {
        const div = document.createElement("div");
        div.classList.add("tabs", "center-align");
        div.id = "nest-view-switcher";

        Object.values(NestViewMode).forEach(mode => {
            console.log(mode);
            if (!user.can(Permissions[mode])) {
                return;
            }
            const button = document.createElement("a");
            button.dataset.target = mode;
            button.dataset.ui = NestViewConfig[mode].dbView;
            button.innerHTML = `
                <i>${NestViewConfig[mode].icon}</i>
                <span>${NestViewConfig[mode].label}</span>
            `;
            button.addEventListener("click", () => {
                this.update(mode);
            });
            div.appendChild(button);
        });

        const savedView = ViewSettingsManager.get().lastActiveNestView;
        const savedButton = div.querySelector(`a[data-target="${savedView}"]`) as HTMLElement;
        if (savedButton) {
            savedButton.classList.add("active");
            ViewBus.update({ viewMode: savedView });
        }

        this.element.appendChild(div);
        return this.element;
    }

    update(mode: NestViewMode) {
        const nav = this.element.querySelector("#nest-view-switcher") as HTMLElement;
        nav.querySelectorAll("a").forEach(button => {
            button.classList.remove("active");
            if (button.dataset.target === mode) {
                button.classList.add("active");
                ViewSettingsManager.set({ lastActiveNestView: mode });
                ViewBus.update({ viewMode: mode });
            }
        });
    }
}

class JobViewSwitcher {
    element: HTMLElement;
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
            if (!user.can(Permissions[mode])) {
                return;
            }
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

        const savedView = ViewSettingsManager.get().lastActiveJobView;
        const savedButton = div.querySelector(`a[data-target="${savedView}"]`) as HTMLElement;
        if (savedButton) {
            savedButton.classList.add("active");
            ViewBus.update({ viewMode: savedView });
        }

        this.element.appendChild(div);
        return this.element;
    }

    update(mode: JobViewMode) {
        const nav = this.element.querySelector("#job-view-switcher") as HTMLElement;
        nav.querySelectorAll("a").forEach(button => {
            button.classList.remove("active");
            if (button.dataset.target === mode) {
                button.classList.add("active");
                ViewSettingsManager.set({ lastActiveJobView: mode });
                ViewBus.update({ viewMode: mode });
            }
        });
    }
}

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
    jobContainers: Map<number, JobContainer>;
    private viewSwitcherPanel: ViewSwitcherPanel;
    private pageHost: PageHost;

    constructor() {
        this.mainElement = document.querySelector("main") as HTMLElement;
        this.jobContainers = new Map();
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
        this.loadPage();
        this.loadThemeSettings();
        this.registerSocketHandlers();
        pageLoaded = true;
        ViewBus.update({ dataType: SessionSettingsManager.get().lastActiveDataType, viewMode: SessionSettingsManager.get().lastActiveView });
    }

    resyncState() {
        this.jobContainers.clear();
        this.mainElement.innerHTML = "";
        this.loadPage();
    }

    registerSocketHandlers() {
        WorkspaceWebSocket.on("job_created", ({ job }) => this.addJob(job));
        WorkspaceWebSocket.on("job_updated", ({ job }) => this.updateJob(job));
        WorkspaceWebSocket.on("job_deleted", ({ job_id }) => this.removeJob(job_id));
    }

    addJob(jobData: WorkspaceJobData) {
        console.log("Adding job:", jobData);
        const jobId = jobData.id;
        const container = new JobContainer(jobId, jobData);
        this.jobContainers.set(jobData.job_data.id, container);
        this.mainElement.appendChild(container.element);
    }

    updateJob(jobData: WorkspaceJobData) {
        console.log("Updating job:", jobData);
        this.jobContainers.get(jobData.job_data.id)?.update(jobData);
    }

    removeJob(job_id: number) {
        this.jobContainers.forEach(container => {
            if (container.jobData.job_data.id === job_id) {
                container.remove();
                this.jobContainers.delete(job_id);
            }
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

    loadViews() {

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
                <h5 class="max">${user.name}</h5>
                <div class="max"></div>
                <button class="circle transparent" id="close-btn">
                    <i>close</i>
                </button>
            </nav>
            <nav class = "row no-space wrap">
            ${user.roles.map(r => `
                <button class="chip tiny-margin">
                    <i>assignment_ind</i>
                    <span>${formatText(r)}</span>
                </button>
                `).join("")}
            </nav>
            <fieldset class="wrap small-round">
                <legend>Permissions</legend>
                    <ul class="list border">
                        ${user.permissions.map(p => `
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

    loadPage() {
        return;
        const container = document.createElement("div");
        container.classList.add("grid", "no-space");

        fetch("/workspace/get_all_jobs")
            .then(response => response.json())
            .then((data: Record<string, WorkspaceJobData[]>) => {
                const fragment = document.createDocumentFragment();

                data.jobs.forEach((job: WorkspaceJobData) => {
                    const jobElement = new JobContainer(job.id, job);
                    this.jobContainers.set(job.id, jobElement);
                    fragment.appendChild(jobElement.element);
                });

                requestIdleCallback(() => {
                    container.appendChild(fragment);
                    this.mainElement.appendChild(container);
                });
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

class JobContainer {
    element: HTMLElement;
    jobId: number;
    jobData: WorkspaceJobData;
    jobDetails: JobDetails;
    partsContainer: PartsContainer;
    assemblyContainer: AssemblyContainer;

    constructor(jobId: number, jobData: WorkspaceJobData) {
        this.jobId = jobId;
        this.jobData = jobData;

        this.element = document.createElement("article");
        this.element.classList.add("s12", "round", "border", "grid", "no-space");

        this.jobDetails = new JobDetails(jobData);
        this.partsContainer = new PartsContainer([jobId]);
        this.assemblyContainer = new AssemblyContainer();

        this.element.appendChild(this.jobDetails.element);
        this.element.appendChild(this.partsContainer.element);
        this.element.appendChild(this.assemblyContainer.element);
    }

    render() {
        this.partsContainer.render();
        this.assemblyContainer.render();
    }

    update(jobData: WorkspaceJobData) {
        this.jobData = jobData;
        this.jobDetails.update(jobData);
    }

    show() {
        this.element.classList.remove("hidden");
    }

    hide() {
        this.element.classList.add("hidden");
    }

    remove() {
        this.element.remove();
    }
}

class JobDetails {
    element: HTMLElement;
    jobData: WorkspaceJobData;

    constructor(jobData: WorkspaceJobData) {
        this.jobData = jobData;

        this.element = document.createElement("div");
        this.element.classList.add("s12");
        this.render();
    }

    render() {
        this.element.innerHTML = "";

        const jobDetails = document.createElement("div");
        jobDetails.classList.add("grid", "no-space");

        const jobName = document.createElement("div");
        jobName.classList.add("s12");
        jobName.innerText = this.jobData.job_data.name;
        jobDetails.appendChild(jobName);

        const jobOrderNumber = document.createElement("div");
        jobOrderNumber.classList.add("s12");
        jobOrderNumber.innerText = this.jobData.job_data.order_number.toString();
        jobDetails.appendChild(jobOrderNumber);

        const jobPONumber = document.createElement("div");
        jobPONumber.classList.add("s12");
        jobPONumber.innerText = this.jobData.job_data.PO_number.toString();
        jobDetails.appendChild(jobPONumber);

        this.element.appendChild(jobDetails);
    }

    update(jobData: WorkspaceJobData) {
        this.jobData = jobData;
        console.log("JobDetails.JobData", this.jobData);
        this.render();
    }

    show() {
        this.element.classList.remove("hidden");
    }

    hide() {
        this.element.classList.add("hidden");
    }

    remove() {
        this.element.remove();
    }
}

class PartsContainer {
    element: HTMLElement;
    partsTable: PartsTable;
    jobIds: number[];

    constructor(jobIds: number[]) {
        this.jobIds = jobIds;
        this.element = document.createElement("div");
        this.element.classList.add("s12", "m12", "l12");
        this.partsTable = new PartsTable(jobIds);
        this.element.appendChild(this.partsTable.tableElement);
    }

    render() {
    }
}

class AssemblyContainer {
    element: HTMLElement;
    assemblyTable: AssemblyTable;

    constructor() {
        this.element = document.createElement("div");
        this.element.classList.add("s12", "m12", "l12");
        this.assemblyTable = new AssemblyTable();
        this.element.appendChild(this.assemblyTable.tableElement);
    }

    render() {
        this.element.innerHTML = ""; // Clear previous content
        this.assemblyTable.render();
        this.element.appendChild(this.assemblyTable.tableElement);
    }
}

export interface PartDelta {
    id: number;
    job_id: number;
    delta: Partial<PartData>;   // only the changed fields
}

class PartsElement {
    element: HTMLElement;
    partData: PartData;

    constructor(partData: PartData) {
        this.partData = partData;
        this.element = document.createElement("tr");
        this.render();
    }

    render() {
        this.element.innerHTML = `
            <td>${this.partData.name}</td>
            <td>${this.partData.quantity}</td>
            <td>${this.partData.flowtag.join(", ")}</td>
            <td>${this.partData.setup_time}</td>
            <td>${this.partData.process_time}</td>
            <td>${this.partData.automated_time}</td>
            <td>${this.partData.start_time}</td>
            <td>${this.partData.end_time}</td>
            <td>${this.partData.modified_at}</td>
            <td>${this.partData.created_at}</td>
        `;
    }

    // TODO: Consider rendering only the changed fields instead of the whole row or element
    patch(delta: Partial<PartData>) {
        Object.assign(this.partData, delta);
        this.render();
    }

    update(partData: PartData) {
        this.partData = partData;
        this.render();
    }

    show() {
        this.element.classList.remove("hidden");
    }

    hide() {
        this.element.classList.add("hidden");
    }

    remove() {
        this.element.remove();
    }
}

interface PartData {
    id: number;
    job_id: number;
    assembly_group_id: number;
    name: string;
    quantity: number;
    flowtag: string[];
    flowtag_index: number;
    setup_time: string;
    setup_time_seconds: number;
    process_time: string;
    process_time_seconds: number;
    automated_time: string;
    automated_time_seconds: number;
    start_time: string;
    end_time: string;
    meta_data: LaserCutPartData["meta_data"];
    prices: LaserCutPartData["prices"];
    paint_data: LaserCutPartData["paint_data"];
    primer_data: LaserCutPartData["primer_data"];
    powder_data: LaserCutPartData["powder_data"];
    workspace_data: LaserCutPartData["workspace_data"];
    modified_at: string;
    created_at: string;
}

class PartsTable {
    tableElement: HTMLTableElement;
    parts: PartData[];
    partElements: Map<number, PartsElement>;

    constructor(jobIds: number[]) {
        this.parts = [];
        this.partElements = new Map();
        this.tableElement = document.createElement("table");
        this.tableElement.classList.add("border", "tiny-space");
        this.initialize(jobIds);
    }

    initialize(jobIds: number[]) {
        jobIds.forEach(jobId => {
            fetch(`/workspace/get_parts_by_job/${jobId}`)
                .then(response => response.json())
                .then((data: PartData[]) => {
                    this.parts.push(...data);
                    this.render();
                });
        });
        this.registerSocketHandlers();
    }

    registerSocketHandlers() {
        WorkspaceWebSocket.on("part_created", ({ part }) => this.addPart(part));
        WorkspaceWebSocket.on("part_updated", ({ part_id, delta }) => this.patchPart(part_id, delta));
        WorkspaceWebSocket.on("part_deleted", ({ part_id }) => this.removePart(part_id));
    }

    addPart(partData: PartData) {
        console.log("Adding part:", partData);
        const container = new PartsElement(partData);
        this.partElements.set(partData.id, container);
        this.tableElement.appendChild(container.element);
    }

    patchPart(part_id: number, delta: Partial<PartData>) {
        console.log(`Patching part ${part_id}`, delta);
        this.partElements.get(part_id)?.patch(delta);
    }

    removePart(part_id: number) {
        console.log("Removing part with job_id:", part_id);

        this.partElements.forEach(container => {
            if (container.partData.id === part_id) {
                container.remove();
                this.partElements.delete(part_id);
            }
        });
    }

    render() {
        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Name</th>
                <th>Quantity</th>
                <th>Flowtag</th>
                <th>Setup Time</th>
                <th>Process Time</th>
                <th>Automated Time</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Modified At</th>
                <th>Created At</th>
            </tr>
        `;
        this.tableElement.appendChild(thead);

        const tbody = document.createElement("tbody");
        const fragment = document.createDocumentFragment();

        this.parts.forEach(part => {
            const partElement = new PartsElement(part);
            this.partElements.set(part.id, partElement);
            fragment.appendChild(partElement.element);
        });

        requestIdleCallback(() => {
            tbody.appendChild(fragment);
            this.tableElement.appendChild(tbody);
        });
    }

    show() {
        this.tableElement.classList.remove("hidden");
    }

    hide() {
        this.tableElement.classList.add("hidden");
    }
}

class AssemblyElement {
    element: HTMLElement;
    constructor() {
        this.element = document.createElement("div");
        this.element.classList.add("s12", "m12", "l12");
    }

}

class AssemblyTable {
    tableElement: HTMLTableElement;
    constructor() {
        this.tableElement = document.createElement("table");
        this.tableElement.classList.add("border", "tiny-space");
    }
    render() {

    }

    show() {
        this.tableElement.classList.remove("hidden");
    }

    hide() {
        this.tableElement.classList.add("hidden");
    }
}


document.addEventListener("DOMContentLoaded", async () => {
    loadTheme();
    loadAnimationStyleSheet();
    user = await User.fetchCurrent();
    console.log(user);
    const workspacePage = new WorkspacePage();
});
import "beercss";
import '@static/css/style.css';
import '@static/css/theme.css';
import { User } from "@auth/user";
import { loadAnimationStyleSheet, toggleTheme, loadTheme, invertImages } from "@utils/theme"
import { DialogComponent } from "@components/dialog-component";
import { JobData } from "@interfaces/job";
import { LaserCutPartData } from "@interfaces/laser-cut-part";

let user: User;

type WorkspaceMessage =
    | { type: "job_created"; job: JobData }
    | { type: "job_updated"; job: JobData }
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

class WorkspacePage {
    mainElement: HTMLElement;
    jobContainers: Map<number, JobContainer>;


    constructor() {
        this.mainElement = document.querySelector("main") as HTMLElement;
        this.jobContainers = new Map();
        this.initialize();
    }

    initialize() {
        WorkspaceWebSocket.connect();
        WorkspaceWebSocket.onReconnect(() => {
            this.resyncState();
        });
        this.loadNav();
        this.loadPage();
        this.loadThemeSettings();
        this.registerSocketHandlers();
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

    addJob(jobData: JobData) {
        console.log("Adding job:", jobData);
        const container = new JobContainer(jobData);
        this.jobContainers.set(jobData.job_data.id, container);
        this.mainElement.appendChild(container.element);
    }

    updateJob(jobData: JobData) {
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

    loadNav() {
        const nav = document.createElement("nav");
        nav.classList.add("left");

        const homeButton = document.createElement("button");
        homeButton.classList.add("square", "round", "extra");
        const homeIcon = document.createElement("i");
        homeIcon.innerText = "home";
        homeButton.appendChild(homeIcon);
        homeButton.onclick = () => window.location.href = "/";

        const profileButton = document.createElement("button");
        profileButton.classList.add("circle", "border", "large");
        const profileIcon = document.createElement("i");
        profileIcon.innerText = "person";
        profileButton.appendChild(profileIcon);
        profileButton.onclick = () => this.showProfile();

        const themeToggleButton = document.createElement("button");
        themeToggleButton.id = "theme-toggle";
        themeToggleButton.classList.add("circle", "transparent");
        const themeToggleIcon = document.createElement("i");
        themeToggleIcon.innerText = "dark_mode";
        themeToggleButton.appendChild(themeToggleIcon);

        nav.appendChild(homeButton);
        nav.appendChild(profileButton);
        nav.appendChild(themeToggleButton);

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
                <h5 class="max">${user.name}</h5>
                <button class="circle transparent" id="close-btn">
                    <i>close</i>
                </button>
            </nav>
            <button class="chip">
                <i>person</i>
                <span>${formatText(user.role)}</span>
            </button>
            <fieldset class="wrap small-round">
                <legend>Permissions</legend>
                    <nav class="wrap no-space">
                        ${user.permissions.map(p => `<button class="chip tiny-margin">${formatText(p)}</button>`).join("")}
                    </nav>
            </fieldset>`,
            {
                id: "profile-dialog",
                autoRemove: true
            }
        );

        dialog.query<HTMLButtonElement>("#close-btn")?.addEventListener("click", () => {
            ui("#profile-dialog");
        });

    }

    loadPage() {
        const container = document.createElement("div");
        container.classList.add("grid", "no-space");

        fetch("/workspace/get_all_jobs")
            .then(response => response.json())
            .then((data: Record<string, JobData[]>) => {
                const fragment = document.createDocumentFragment();

                data.jobs.forEach((job: JobData) => {
                    const jobElement = new JobContainer(job);
                    this.jobContainers.set(job.job_data.id, jobElement);
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
    jobData: JobData;
    jobDetails: JobDetails;
    partsContainer: PartsContainer;
    assemblyContainer: AssemblyContainer;

    constructor(jobData: JobData) {
        this.jobData = jobData;

        this.element = document.createElement("article");
        this.element.classList.add("s12", "round", "border", "grid", "no-space");

        this.jobDetails = new JobDetails(jobData);
        this.partsContainer = new PartsContainer([jobData.job_data.id]);
        this.assemblyContainer = new AssemblyContainer();

        this.element.appendChild(this.jobDetails.element);
        this.element.appendChild(this.partsContainer.element);
        this.element.appendChild(this.assemblyContainer.element);
    }

    render() {
        this.partsContainer.render();
        this.assemblyContainer.render();
    }

    update(jobData: JobData) {
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
    jobData: JobData;

    constructor(jobData: JobData) {
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

    update(jobData: JobData) {
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
    const workspacePage = new WorkspacePage();
});
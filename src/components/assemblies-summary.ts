import { BaseComponent } from "@interfaces/base-component";
import { Assembly } from "@models/assembly";
import { Job } from "@models/job";

export class AssembliesSummary implements BaseComponent {
    job: Job;
    element!: HTMLElement;
    jobId: number;
    allAssemblies: Assembly[];

    constructor(jobId: number, jobData: Job) {
        this.jobId = jobId;
        this.job = jobData;
        this.allAssemblies = this.getAllAssemblies(this.job.assemblies);
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border">
           <nav class="hide-on-print">
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">Assemblies Summary</h4>
                <nav class="group connected primary-container">
                    <button class="left-round" id="grid-compact-button">
                        <i>view_compact</i>
                    </button>
                    <button class="no-round" id="grid-module-button">
                        <i>view_module</i>
                    </button>
                    <button class="no-round" id="grid-cozy-button">
                        <i>view_cozy</i>
                    </button>
                    <button class="right-round" id="list-button">
                        <i>view_list</i>
                    </button>
                </nav>
                <button class="circle transparent" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="small-padding hide-on-print">
                    <label class="checkbox">
                        <input type="checkbox" id="show-assemblyPicture" checked>
                        <span>Picture</span>
                    </label>
                    <label class="checkbox">
                        <input type="checkbox" id="show-assemblyProcess" checked>
                        <span>Assembly Process</span>
                    </label>
                </div>
                <div class="grid no-space" id="assemblies-grid-view">${this.generateAssemblyGrid()}</div>
                <div id="assemblies-list-view">${this.generateAssemblyList()}</div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assemblies-${this.jobId}`;

        return this.element;
    }

    private toggleAssemblyProcessVisibility(save: boolean = true) {
        const toggleAssemblyProcessCheckbox = this.element.querySelector("#show-assemblyProcess") as HTMLInputElement;
        const processDivs = this.element.querySelectorAll(".assembly-process-div") as NodeListOf<HTMLElement>;

        processDivs.forEach(div => {
            div.classList.toggle("hidden", !toggleAssemblyProcessCheckbox.checked);
        });

        if (save) {
            localStorage.setItem("show-assemblyProcess", toggleAssemblyProcessCheckbox.checked.toString());
        }
    }

    private toggleAssemblyPictureVisibility(save: boolean = true) {
        const toggleAssemblyPictureCheckbox = this.element.querySelector("#show-assemblyPicture") as HTMLInputElement;
        const pictureDivs = this.element.querySelectorAll(".assembly-picture-div") as NodeListOf<HTMLElement>;

        pictureDivs.forEach(div => {
            div.classList.toggle("hidden", !toggleAssemblyPictureCheckbox.checked);
        });

        if (save) {
            localStorage.setItem("show-assemblyPicture", toggleAssemblyPictureCheckbox.checked.toString());
        }
    }

    private generateAssemblyGrid(): string {
        return this.allAssemblies
            .map(assembly => `
            <div class="s6 page-break-inside">
                <article class="assembly no-padding border round">
                    <img
                        class="responsive top-round assembly-image assembly-picture-div"
                        src="http://invi.go/image/${assembly.meta_data.assembly_image}">
                    <div class="padding">
                        <nav class="row wrap">
                            <div class="bold large-text max">${assembly.name}</div>
                            <h6>× ${assembly.meta_data.quantity}</h6>
                        </nav>
                        <div class="assembly-process-div">${assembly.generateProcessTagString()}</div>
                    </div>
                </article>
            </div>
        `.trim())
            .join('\n');
    }

    private generateAssemblyList(): string {
        const rows = this.allAssemblies
            .map(assembly => `
            <tr>
                <td class="assembly-picture-div min assembly-image-list tiny-padding">
                    <img
                        class="extra square small-round border"
                        src="http://invi.go/image/${assembly.meta_data.assembly_image}">
                </td>
                <td>
                    <p class="no-margin">${assembly.name}</p>
                </td>
                <td class="assembly-process-div">
                    <div>${assembly.generateProcessTagString()}</div>   
                </td>
                <td class="left-align min"><span>× ${assembly.meta_data.quantity}</span></td>
            </tr>
        `.trim())
            .join('\n');

        return `
        <table class="border no-space">
            <thead>
                <tr>
                    <th class="assembly-picture-div"></th>
                    <th>Assembly</th>
                    <th class="assembly-process-div">Process</th>
                    <th class="center-align">Quantity</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `.trim();
    }

    private getAllAssemblies(assemblies: Assembly[]): Assembly[] {
        let allAssemblies: Assembly[] = [];
        for (const assembly of assemblies) {
            allAssemblies.push(assembly);
            if (assembly.sub_assemblies && assembly.sub_assemblies.length > 0) {
                allAssemblies = allAssemblies.concat(this.getAllAssemblies(assembly.sub_assemblies));
            }
        }
        return allAssemblies;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#assemblies-summary-layout') as HTMLDivElement;
        container.appendChild(this.build());

        const toggleAssemblyProcessCheckbox = this.element.querySelector("#show-assemblyProcess") as HTMLInputElement;
        const storedStateAssemblyProcess = localStorage.getItem("show-assemblyProcess") ?? "true";
        toggleAssemblyProcessCheckbox.checked = storedStateAssemblyProcess === "true";

        this.toggleAssemblyProcessVisibility(false);

        toggleAssemblyProcessCheckbox.addEventListener("change", () => {
            this.toggleAssemblyProcessVisibility();
        });

        const toggleAssemblyPictureCheckbox = this.element.querySelector("#show-assemblyPicture") as HTMLInputElement;
        const storedStateAssemblyPicture = localStorage.getItem("show-assemblyPicture") ?? "true";
        toggleAssemblyPictureCheckbox.checked = storedStateAssemblyPicture === "true";

        this.toggleAssemblyPictureVisibility(false);

        toggleAssemblyPictureCheckbox.addEventListener("change", () => {
            this.toggleAssemblyPictureVisibility();
        });

        const gridCompactButton = this.element.querySelector('#grid-compact-button') as HTMLButtonElement;
        const gridModuleButton = this.element.querySelector('#grid-module-button') as HTMLButtonElement;
        const gridCozyButton = this.element.querySelector('#grid-cozy-button') as HTMLButtonElement;
        const listButton = this.element.querySelector('#list-button') as HTMLButtonElement;
        const gridView = this.element.querySelector('#assemblies-grid-view')!;
        const listView = this.element.querySelector('#assemblies-list-view')!;

        const setView = (mode: 'grid-compact' | 'grid-module' | 'grid-cozy' | 'list') => {
            localStorage.setItem('assemblies-view', mode);

            if (mode === 'grid-compact' || mode === 'grid-module' || mode === 'grid-cozy') {
                gridView.classList.remove('hidden');
                listView.classList.add('hidden');

                const gridDivs = gridView.querySelectorAll<HTMLDivElement>('div.s3, div.s4, div.s6');
                gridDivs.forEach(div => {
                    div.classList.remove("s3", "s4", "s6");

                    if (mode === 'grid-compact') {
                        div.classList.add("s3");
                    } else if (mode === 'grid-module') {
                        div.classList.add("s4");
                    } else if (mode === 'grid-cozy') {
                        div.classList.add("s6");
                    }
                });
            } else {
                gridView.classList.add('hidden');
                listView.classList.remove('hidden');
            }

            gridCompactButton.classList.toggle('active', mode === 'grid-compact');
            gridModuleButton.classList.toggle('active', mode === 'grid-module');
            gridCozyButton.classList.toggle('active', mode === 'grid-cozy');
            listButton.classList.toggle('active', mode === 'list');
        };

        // Restore initial view
        const savedMode = (localStorage.getItem('assemblies-view') as 'grid-compact' | 'grid-module' | 'grid-cozy' | 'list') || 'grid-compact';
        setView(savedMode);

        gridCompactButton.addEventListener('click', () => setView('grid-compact'));
        gridModuleButton.addEventListener('click', () => setView('grid-module'));
        gridCozyButton.addEventListener('click', () => setView('grid-cozy'));
        listButton.addEventListener('click', () => setView('list'));

        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

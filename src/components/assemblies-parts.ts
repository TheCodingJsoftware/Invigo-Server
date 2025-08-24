import {BaseComponent} from "@interfaces/base-component";
import {Job} from "@models/job";

import {AssembliesGroupedPartsList} from "./assemblies-grouped-parts-list-layout";
import {NestedAssembliesPartsLayout} from "./assemblies-nested-layout";
import {AssembliesPartsList} from "./assemblies-parts-list";

export class AssembliesParts implements BaseComponent {
    job: Job;
    jobId: number;
    assemblyPartsList: AssembliesPartsList[];
    assemblyGroupedPartsList: AssembliesGroupedPartsList;
    nestedAssemblyPartsLayout: NestedAssembliesPartsLayout[];
    element!: HTMLElement;

    constructor(jobId: number, job: Job) {
        this.jobId = jobId
        this.job = job;
        this.assemblyPartsList = [];
        this.assemblyGroupedPartsList = new AssembliesGroupedPartsList(this.jobId, this.job);
        this.nestedAssemblyPartsLayout = [];
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav class="hide-on-print">
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">Assemblies Parts</h4>
                <nav class="group connected primary-container">
                    <button class="left-round" id="nested-layout-button">
                        <i>account_tree</i>
                        <span>Nested</span>
                    </button>
                    <button class="no-round" id="assemblies-list-button">
                        <i>gallery_thumbnail</i>
                        <span>Assemblies</span>
                    </button>
                    <button class="right-round" id="grouped-parts-list-button">
                        <i>view_list</i>
                        <span>Parts</span>
                    </button>
                </nav>
                <button class="circle transparent" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div>
                    <div id="assembly-nested-parts-layout">
                        ${this.generateNestedAssembliesPartsLayout()}
                    </div>
                    <div id="assemblies-parts-list-layout">
                        ${this.generateAssembliesPartsList()}
                    </div>
                    <div id="assemblies-grouped-parts-list-layout">
                        ${this.generateAssembliesGroupedPartsList()}
                    </div>
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assemblies-parts-layout-${this.jobId}`;

        return this.element;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#parts-layout-container') as HTMLDivElement;
        container.appendChild(this.build());

        const nestedLayoutButton = this.element.querySelector('#nested-layout-button') as HTMLButtonElement;
        const assembliesListButton = this.element.querySelector('#assemblies-list-button') as HTMLButtonElement;
        const groupedPartsListButton = this.element.querySelector('#grouped-parts-list-button') as HTMLButtonElement;

        const nestedLayout = this.element.querySelector('#assembly-nested-parts-layout') as HTMLDivElement;
        const assembliesList = this.element.querySelector('#assemblies-parts-list-layout') as HTMLDivElement;
        const groupedPartsList = this.element.querySelector('#assemblies-grouped-parts-list-layout') as HTMLDivElement;

        const setView = (mode: 'nested-layout' | 'assemblies-list' | 'grouped-parts-list') => {
            localStorage.setItem('assemblies-parts-view', mode);

            if (mode === 'nested-layout') {
                nestedLayoutButton.classList.add('active');
                assembliesListButton.classList.remove('active');
                groupedPartsListButton.classList.remove('active');

                nestedLayout.classList.remove('hidden');
                assembliesList.classList.add('hidden');
                groupedPartsList.classList.add('hidden');
            } else if (mode === 'assemblies-list') {
                nestedLayoutButton.classList.remove('active');
                assembliesListButton.classList.add('active');
                groupedPartsListButton.classList.remove('active');

                nestedLayout.classList.add('hidden');
                assembliesList.classList.remove('hidden');
                groupedPartsList.classList.add('hidden');
            } else if (mode === 'grouped-parts-list') {
                nestedLayoutButton.classList.remove('active');
                assembliesListButton.classList.remove('active');
                groupedPartsListButton.classList.add('active');

                nestedLayout.classList.add('hidden');
                assembliesList.classList.add('hidden');
                groupedPartsList.classList.remove('hidden');
            }
        };

        // Restore initial view
        const savedMode = (localStorage.getItem('assemblies-parts-view') as 'nested-layout' | 'assemblies-list' | 'grouped-parts-list') || 'nested-layout';
        setView(savedMode);

        nestedLayoutButton.addEventListener('click', () => setView('nested-layout'));
        assembliesListButton.addEventListener('click', () => setView('assemblies-list'));
        groupedPartsListButton.addEventListener('click', () => setView('grouped-parts-list'));

        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }

    private generateNestedAssembliesPartsLayout(): string {
        let nestedAssembliesPartsLayoutHTML = "";
        for (const assembly of this.job.assemblies) {
            const nestedAssembliesPartsLayout = new NestedAssembliesPartsLayout(this.jobId, assembly);
            nestedAssembliesPartsLayoutHTML += nestedAssembliesPartsLayout.build().outerHTML;
            this.nestedAssemblyPartsLayout.push(nestedAssembliesPartsLayout);
        }
        return nestedAssembliesPartsLayoutHTML
    }

    private generateAssembliesPartsList(): string {
        let assembliesGroupedPartsList = "";
        for (const assembly of this.job.getAllAssemblies()) {
            const assemblyGroupedPartsList = new AssembliesPartsList(this.jobId, assembly).build().outerHTML;
            this.assemblyPartsList.push(new AssembliesPartsList(this.jobId, assembly));
            assembliesGroupedPartsList += assemblyGroupedPartsList;
        }
        return assembliesGroupedPartsList.trim();
    }

    private generateAssembliesGroupedPartsList(): string {
        this.assemblyGroupedPartsList = new AssembliesGroupedPartsList(this.jobId, this.job);
        return this.assemblyGroupedPartsList.build().outerHTML;
    }
}

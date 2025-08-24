import {BaseComponent} from "@interfaces/base-component";
import {Assembly} from "@models/assembly";

import {AssemblyComponentsTable, AssemblyLaserCutPartsTable} from "./assemblies-parts-list";

class AssemblyLaserCutPartsComponent {
    assembly: Assembly;
    private jobId: number;
    private element!: HTMLElement;

    constructor(jobId: number, assembly: Assembly) {
        this.jobId = jobId;
        this.assembly = assembly;
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border">
            <nav class="hide-on-print">
                <h4 class="max">Laser Cut Parts</h4>
                <button class="circle transparent" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="grid small-padding hide-on-print">
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-partName" checked>
                        <span>Part Name</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-coating" checked>
                        <span>Coating</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-material" checked>
                        <span>Material</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-process" checked>
                        <span>Process</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-notes" checked>
                        <span>Notes</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-shelfNumber" checked>
                        <span>Shelf #</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-unitQuantity" checked>
                        <span>Unit Quantity</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-quantity" checked>
                        <span>Quantity</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-unitPrice" checked>
                        <span>Unit Price</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-laser-cut-part-price" checked>
                        <span>Price</span>
                    </label>
                </div>
                <div>
                    ${new AssemblyLaserCutPartsTable(this.jobId, this.assembly).generatePartsTable().outerHTML}
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assemblies-nested-laser-cut-parts-component-${this.jobId}-${this.assembly.getSafeIdName()}`;

        return this.element;
    }
}

class AssemblyComponentsComponent {
    assembly: Assembly;
    private jobId: number;
    private element!: HTMLElement;

    constructor(jobId: number, assembly: Assembly) {
        this.jobId = jobId;
        this.assembly = assembly;
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border">
            <nav class="hide-on-print">
                <h4 class="max">Components</h4>
                <button class="circle transparent" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="grid small-padding hide-on-print">
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-component-partName" checked>
                        <span>Part Name</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-component-partNumber" checked>
                        <span>Part Number</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-component-notes" checked>
                        <span>Notes</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-component-shelfNumber" checked>
                        <span>Shelf #</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-component-unitQuantity" checked>
                        <span>Unit Quantity</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-component-quantity" checked>
                        <span>Quantity</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-component-unitPrice" checked>
                        <span>Unit Price</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-assembly-component-price" checked>
                        <span>Price</span>
                    </label>
                </div>
                <div>
                    ${new AssemblyComponentsTable(this.jobId, this.assembly).generatePartsTable().outerHTML}
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assemblies-nested-components-component-${this.jobId}-${this.assembly.getSafeIdName()}`;

        return this.element;
    }
}

export class NestedAssembliesPartsLayout implements BaseComponent {
    assembly: Assembly;
    jobId: number;
    element!: HTMLElement;

    private assemblyLaserCutPartsComponent?: AssemblyLaserCutPartsComponent;
    private assemblyComponentsComponent?: AssemblyComponentsComponent;
    // private assemblyStructuralComponentsComponent?: AssemblyStructuralComponentsComponent;
    private assemblySubAssembliesPartsLayouts!: NestedAssembliesPartsLayout[];

    constructor(jobId: number, assembly: Assembly) {
        this.jobId = jobId;
        this.assembly = assembly;
        this.assemblySubAssembliesPartsLayouts = [];
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border">
            <nav class="row tiny-padding top-align">
                <img src="http://invi.go/image/${this.assembly.meta_data.assembly_image}" class="round border" style="height: 150px; width: auto;">
                <div class="max">
                    <h6>${this.assembly.name}</h6>
                    <div>Assembly quantity: ${this.assembly.meta_data.quantity}</div>
                    <div>Process: ${this.assembly.generateProcessTagString()}</div>
                    <div>Paint: ${this.assembly.paint_data.paint_name}</div>
                </div>
                <button class="circle transparent hide-on-print" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div id="assembly-parts-list-layout-${this.jobId}-${this.assembly.getSafeIdName()}">
                    ${this.generateLaserCutPartsComponent().outerHTML}
                </div>
                <div id="assembly-Components-list-layout-${this.jobId}-${this.assembly.getSafeIdName()}">
                    ${this.generateComponentsComponent().outerHTML}
                </div>
                <div id="sub-assembly-parts-list-layout-${this.jobId}-${this.assembly.getSafeIdName()}">
                    ${this.generateSubAssembliesPartsLayout()}
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assemblies-nested-assembly-parts-list-layout-${this.jobId}-${this.assembly.getSafeIdName()}`;

        return this.element;
    }

    generateLaserCutPartsComponent(): HTMLElement {
        if (this.assembly.laser_cut_parts.length === 0) return document.createElement("div");
        this.assemblyLaserCutPartsComponent = new AssemblyLaserCutPartsComponent(this.jobId, this.assembly);
        return this.assemblyLaserCutPartsComponent.build();
    }

    generateComponentsComponent(): HTMLElement {
        if (this.assembly.components.length === 0) return document.createElement("div");
        this.assemblyComponentsComponent = new AssemblyComponentsComponent(this.jobId, this.assembly);
        return this.assemblyComponentsComponent.build();
    }

    // generateStructuralComponentsComponent(): HTMLElement {
    //     if (this.assembly.structural_steel_components.length === 0) return document.createElement("div");
    //     this.assemblyStructuralComponentsComponent = new AssemblyStructuralComponentsComponent(this.jobId, this.assembly);
    //     return this.assemblyStructuralComponentsComponent.build();
    // }

    generateSubAssembliesPartsLayout(): string {
        let subAssemblyLayout = "";
        for (const sub of this.assembly.sub_assemblies) {
            const assemblySubAssembliesPartsLayout = new NestedAssembliesPartsLayout(this.jobId, sub);
            assemblySubAssembliesPartsLayout.build();
            subAssemblyLayout += assemblySubAssembliesPartsLayout.build().outerHTML;
            this.assemblySubAssembliesPartsLayouts.push(assemblySubAssembliesPartsLayout);
        }
        return subAssemblyLayout;
    }

    public async render(): Promise<void> {
        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

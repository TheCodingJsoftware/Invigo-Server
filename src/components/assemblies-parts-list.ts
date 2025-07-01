import { BaseComponent } from "@interfaces/base-component";
import { Assembly } from "@models/assembly";
import { Component } from "@models/component";
import { LaserCutPart } from "@models/laser-cut-part";

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
            <nav>
                <h4 class="max">Laser Cut Parts</h4>
                <button class="circle transparent hide-on-print" id="toggle-button">
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
        this.element.id = `laser-cut-parts-component-${this.jobId}-${this.assembly.getSafeIdName()}`;

        return this.element;
    }
}

export class AssemblyLaserCutPartsTable  {
    jobId: number;
    assembly: Assembly;
    laserCutParts: LaserCutPart[];
    element!: HTMLElement;

    constructor(jobId: number, assembly: Assembly) {
        this.jobId = jobId;
        this.assembly = assembly;
        this.laserCutParts = assembly.laser_cut_parts;
    }

    generatePartsTable(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <table class="border">
            <thead>
                ${this.generatePartsTableHeader()}
            </thead>
            <tbody>
                ${this.generatePartsTableBody()}
                ${this.generatePartsTableFooter()}
            </tbody>
        </table>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `laser-cut-parts-table-${this.jobId}-${this.assembly.getSafeIdName()}`;

        return this.element;
    }

    generatePartsTableHeader(): string {
        let partsTableHeader = `
            <tr>
                <th data-column="assembly-laser-cut-part-partName">Part Name</th>
                <th class="center-align" data-column="assembly-laser-cut-part-material">Material</th>
                <th class="center-align" data-column="assembly-laser-cut-part-process">Process</th>
                <th class="center-align" data-column="assembly-laser-cut-part-notes">Notes</th>
                <th class="center-align" data-column="assembly-laser-cut-part-shelfNumber">Shelf #</th>
                <th class="center-align" data-column="assembly-laser-cut-part-unitQuantity">Unit Qty</th>
                <th class="center-align" data-column="assembly-laser-cut-part-quantity">Qty</th>
                <th class="center-align" data-column="assembly-laser-cut-part-unitPrice">Unit Price</th>
                <th class="center-align" data-column="assembly-laser-cut-part-price">Price</th>
            </tr>`;
        return partsTableHeader.trim();
    }

    generatePartsTableBody(): string {
        let partsTable = "";
        for (const laserCutPart of this.laserCutParts) {
            const material = laserCutPart.gauge + "<br>" + laserCutPart.material;
            const process = laserCutPart.flow_tag.tags.join(" ➜ ");
            const notes = laserCutPart.notes;
            const shelfNumber = laserCutPart.shelf_number;
            const unitQuantity = laserCutPart.quantity;
            const quantity = unitQuantity * this.assembly.assembly_data.quantity;
            const unitPrice = laserCutPart.price;
            const price = unitPrice * quantity;
            partsTable += `
            <tr>
                <td class="min" data-column="assembly-laser-cut-part-partName">
                    <div class="row">
                        <img class="square extra small-round" src="http://invi.go/images/${laserCutPart.image_index}">
                        <span class="wrap no-line small-width">${laserCutPart.name}</span>
                    </div>
                </td>
                <td class="min center-align" data-column="assembly-laser-cut-part-material">${material}</td>
                <td class="center-align" data-column="assembly-laser-cut-part-process">${process}</td>
                <td class="left-align" data-column="assembly-laser-cut-part-notes">${notes}</td>
                <td class="min center-align" data-column="assembly-laser-cut-part-shelfNumber">${shelfNumber}</td>
                <td class="min center-align" data-column="assembly-laser-cut-part-unitQuantity">${unitQuantity}</td>
                <td class="min center-align" data-column="assembly-laser-cut-part-quantity">${quantity}</td>
                <td class="min center-align" data-column="assembly-laser-cut-part-unitPrice">${this.formatPrice(unitPrice)}</td>
                <td class="min center-align" data-column="assembly-laser-cut-part-price">${this.formatPrice(price)}</td>
            </tr>
            `;
        }
        return partsTable.trim();
    }

    generatePartsTableFooter(): string {
        let totalPrice = 0;
        for (const laserCutPart of this.laserCutParts) {
            totalPrice += laserCutPart.price * laserCutPart.quantity * this.assembly.assembly_data.quantity;
        }
        let partsTableFooter = `
            <tr>
                <th data-column="assembly-laser-cut-part-partName"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-material"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-process"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-notes"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-shelfNumber"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-unitQuantity"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-quantity"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-unitPrice"></th>
                <th class="min center-align" data-column="assembly-laser-cut-part-price">${this.formatPrice(totalPrice)}</th>
            </tr>`;
        return partsTableFooter.trim();
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
            <nav>
                <h4 class="max">Components</h4>
                <button class="circle transparent hide-on-print" id="toggle-button">
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
        this.element.id = `components-component-${this.jobId}-${this.assembly.getSafeIdName()}`;

        return this.element;
    }
}

export class AssemblyComponentsTable  {
    jobId: number;
    assembly: Assembly;
    components: Component[];
    element!: HTMLElement;

    constructor(jobId: number, assembly: Assembly) {
        this.jobId = jobId;
        this.assembly = assembly;
        this.components = assembly.components;
    }

    generatePartsTable(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <table class="border">
            <thead>
                ${this.generatePartsTableHeader()}
            </thead>
            <tbody>
                ${this.generatePartsTableBody()}
                ${this.generatePartsTableFooter()}
            </tbody>
        </table>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `components-table-${this.jobId}-${this.assembly.getSafeIdName()}`;

        return this.element;
    }

    generatePartsTableHeader(): string {
        let partsTableHeader = `
            <tr>
                <th data-column="assembly-component-partName">Part Name</th>
                <th class="center-align" data-column="assembly-component-partNumber">Part Number</th>
                <th class="center-align" data-column="assembly-component-notes">Notes</th>
                <th class="center-align" data-column="assembly-component-shelfNumber">Shelf #</th>
                <th class="center-align" data-column="assembly-component-unitQuantity">Unit Qty</th>
                <th class="center-align" data-column="assembly-component-quantity">Qty</th>
                <th class="center-align" data-column="assembly-component-unitPrice">Unit Price</th>
                <th class="center-align" data-column="assembly-component-price">Price</th>
            </tr>`;
        return partsTableHeader.trim();
    }

    generatePartsTableBody(): string {
        let partsTable = "";
        for (const component of this.components) {
            const notes = component.notes;
            const shelfNumber = component.shelf_number;
            const unitQuantity = component.quantity;
            const quantity = unitQuantity * this.assembly.assembly_data.quantity;
            const unitPrice = component.price;
            const price = unitPrice * quantity;
            partsTable += `
            <tr>
                <td class="min" data-column="assembly-component-partName">
                    <div class="row">
                        <img class="square extra small-round" src="http://invi.go/images/${component.image_path}">
                        <span class="wrap no-line">${component.part_name}</span>
                    </div>
                </td>
                <td class="min center-align" data-column="assembly-component-partNumber">${component.part_number}</td>
                <td class="left-align" data-column="assembly-component-notes">${notes}</td>
                <td class="min center-align" data-column="assembly-component-shelfNumber">${shelfNumber}</td>
                <td class="min center-align" data-column="assembly-component-unitQuantity">${unitQuantity}</td>
                <td class="min center-align" data-column="assembly-component-quantity">${quantity}</td>
                <td class="min center-align" data-column="assembly-component-unitPrice">${this.formatPrice(unitPrice)}</td>
                <td class="min center-align" data-column="assembly-component-price">${this.formatPrice(price)}</td>
            </tr>
            `;
        }
        return partsTable.trim();
    }

    generatePartsTableFooter(): string {
        let totalPrice = 0;
        for (const component of this.components) {
            totalPrice += component.price * component.quantity * this.assembly.assembly_data.quantity;
        }
        let partsTableFooter = `
            <tr>
                <th data-column="assembly-component-partName"></th>
                <th class="center-align" data-column="assembly-component-partNumber"></th>
                <th class="center-align" data-column="assembly-component-notes"></th>
                <th class="center-align" data-column="assembly-component-shelfNumber"></th>
                <th class="center-align" data-column="assembly-component-unitQuantity"></th>
                <th class="center-align" data-column="assembly-component-quantity"></th>
                <th class="center-align" data-column="assembly-component-unitPrice"></th>
                <th class="min center-align" data-column="assembly-component-price">${this.formatPrice(totalPrice)}</th>
            </tr>`;
        return partsTableFooter.trim();
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

export class AssembliesPartsList implements BaseComponent{
    assembly: Assembly;
    jobId: number;
    element!: HTMLElement;

    private assemblyLaserCutPartsComponent?: AssemblyLaserCutPartsComponent;
    private assemblyComponentsComponent?: AssemblyComponentsComponent;
    // private assemblyStructuralComponentsComponent?: AssemblyStructuralComponentsComponent;

    constructor(jobId: number, assembly: Assembly) {
        this.jobId = jobId;
        this.assembly = assembly;
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav class="row tiny-padding top-align">
                <img src="http://invi.go/image/${this.assembly.assembly_data.assembly_image}" class="round border" style="height: 150px; width: auto;">
                <div class="max">
                    <h6>${this.assembly.assembly_data.name}</h6>
                    <div>Assembly quantity: ${this.assembly.assembly_data.quantity}</div>
                    <div>Process: ${this.assembly.generateProcessTagString()}</div>
                    <div>Paint: ${this.assembly.assembly_data.paint_name}</div>
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
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assembly-parts-list-layout-${this.jobId}-${this.assembly.getSafeIdName()}`;

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

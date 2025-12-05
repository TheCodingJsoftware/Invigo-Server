import {BaseComponent} from "@interfaces/base-component";
import {ComponentGroup} from "@models/component-group";
import {Job} from "@models/job";
import {LaserCutPartGroup} from "@models/laser-cut-part-group";


class GroupedLaserCutParts {
    laserCutParts: LaserCutPartGroup[];
    private jobId: number;
    private element!: HTMLElement;

    constructor(jobId: number, laserCutParts: LaserCutPartGroup[]) {
        this.jobId = jobId;
        this.laserCutParts = laserCutParts;
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
                    ${new GroupedLaserCutPartsTable(this.jobId, this.laserCutParts).generatePartsTable()}
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assemblies-grouped-laser-cut-parts-table-${this.jobId}`;

        return this.element;
    }
}

class GroupedLaserCutPartsTable {
    jobId: number;
    laserCutParts: LaserCutPartGroup[];
    element!: HTMLElement;

    constructor(jobId: number, laserCutParts: LaserCutPartGroup[]) {
        this.jobId = jobId;
        this.laserCutParts = laserCutParts;
    }

    generatePartsTable(): string {
        const table = `
        <table class="border tiny-space">
            <thead>
                ${this.generatePartsTableHeader()}
            </thead>
            <tbody>
                ${this.generatePartsTableBody()}
                ${this.generatePartsTableFooter()}
            </tbody>
        </table>
        `.trim(); // Trim leading whitespace

        return table;
    }

    generatePartsTableHeader(): string {
        let partsTableHeader = `
            <tr>
                <th data-column="assembly-laser-cut-part-partPicture"></th>
                <th data-column="assembly-laser-cut-part-partName">Part Name</th>
                <th class="center-align" data-column="assembly-laser-cut-part-coating">Coating</th>
                <th class="center-align" data-column="assembly-laser-cut-part-material">Material</th>
                <th class="center-align" data-column="assembly-laser-cut-part-process">Process</th>
                <th class="center-align" data-column="assembly-laser-cut-part-notes">Notes</th>
                <th class="center-align" data-column="assembly-laser-cut-part-shelfNumber">Shelf #</th>
                <th class="center-align" data-column="assembly-laser-cut-part-quantity">Qty</th>
                <th class="center-align" data-column="assembly-laser-cut-part-unitPrice">Unit Price</th>
                <th class="center-align" data-column="assembly-laser-cut-part-price">Price</th>
            </tr>`;
        return partsTableHeader.trim();
    }

    generatePartsTableBody(): string {
        let partsTable = "";
        for (const laserCutPart of this.laserCutParts) {
            const coating = laserCutPart.getCoating();
            const material = laserCutPart.getMaterial();
            const process = laserCutPart.getProcess();
            const notes = laserCutPart.getNotes();
            const shelfNumber = laserCutPart.getShelfNumber();
            const quantity = laserCutPart.getTotalQuantity();
            const unitPrice = laserCutPart.getPrice();
            const price = laserCutPart.getTotalPrice();
            partsTable += `
            <tr>
                <td data-column="assembly-laser-cut-part-partPicture">
                    <img class="square extra small-round" src="http://invi.go/images/${laserCutPart.getImagePath()}">
                </td>
                <td data-column="assembly-laser-cut-part-partName">
                    <span>${laserCutPart.name}</span>
                </td>
                <td class="center-align" data-column="assembly-laser-cut-part-coating">${coating}</td>
                <td class="center-align" data-column="assembly-laser-cut-part-material">${material}</td>
                <td class="center-align" data-column="assembly-laser-cut-part-process">${process}</td>
                <td class="center-align" data-column="assembly-laser-cut-part-notes">${notes}</td>
                <td class="center-align" data-column="assembly-laser-cut-part-shelfNumber">${shelfNumber}</td>
                <td class="center-align" data-column="assembly-laser-cut-part-quantity">${this.formatQuantity(quantity)}</td>
                <td class="center-align" data-column="assembly-laser-cut-part-unitPrice">${this.formatPrice(unitPrice)}</td>
                <td class="center-align" data-column="assembly-laser-cut-part-price">${this.formatPrice(price)}</td>
            </tr>
            `;
        }
        return partsTable.trim();
    }

    generatePartsTableFooter(): string {
        let totalPrice = 0;
        let totalQuantity = 0;
        let totalUnitPrice = 0;
        for (const laserCutPart of this.laserCutParts) {
            totalPrice += laserCutPart.getTotalPrice();
            totalUnitPrice += laserCutPart.getPrice();
            totalQuantity += laserCutPart.getTotalQuantity();
        }
        let partsTableFooter = `
            <tr>
                <th data-column="assembly-laser-cut-part-partPicture"></th>
                <th data-column="assembly-laser-cut-part-partName"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-coating"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-material"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-process"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-notes"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-shelfNumber"></th>
                <th class="center-align" data-column="assembly-laser-cut-part-quantity">${this.formatQuantity(totalQuantity)}</th>
                <th class="center-align" data-column="assembly-laser-cut-part-unitPrice">${this.formatPrice(totalUnitPrice)}</th>
                <th class="center-align" data-column="assembly-laser-cut-part-price">${this.formatPrice(totalPrice)}</th>
            </tr>`;
        return partsTableFooter.trim();
    }

    private formatQuantity(quantity: number): string {
        return quantity.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 0});
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

class GroupedComponents {
    private jobId: number;
    private components: ComponentGroup[];
    private element!: HTMLElement;

    constructor(jobId: number, components: ComponentGroup[]) {
        this.jobId = jobId;
        this.components = components;
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
                    ${new GroupedComponentsTable(this.jobId, this.components).generatePartsTable()}
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assemblies-grouped-components-table-${this.jobId}`;

        return this.element;
    }
}

class GroupedComponentsTable {
    jobId: number;
    components: ComponentGroup[];
    element!: HTMLElement;

    constructor(jobId: number, components: ComponentGroup[]) {
        this.jobId = jobId;
        this.components = components;
    }

    generatePartsTable(): string {
        const table = `
        <table class="border tiny-space">
            <thead>
                ${this.generatePartsTableHeader()}
            </thead>
            <tbody>
                ${this.generatePartsTableBody()}
                ${this.generatePartsTableFooter()}
            </tbody>
            </table>
        `.trim(); // Trim leading whitespace
        return table;
    }

    generatePartsTableHeader(): string {
        let partsTableHeader = `
            <tr>
                <th data-column="assembly-component-partPicture"></th>
                <th data-column="assembly-component-partName">Part Name</th>
                <th class="center-align" data-column="assembly-component-partNumber">Part Number</th>
                <th class="center-align" data-column="assembly-component-notes">Notes</th>
                <th class="center-align" data-column="assembly-component-shelfNumber">Shelf #</th>
                <th class="center-align" data-column="assembly-component-quantity">Qty</th>
                <th class="center-align" data-column="assembly-component-unitPrice">Unit Price</th>
                <th class="center-align" data-column="assembly-component-price">Price</th>
            </tr>`;
        return partsTableHeader.trim();
    }

    generatePartsTableBody(): string {
        let partsTable = "";
        for (const component of this.components) {
            const notes = component.getNotes();
            const shelfNumber = component.getShelfNumber();
            const quantity = component.getTotalQuantity();
            const unitPrice = component.getPrice();
            const price = unitPrice * quantity;
            partsTable += `
            <tr>
                <td data-column="assembly-component-partPicture">
                    <img class="square extra small-round" src="http://invi.go/images/${component.getImagePath()}">
                </td>
                <td data-column="assembly-component-partName">
                    <span>${component.name}</span>
                </td>
                <td class="center-align" data-column="assembly-component-partNumber">${component.getPartNumber()}</td>
                <td class="left-align" data-column="assembly-component-notes">${notes}</td>
                <td class="center-align" data-column="assembly-component-shelfNumber">${shelfNumber}</td>
                <td class="center-align" data-column="assembly-component-quantity">${this.formatQuantity(quantity)}</td>
                <td class="center-align" data-column="assembly-component-unitPrice">${this.formatPrice(unitPrice)}</td>
                <td class="center-align" data-column="assembly-component-price">${this.formatPrice(price)}</td>
            </tr>
            `;
        }
        return partsTable.trim();
    }

    generatePartsTableFooter(): string {
        let totalPrice = 0;
        let totalUnitPrice = 0;
        let totalQuantity = 0;
        for (const component of this.components) {
            totalPrice += component.getPrice() * component.getTotalQuantity();
            totalUnitPrice += component.getPrice();
            totalQuantity += component.getTotalQuantity();
        }
        let partsTableFooter = `
            <tr>
                <th data-column="assembly-component-partPicture"></th>
                <th data-column="assembly-component-partName"></th>
                <th class="center-align" data-column="assembly-component-partNumber"></th>
                <th class="center-align" data-column="assembly-component-notes"></th>
                <th class="center-align" data-column="assembly-component-shelfNumber"></th>
                <th class="center-align" data-column="assembly-component-quantity">${this.formatQuantity(totalQuantity)}</th>
                <th class="center-align" data-column="assembly-component-unitPrice">${this.formatPrice(totalUnitPrice)}</th>
                <th class="center-align" data-column="assembly-component-price">${this.formatPrice(totalPrice)}</th>
            </tr>`;
        return partsTableFooter.trim();
    }

    private formatQuantity(quantity: number): string {
        return quantity.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 0});
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

export class AssembliesGroupedPartsList implements BaseComponent {
    job: Job;
    jobId: number;
    element!: HTMLElement;
    groupedLaserCutPartsTable!: GroupedLaserCutParts;
    groupedComponentsTable!: GroupedComponents;

    constructor(jobId: number, job: Job) {
        this.jobId = jobId;
        this.job = job;
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
            <div>
                <div id="assemblies-grouped-laser-cut-parts-container-${this.jobId}">
                    ${this.generateGroupedLaserCutPartsTable().outerHTML}
                </div>
                <div id="assemblies-grouped-components-container-${this.jobId}">
                    ${this.generateGroupedComponentsTable().outerHTML}
                </div>
            </div>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `assemblies-grouped-parts-list-element-${this.jobId}`;

        return this.element;
    }

    generateGroupedLaserCutPartsTable(): HTMLElement {
        const laserCutParts = this.job.getAllGroupedAssemblyLaserCutParts();
        console.log(laserCutParts);

        if (laserCutParts.length === 0) return document.createElement("div");
        this.groupedLaserCutPartsTable = new GroupedLaserCutParts(this.jobId, laserCutParts);
        return this.groupedLaserCutPartsTable.build();
    }

    generateGroupedComponentsTable(): HTMLElement {
        const components = this.job.getAllGroupedAssemblyComponents();
        if (components.length === 0) return document.createElement("div");
        this.groupedComponentsTable = new GroupedComponents(this.jobId, components);
        return this.groupedComponentsTable.build();
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

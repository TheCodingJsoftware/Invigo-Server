import { BaseComponent } from "@interfaces/base-component";
import { LaserCutPart } from "@models/laser-cut-part";
import { LaserCutPartGroup } from "@models/laser-cut-part-group";
import { Nest } from "@models/nest";
import { naturalCompare } from "@utils/natural-sort";


export class NestedPartsSummary implements BaseComponent {
    jobId: number;
    nests: Nest[];
    element!: HTMLElement;

    constructor(jobId: number, nests: Nest[]) {
        this.jobId = jobId;
        this.nests = nests;
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border">
            <nav>
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">Nested Parts Summary</h4>
                <button class="circle transparent hide-on-print" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="grid small-padding hide-on-print">
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-partName" checked>
                        <span>Part Name</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-material" checked>
                        <span>Material</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-process" checked>
                        <span>Process</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-notes" checked>
                        <span>Notes</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-shelfNumber" checked>
                        <span>Shelf #</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-quantity" checked>
                        <span>Quantity</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-unitPrice" checked>
                        <span>Unit Price</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-price" checked>
                        <span>Price</span>
                    </label>
                </div>
                <table class="border tiny-space">
                    <thead>
                        <tr>
                            <th data-column="nest-part-partName">Part Name</th>
                            <th class="center-align" data-column="nest-part-material">Material</th>
                            <th class="center-align" data-column="nest-part-process">Process</th>
                            <th class="center-align" data-column="nest-part-notes">Notes</th>
                            <th class="center-align" data-column="nest-part-shelfNumber">Shelf #</th>
                            <th class="center-align" data-column="nest-part-quantity">Qty</th>
                            <th class="center-align" data-column="nest-part-unitPrice">Unit Price</th>
                            <th class="center-align" data-column="nest-part-price">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generatePartsTableBody()}
                        ${this.generatePartsTableFooter()}
                    </tbody>
                </table>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `nested-parts-${this.jobId}`;

        // this.initializeCheckboxes();



        return this.element;
    }

    // private initializeCheckboxes() {
    //     if (!this.element) return;

    //     const checkboxes = this.element.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    //     const headerCells = this.element.querySelectorAll('thead th') as NodeListOf<HTMLElement>;

    //     const columnIndexMap: Record<string, number> = {};
    //     headerCells.forEach((th, index) => {
    //         const col = th.dataset.column;
    //         if (col) columnIndexMap[col] = index;
    //     });

    //     checkboxes.forEach(checkbox => {
    //         const column = checkbox.id.replace("show-", ""); // e.g., "show-material" -> "material"
    //         const index = columnIndexMap[column];
    //         if (index === undefined) return;

    //         const key = `show-nested-parts-column-${column}`;
    //         const storedState = localStorage.getItem(key);
    //         checkbox.checked = storedState !== 'false'; // default to true

    //         const toggleColumnVisibility = (visible: boolean) => {
    //             const th = headerCells[index];
    //             const cells = this.element!.querySelectorAll(`tr`) as NodeListOf<HTMLTableRowElement>;
    //             if (th) th.classList.toggle('hidden', !visible);
    //             cells.forEach(row => {
    //                 const cell = row.children[index];
    //                 if (cell) cell.classList.toggle('hidden', !visible);
    //             });
    //         };

    //         // Initial state
    //         toggleColumnVisibility(checkbox.checked);

    //         // On change
    //         checkbox.addEventListener('change', () => {
    //             localStorage.setItem(key, String(checkbox.checked));
    //             toggleColumnVisibility(checkbox.checked);
    //         });
    //     });
    // }

    generatePartsTableBody(): string {
        let nestSummaryTable = "";
        for (const group of this.getAllGroupedLaserCutParts()) {
            const material = group.getMaterial();
            const process = group.getProcess();
            const notes = group.getNotes();
            const shelfNumber = group.getShelfNumber();
            const quantity = group.getQuantity();
            const unitPrice = group.getPrice();
            const price = group.getTotalPrice();
            nestSummaryTable += `
            <tr>
                <td class="min" data-column="nest-part-partName">
                    <div class="row">
                        <img class="square extra small-round" src="http://invi.go/images/${group.getImagePath()}">
                        <span class="wrap no-line small-width">${group.name}</span>
                    </div>
                </td>
                <td class="center-align" data-column="nest-part-material">${material}</td>
                <td class="center-align" data-column="nest-part-process">${process}</td>
                <td class="left-align" data-column="nest-part-notes">${notes}</td>
                <td class="center-align" data-column="nest-part-shelfNumber">${shelfNumber}</td>
                <td class="center-align" data-column="nest-part-quantity">${quantity}</td>
                <td class="center-align" data-column="nest-part-unitPrice">${this.formatPrice(unitPrice)}</td>
                <td class="center-align" data-column="nest-part-price">${this.formatPrice(price)}</td>
            </tr>
            `;
        }
        return nestSummaryTable.trim();
    }

    generatePartsTableFooter(): string {
        let partsTableFooter = "";
        let totalQuantity = 0;
        let totalPrice = 0;
        for (const nest of this.nests) {
            for (const laserCutPart of nest.laser_cut_parts) {
                const unitQuantity = laserCutPart.inventory_data.quantity;
                const quantity = unitQuantity * nest.sheet_count;
                const price = laserCutPart.prices.price * unitQuantity;
                totalQuantity += quantity;
                totalPrice += price;
            }
        }
        partsTableFooter = `
        <tr>
            <th data-column="nest-part-partName"></th>
            <th class="center-align" data-column="nest-part-material"></th>
            <th class="center-align" data-column="nest-part-process"></th>
            <th class="center-align" data-column="nest-part-notes"></th>
            <th class="center-align" data-column="nest-part-shelfNumber"></th>
            <th class="center-align" data-column="nest-part-quantity">${totalQuantity}</th>
            <th class="center-align" data-column="nest-part-unitPrice"></th>
            <th class="center-align" data-column="nest-part-price">${this.formatPrice(totalPrice)}</th>
        </tr>`;
        return partsTableFooter.trim();
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    private getAllParts(): LaserCutPart[] {
        let allParts: LaserCutPart[] = [];
        for (const nest of this.nests) {
            allParts = allParts.concat(nest.laser_cut_parts);
        }
        return allParts;
    }

    public getAllGroupedLaserCutParts(): LaserCutPartGroup[] {
        let LaserCutPartGroups: LaserCutPartGroup[] = [];
        for (const part of this.getAllParts()) {
            const group = LaserCutPartGroups.find(group => group.name === part.name);
            if (group) {
                group.laser_cut_parts.push(part);
            } else {
                LaserCutPartGroups.push(new LaserCutPartGroup({
                    name: part.name,
                    base_part: part,
                    laser_cut_parts: [part]
                }));
            }
        }
        return LaserCutPartGroups.sort((a, b) => naturalCompare(a.name, b.name));
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#nested-sheets-parts-summary-container') as HTMLDivElement;
        container.appendChild(this.build());
        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

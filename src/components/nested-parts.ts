import { BaseComponent } from "@interfaces/base-component";
import { LaserCutPart } from "@models/laser-cut-part";
import { LaserCutPartGroup } from "@models/laser-cut-part-group";
import { Nest } from "@models/nest";
import { naturalCompare } from "@utils/natural-sort";


export class NestedParts implements BaseComponent {
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
            <nav class="hide-on-print">
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">Nested Sheets Parts</h4>
                <button class="circle transparent" id="toggle-button">
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
                        <input type="checkbox" id="show-nest-part-nestQuantity" checked>
                        <span>Nest Quantity</span>
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
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-part-weight" checked>
                        <span>Weight</span>
                    </label>
                </div>
                ${this.generatePartsTable()}
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `nested-sheets-parts-${this.jobId}`;

        return this.element;
    }

    generatePartsTable(): string {
        let partsTable = "";
        for (const nest of this.nests) {
            partsTable += `
                <article class="round border">
                    <nav>
                        <h4 class="max">${nest.sheet.name} ${nest.name}</h4>
                        <button class="circle transparent hide-on-print" id="toggle-button">
                            <i class="rotate-180">expand_more</i>
                        </button>
                    </nav>
                    <div class="content-wrapper" style="height: auto;">
                        <img class="responsive round" src="/images/${nest.image_path}" class="responsive">
                        <table class="border tiny-space">
                            <thead>
                                <tr>
                                    <th data-column="nest-part-partName">Part Name / Number</th>
                                    <th class="center-align" data-column="nest-part-material">Material</th>
                                    <th class="center-align" data-column="nest-part-weight">Weight</th>
                                    <th class="center-align" data-column="nest-part-process">Process</th>
                                    <th class="center-align" data-column="nest-part-notes">Notes</th>
                                    <th class="center-align" data-column="nest-part-shelfNumber">Shelf #</th>
                                    <th class="center-align" data-column="nest-part-nestQuantity">Nest Qty</th>
                                    <th class="center-align" data-column="nest-part-quantity">Qty</th>
                                    <th class="center-align" data-column="nest-part-unitPrice">Unit Price</th>
                                    <th class="center-align" data-column="nest-part-price">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.generatePartsTableBody(nest)}
                                ${this.generatePartsTableFooter(nest)}
                            </tbody>
                        </table>
                    </div>
                </article>`
        }
        return partsTable.trim();
    }

    generatePartsTableBody(nest: Nest): string {
        let nestSummaryTable = "";
        const sortedParts = [...nest.laser_cut_parts].sort((a, b) => {
            return Number(a.meta_data.part_number) - Number(b.meta_data.part_number);
        });
        for (const laserCutPart of sortedParts) {
            const partNumber = laserCutPart.meta_data.part_number;
            const material = laserCutPart.meta_data.gauge + "<br>" + laserCutPart.meta_data.material;
            const process = laserCutPart.workspace_data.flowtag.tags.join(" ➜ ");
            const notes = laserCutPart.meta_data.notes;
            const shelfNumber = laserCutPart.meta_data.shelf_number;
            const unitQuantity = laserCutPart.inventory_data.quantity;
            const quantity = unitQuantity;
            const unitPrice = laserCutPart.prices.price;
            const weight = laserCutPart.meta_data.weight * unitQuantity;
            const price = unitPrice * unitQuantity;
            nestSummaryTable += `
            <tr>
                <td class="min" data-column="nest-part-partName">
                    <div class="row">
                        <img class="square extra small-round" src="/images/${laserCutPart.meta_data.image_index}">
                        <div class="vertical">
                            <span class="wrap no-line">${laserCutPart.name}</span>
                            <span><i>tag</i> ${partNumber}</span>
                        </div>
                    </div>
                </td>
                <td class="center-align" data-column="nest-part-material">${material}</td>
                <td class="center-align" data-column="nest-part-weight">${this.formatWeight(weight)}</td>
                <td class="center-align" data-column="nest-part-process">${process}</td>
                <td class="left-align" data-column="nest-part-notes">${notes}</td>
                <td class="center-align" data-column="nest-part-shelfNumber">${shelfNumber}</td>
                <td class="center-align" data-column="nest-part-nestQuantity">${unitQuantity}</td>
                <td class="center-align" data-column="nest-part-quantity">${quantity}</td>
                <td class="center-align" data-column="nest-part-unitPrice">${this.formatPrice(unitPrice)}</td>
                <td class="center-align" data-column="nest-part-price">${this.formatPrice(price)}</td>
            </tr>
            `;
        }
        return nestSummaryTable.trim();
    }

    generatePartsTableFooter(nest: Nest): string {
        let partsTableFooter = "";
        let totalQuantity = 0;
        let totalUnitQuantity = 0;
        let totalPrice = 0;
        let totalWeight = 0;
        for (const laserCutPart of nest.laser_cut_parts) {
            const unitQuantity = laserCutPart.inventory_data.quantity;
            const quantity = unitQuantity;
            const price = laserCutPart.prices.price * unitQuantity;
            const weight = laserCutPart.meta_data.weight * unitQuantity;
            totalWeight += weight;
            totalQuantity += quantity;
            totalUnitQuantity += unitQuantity;
            totalPrice += price;
        }
        partsTableFooter = `
        <tr>
            <th data-column="nest-part-partName"></th>
            <th class="center-align" data-column="nest-part-material"></th>
            <th class="center-align" data-column="nest-part-weight">${this.formatWeight(totalWeight)}</th>
            <th class="center-align" data-column="nest-part-process"></th>
            <th class="center-align" data-column="nest-part-notes"></th>
            <th class="center-align" data-column="nest-part-shelfNumber"></th>
            <th class="center-align" data-column="nest-part-nestQuantity"></th>
            <th class="center-align" data-column="nest-part-quantity">${totalQuantity}</th>
            <th class="center-align" data-column="nest-part-unitPrice"></th>
            <th class="center-align" data-column="nest-part-price">${this.formatPrice(totalPrice)}</th>
        </tr>`;
        return partsTableFooter.trim();
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
        const container = document.querySelector('#nested-sheets-parts-container') as HTMLDivElement;
        container.appendChild(this.build());
        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }

    private formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    private formatQuantity(quantity: number): string {
        return quantity.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    private formatWeight(weight: number): string {
        return `${weight.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lbs`;
    }

    private getAllParts(): LaserCutPart[] {
        let allParts: LaserCutPart[] = [];
        for (const nest of this.nests) {
            allParts = allParts.concat(nest.laser_cut_parts);
        }
        return allParts;
    }
}
import {BaseComponent} from "@interfaces/base-component";
import {Nest} from "@models/nest";

export class NestedSheetsSummary implements BaseComponent {
    nests: Nest[];
    element!: HTMLElement;
    jobId: number;

    constructor(jobId: number, nests: Nest[]) {
        this.jobId = jobId;
        this.nests = nests;
    }

    public build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav>
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">Nested Sheets Summary</h4>
                <button class="circle transparent hide-on-print" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="grid small-padding hide-on-print">
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-sheet-nestName" checked>
                        <span>Nest Name</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-sheet-material" checked>
                        <span>Material</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-sheet-dimensions" checked>
                        <span>Dimensions</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-sheet-quantity" checked>
                        <span>Quantity</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-sheet-cuttingTime" checked>
                        <span>Sheet Cut Time</span>
                    </label>
                    <label class="s12 m4 l3 checkbox">
                        <input type="checkbox" id="show-nest-sheet-nestCutTime" checked>
                        <span>Nest Cut Time</span>
                    </label>
                </div>
                <table class="border tiny-space">
                    <thead>
                        <tr>
                            <th data-column="nest-sheet-nestName">Nest Name</th>
                            <th class="center-align" data-column="nest-sheet-material">Material</th>
                            <th class="center-align" data-column="nest-sheet-dimensions">Dimensions</th>
                            <th class="center-align" data-column="nest-sheet-quantity">Quantity</th>
                            <th class="center-align" data-column="nest-sheet-cuttingTime">Sheet Cut Time</th>
                            <th class="center-align" data-column="nest-sheet-nestCutTime">Nest Cut Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateNestSummaryTable()}
                        ${this.generateNestSummaryTableFooter()}
                    </tbody>
                </table>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `nest-summary-${this.jobId}`;

        return this.element;
    }

    generateNestSummaryTable(): string {
        let nestSummaryTable = "";
        for (const nest of this.nests) {
            const material = nest.sheet.material;
            const dimensions = `${nest.sheet.length}x${nest.sheet.width}`;
            const sheetCount = nest.sheet_count;
            const cuttingTime = nest.sheet_cut_time;
            const nestCutTime = nest.sheet_cut_time * nest.sheet_count;
            nestSummaryTable += `
            <tr>
                <td data-column="nest-sheet-nestName">${nest.name}</td>
                <td class="center-align" data-column="nest-sheet-material">${material}</td>
                <td class="center-align" data-column="nest-sheet-dimensions">${dimensions}</td>
                <td class="center-align" data-column="nest-sheet-quantity">${sheetCount}</td>
                <td class="center-align" data-column="nest-sheet-cuttingTime">${this.formatDuration(cuttingTime)}</td>
                <td class="center-align" data-column="nest-sheet-nestCutTime">${this.formatDuration(nestCutTime)}</td>
            </tr>
            `;
        }
        return nestSummaryTable.trim();
    }

    generateNestSummaryTableFooter(): string {
        let nestSummaryTableFooter = "";
        let totalQuantity = 0;
        let totalNestCutTime = 0;
        for (const nest of this.nests) {
            const sheetCount = nest.sheet_count;
            const nestCutTime = nest.sheet_cut_time * nest.sheet_count;
            totalQuantity += sheetCount;
            totalNestCutTime += nestCutTime;
        }
        nestSummaryTableFooter = `
        <tr>
            <th data-column="nest-sheet-nestName"></th>
            <th class="center-align" data-column="nest-sheet-material"></th>
            <th class="center-align" data-column="nest-sheet-dimensions"></th>
            <th class="center-align" data-column="nest-sheet-quantity">${totalQuantity}</th>
            <th class="center-align" data-column="nest-sheet-cuttingTime"></th>
            <th class="center-align" data-column="nest-sheet-nestCutTime">${this.formatDuration(totalNestCutTime)}</th>
        </tr>`;
        return nestSummaryTableFooter.trim();
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#nested-sheets-summary-container') as HTMLDivElement;
        container.appendChild(this.build());

        // this.initializeCheckboxes();

        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }

    private formatDuration(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        const pad = (n: number) => n.toString().padStart(2, "0");

        return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
    }
}

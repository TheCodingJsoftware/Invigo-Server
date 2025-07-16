import { BaseComponent } from "@interfaces/base-component";
import { Nest } from "@models/nest";
import QRCode from 'qrcode';

export class NestedSheets implements BaseComponent {
    nests: Nest[];
    jobId: number;
    element!: HTMLElement;

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
                <h4 class="max">Nested Sheets</h4>
                <nav class="group connected primary-container hide-on-print">
                    <button class="left-round" id="grid-cozy-button">
                        <i>view_cozy</i>
                    </button>
                    <button class="right-round" id="list-button">
                        <i>view_list</i>
                    </button>
                </nav>
                <button class="circle transparent hide-on-print" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                <div class="small-padding hide-on-print">
                    <label class="checkbox">
                        <input type="checkbox" id="show-QRCode" checked>
                        <span>QR Code</span>
                    </label>
                </div>
                <div class="grid" id="nested-sheets-grid-view">${this.generateNestedSheetsGridView()}</div>
                <div id="nested-sheets-list-view">
                    <table class="border tiny-space">
                        <thead>
                            ${this.generateTableHeader()}
                        </thead>
                        <tbody>
                            ${this.generateNestedSheetsListViewBody()}
                        </tbody>
                    </table>
                </div>
            </div>
        </article>
        `.trim(); // Trim leading whitespace

        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `nested-sheets-${this.jobId}`;

        return this.element;
    }

    private getNestedSheetGridHTML(nest: Nest): string {
        const sheetCount = nest.sheet_count;
        const cuttingTime = nest.sheet_cut_time;
        const nestCutTime = nest.sheet_cut_time * nest.sheet_count;
        const totalParts = nest.laser_cut_parts.reduce((total, part) => total + part.quantity * nest.sheet_count, 0);
        return `
        <div class="s6">
            <article class="nest no-padding border round">
                <img class="responsive small top-round nest-image" src="http://invi.go/image/${nest.image_path}" class="responsive">
                <div class="padding">
                    <nav class="row">
                        <div class="max bold large-text">${nest.name}</div>
                        <h6>× ${sheetCount}</h6>
                    </nav>
                    <div>${nest.sheet.name}</div>
                    <div>Total Parts: ${totalParts}</div>
                    <div>Sheet Cut Time: ${this.formatDuration(cuttingTime)}</div>
                    <div>Nest Cut Time: ${this.formatDuration(nestCutTime)}</div>
                </div>
            </article>
        </div>
        `;
    }

    private generateNestedSheetsGridView(): string {
        let nestedSheets = "";
        for (const nest of this.nests) {
            nestedSheets += this.getNestedSheetGridHTML(nest);
        }
        return nestedSheets.trim();
    }

    generateNestedSheetsListHTML(nest: Nest): string {
        const sheetCount = nest.sheet_count;
        const cuttingTime = nest.sheet_cut_time;
        const nestCutTime = nest.sheet_cut_time * nest.sheet_count;
        const totalParts = nest.laser_cut_parts.reduce((total, part) => total + part.quantity * nest.sheet_count, 0);
        return `
        <div class="s12">
            <article class="nest no-padding border round">
                <img class="responsive small top-round nest-image" src="http://invi.go/image/${nest.image_path}" class="responsive">
                <div class="padding">
                    <nav class="row">
                        <h6 class="max">${nest.name}</h6>
                        <h6>× ${sheetCount}</h6>
                    </nav>
                    <div>${nest.sheet.name}</div>
                    <div>Total Parts: ${totalParts}</div>
                    <div>Sheet Cut Time: ${this.formatDuration(cuttingTime)}</div>
                    <div>Nest Cut Time: ${this.formatDuration(nestCutTime)}</div>
                </div>
            </article>
        </div>
        `;
    }

    generateNestedSheetsListViewBody(): string {
        let nestedSheets = ``;
        for (const nest of this.nests) {
            const sheetCount = nest.sheet_count;
            const totalParts = nest.laser_cut_parts.reduce((total, part) => total + part.quantity * nest.sheet_count, 0);
            const cuttingTime = nest.sheet_cut_time;
            const nestCutTime = nest.sheet_cut_time * nest.sheet_count;
            const safeId = nest.getSafeIdName();

            nestedSheets += `
                <tr>
                    <td class="min" data-column="QRCode">
                        <canvas class="small-round border" id="QRCode-${safeId}"></canvas>
                    </td>
                    <td class="max">
                        <nav class="row tiny-padding">
                            <img src="http://invi.go/image/${nest.image_path}" class="round border nest-image-list">
                            <div class="max">
                                <h6>${nest.name}</h6>
                                <div>${nest.sheet.name}</div>
                                <div>Total Parts: ${totalParts}</div>
                                <div>Sheet Cutting Time: ${this.formatDuration(cuttingTime)}</div>
                                <div>Nest Cut Time: ${this.formatDuration(nestCutTime)}</div>
                            </div>
                        </nav>
                    </td>
                    <td class="center-align min"><h5>× ${sheetCount}</h5></td>
                </tr>
            `;
        }
        return nestedSheets.trim();
    }

    async renderNestedSheetsQRCodes(): Promise<void> {
        for (const nest of this.nests) {
            const safeId = nest.getSafeIdName();
            const canvas = document.getElementById(`QRCode-${safeId}`) as HTMLCanvasElement;
            if (!canvas) continue;

            await QRCode.toCanvas(canvas, this.getQRCodeUrl(nest), {
                width: 150,
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
                errorCorrectionLevel: 'H',
            });
        }
    }
    getQRCodeUrl(nest: Nest): string {
        return encodeURI(`http://invi.go/sheets_in_inventory/${nest.sheet.name.replace(" ", "_")}`);
    }

    generateTableHeader(): string {
        return `
            <tr>
                <th data-column="QRCode">QR Code</th>
                <th>Nest</th>
                <th class="center-align">Quantity</th>
            </tr>
        `.trim();
    }

    private formatDuration(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        const pad = (n: number) => n.toString().padStart(2, "0");

        return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#nested-sheets-container') as HTMLDivElement;
        container.appendChild(this.build());

        const gridCozyButton = this.element.querySelector('#grid-cozy-button') as HTMLButtonElement;
        const listButton = this.element.querySelector('#list-button') as HTMLButtonElement;
        const gridView = this.element.querySelector('#nested-sheets-grid-view')!;
        const listView = this.element.querySelector('#nested-sheets-list-view')!;

        const setView = (mode: 'grid-cozy' | 'list') => {
            localStorage.setItem('nested-sheets-view', mode);

            if (mode === 'grid-cozy') {
                gridView.classList.remove('hidden');
                listView.classList.add('hidden');
            } else {
                gridView.classList.add('hidden');
                listView.classList.remove('hidden');
            }

            gridCozyButton.classList.toggle('active', mode === 'grid-cozy');
            listButton.classList.toggle('active', mode === 'list');
        };

        // Restore initial view
        const savedMode = (localStorage.getItem('nested-sheets-view') as 'grid-cozy' | 'list') || 'grid-compact';
        setView(savedMode);

        gridCozyButton.addEventListener('click', () => setView('grid-cozy'));
        listButton.addEventListener('click', () => setView('list'));

        await this.renderNestedSheetsQRCodes()

        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

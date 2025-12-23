import { UserContext } from "@core/auth/user-context";
import { WorkspaceRowCheckbox } from "@components/common/checkboxes/workspace-row-checkbox";
import { PartRow } from "@components/workspace/parts/part-row";
import { PartSelectionManager } from "@components/workspace/parts/part-selection-manager";
import { PartData } from "@components/workspace/parts/part-container";
import { LazyLoad } from "@utils/lazy-render";

export interface PartColumn {
    key: keyof PartData | 'part' | 'actions' | 'icon' | 'checkbox' | 'thumbnail' | 'files' | 'recording';
    label: string;
    render: (data: PartData) => HTMLElement | string;
}


export class PartsTable {
    readonly table: HTMLTableElement;
    readonly thead: HTMLElement;
    readonly tbody: HTMLElement;
    readonly #user = Object.freeze(UserContext.getInstance().user);
    readonly selectAllCheckbox = new WorkspaceRowCheckbox();

    private readonly columns: PartColumn[] = [
        {
            key: 'checkbox',
            label: '',
            render: () => ''
        },
        {
            key: 'part',
            label: 'Part',
            render: () => ''
        },
        {
            key: 'files',
            label: 'Files',
            render: () => ''
        },
        {
            key: 'quantity',
            label: 'Quantity',
            render: (data) => String(data.quantity)
        },
        {
            key: 'current_flowtag',
            label: 'Current Process',
            render: (data) => {
                let flowtag = data.current_flowtag;
                if (data.is_completed) {
                    flowtag = "Done";
                } else if (data.recut) {
                    flowtag = "Recutting";
                } else if (data.recoat) {
                    flowtag = "Recoating";
                }
                if (data.is_overdue) {
                    flowtag = `${flowtag} (Overdue)`;
                }
                return flowtag;
            }
        },
        {
            key: 'actions',
            label: 'Actions',
            render: () => ''
        },
        {
            key: 'recording',
            label: 'Record',
            render: () => ''
        },
        // {
        //     key: 'icon',
        //     label: '',
        //     render: (data) => {
        //         if (data.is_completed) {
        //             return "done_all"
        //         } else if (data.is_overdue) {
        //             return "assignment_late"
        //         } else {
        //             return "avg_pace"
        //         }
        //     }
        // }
    ];
    private readonly BATCH_SIZE = 100;
    private readonly BATCH_DELAY = 0;
    private readonly rowMap = new Map<string, PartRow>();

    constructor() {
        this.table = document.createElement("table") as HTMLTableElement;
        this.table.classList.add("border", "round", "prats-table");
        this.thead = document.createElement("thead");
        this.tbody = document.createElement("tbody");

        this.initialize();
    }

    initialize() {
        const headerRow = document.createElement("tr");
        for (const column of this.columns) {
            const th = document.createElement("th");

            if (column.key === 'checkbox') {
                this.selectAllCheckbox.onchange = () => {
                    const newState = this.selectAllCheckbox.checked;
                    this.selectAllCheckbox.indeterminate = false;

                    const allCheckboxes = Array.from(this.rowMap.values()).map(row => row.checkbox);
                    allCheckboxes.forEach(checkbox => {
                        checkbox.checked = newState;
                        checkbox.checkbox.dispatchEvent(new Event("change"));
                    });
                };
                this.selectAllCheckbox.checkbox.addEventListener("click", (ev) => {
                    PartSelectionManager.setLastClickEvent(ev);
                });
                th.appendChild(this.selectAllCheckbox.dom);
                th.addEventListener("mouseenter", () => {
                    this.selectAllCheckbox.show();
                });
                th.addEventListener("mouseleave", () => {
                    if (!(this.selectAllCheckbox.checked || this.selectAllCheckbox.indeterminate)) {
                        this.selectAllCheckbox.hide();
                    }
                });
            } else {
                th.textContent = column.label;
            }
            headerRow.appendChild(th);
        }

        this.thead.appendChild(headerRow);
        this.table.appendChild(this.thead);
        this.table.appendChild(this.tbody);
    }

    async renderBatch(data: PartData[], startIndex: number): Promise<void> {
        const endIndex = Math.min(startIndex + this.BATCH_SIZE, data.length);
        const partRowLazy = new LazyLoad(
            [],
            (el) => {
                const row = rowByEl.get(el);
                if (row) row.render();
            },
            { rootMargin: "400px", threshold: 0 }
        );
        const rowByEl = new WeakMap<Element, PartRow>();

        for (let i = startIndex; i < endIndex; i++) {
            if (!(this.#user.canViewTag(data[i].current_flowtag) || data[i].is_completed)) continue;
            const part = data[i];
            const key = `${part.group_id}-${part.name}`;
            const partRow = new PartRow(part, this.columns);
            partRow.onCheckboxChanged = (row) => this.onRowCheckboxChanged(row);
            this.rowMap.set(key, partRow);
            this.tbody.appendChild(partRow.element);
            rowByEl.set(partRow.element, partRow);
            partRowLazy.observe(partRow.element);
        }

        if (endIndex < data.length) {
            if (this.BATCH_DELAY) {
                await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
            }
            await this.renderBatch(data, endIndex);
        }
    }

    private onRowCheckboxChanged(row: PartRow): void {
        const anyChecked = Array.from(this.rowMap.values()).some(r => r.checkbox.checked);
        const allChecked = Array.from(this.rowMap.values()).every(r => r.checkbox.checked);

        this.selectAllCheckbox.indeterminate = !allChecked && anyChecked;
        this.selectAllCheckbox.checked = allChecked;
    }

    async loadData(parts: PartData[]) {
        await this.renderBatch(parts, 0);
    }
}
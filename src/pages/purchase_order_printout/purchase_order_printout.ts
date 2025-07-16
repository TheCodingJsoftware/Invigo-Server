import "beercss"
import "@static/css/printout.css"
import "material-dynamic-colors";
import { loadAnimationStyleSheet, toggleTheme, loadTheme, invertImages } from "@utils/theme"
import { Effect } from "effect"
import { PurchaseOrder } from "@models/purchase-order";
import { POItemDict, PurchaseOrderData, PurchaseOrderStatus } from "@interfaces/purchase-order";
import { BaseComponent } from "@interfaces/base-component";
import { PURCHASE_ORDER_COLORS } from "@config/purchase-order-printout-config";
import { Component } from "@models/component";
import { Sheet } from "@models/sheet";
import { PurchaseOrderDetails } from "@components/purchase-order-details";
import { QRCodeComponent } from "@components/qr-code-component";
import { PurchaseOrderTotalCost } from "@components/purchase-order-total-cost";
import { createSwapy } from "swapy";


class ItemsTable implements BaseComponent {
    private readonly components: Component[] = [];
    private readonly componentsOrderItems: POItemDict[] = [];
    private readonly sheets: Sheet[] = [];
    private readonly sheetOrderItems: POItemDict[] = [];
    purchaseOrder: PurchaseOrder;
    element!: HTMLElement;

    constructor(purchaseOrder: PurchaseOrder) {
        this.purchaseOrder = purchaseOrder;
        this.components = purchaseOrder.components;
        this.componentsOrderItems = purchaseOrder.components_order_data;
        this.sheets = purchaseOrder.sheets;
        this.sheetOrderItems = purchaseOrder.sheets_order_data;
    }

    getSheetOrderQuantity(sheet: Sheet): number {
        for (const item of this.sheetOrderItems) {
            if (item.id === sheet.id) {
                return item.order_quantity;
            }
        }
        return 0;
    }

    getComponentOrderQuantity(component: Component): number {
        for (const item of this.componentsOrderItems) {
            if (item.id === component.id) {
                return item.order_quantity;
            }
        }
        return 0;
    }

    build(): HTMLElement {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border page-break-inside">
            <nav class="hide-on-print">
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">Items</h4>
                <button class="circle transparent" id="toggle-button">
                    <i class="rotate-180">expand_more</i>
                </button>
            </nav>
            <div class="content-wrapper" style="height: auto;">
                ${this.generateTable().outerHTML}
                <nav class="row no-space top-margin">
                    <div class="max">
                        <div class="small small-round field border label textarea no-margin" id="notes">
                            <textarea>${this.purchaseOrder.meta_data.notes}</textarea>
                            <label>Notes</label>
                        </div>
                        <nav class="no-space">
                            <button class="chip small-round tiny-margin" id="gst-number">
                                <span>GST Number: ${this.purchaseOrder.meta_data.business_info.gst_number}</span>
                            </button>
                            <button class="chip small-round tiny-margin" id="pst-number">
                                <span>PST Number: ${this.purchaseOrder.meta_data.business_info.pst_number}</span>
                            </button>
                        </nav>
                    </div>
                    <div id="total-cost-container">
                </nav>
            </div>
        </article>`.trim();
        const content = template.content.cloneNode(true) as DocumentFragment;
        this.element = content.firstElementChild as HTMLElement;
        this.element.id = `items-table-${this.purchaseOrder.id}`;
        return this.element;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#items-container') as HTMLDivElement;
        container.appendChild(this.build());
        return Promise.resolve();
    }

    generateTable(): HTMLElement {
        const subtotal = this.purchaseOrder.getSheetsCost() + this.purchaseOrder.getComponentsCost();

        const gstRate = this.purchaseOrder.meta_data.business_info.gst_rate ?? 0.05; // Default 5% GST
        const pstRate = this.purchaseOrder.meta_data.business_info.pst_rate ?? 0.07; // Default 7% PST

        const gstAmount = subtotal * gstRate;
        const pstAmount = subtotal * pstRate;

        const totalWithTaxes = subtotal + gstAmount + pstAmount;

        const template = document.createElement("template");
        template.innerHTML = `
        <table class="no-space border">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Part Number</th>
                    <th>Order Quantity</th>
                    <th data-column="unitPrice">Unit Price</th>
                    <th data-column="price">Price</th>
                </tr>
            </thead>
            <tbody>
                ${this.sheets.map(sheet => `
                <tr>
                    <td>${sheet.getPOItemName()}</td>
                    <td></td>
                    <td>${this.getSheetOrderQuantity(sheet)} (${this.formatNumber(this.getSheetOrderQuantity(sheet) * ((sheet.length * sheet.width) / 144) * sheet.pounds_per_square_foot)} lbs)</td>
                    <td data-column="unitPrice">${this.formatPrice(sheet.price_per_pound)}/lb CAD</td>
                    <td data-column="price">${this.formatPrice(sheet.price_per_pound * this.getSheetOrderQuantity(sheet) * ((sheet.length * sheet.width) / 144) * sheet.pounds_per_square_foot)} CAD</td>
                </tr>
                `).join("")}
                ${this.components.map(component => `
                <tr>
                    <td>${component.part_name}</td>
                    <td>${component.part_number}</td>
                    <td>${this.getComponentOrderQuantity(component)}</td>
                    <td data-column="unitPrice">${this.formatPrice(component.price)} ${component.use_exchange_rate ? "USD" : "CAD"}</td>
                    <td data-column="price">${this.formatPrice(component.price * this.getComponentOrderQuantity(component))} ${component.use_exchange_rate ? "USD" : "CAD"}</td>
                </tr>
                `).join("")}
            </tbody>
        </table>
        `.trim();
        const content = template.content.cloneNode(true) as DocumentFragment;
        return content.firstElementChild as HTMLElement;
    }

    formatNumber(value: number): string {
        return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    formatPrice(price: number): string {
        return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    formatPercent(value: number): string {
        return `${(value * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    }


    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

class PurchaseOrderPrintout {
    purchaseOrderId: number;
    private _dataEffect: Effect.Effect<any, Error> | null = null;
    public purchaseOrder!: PurchaseOrder;
    public container: HTMLDivElement;
    private swapy: ReturnType<typeof createSwapy> | null = null;
    private totalCostComponent!: PurchaseOrderTotalCost;

    constructor(purchaseOrderId: number) {
        this.purchaseOrderId = purchaseOrderId;
        this.container = document.getElementById('purchase-order-container') as HTMLDivElement;
    }

    private loadDataEffect(): Effect.Effect<PurchaseOrderData, Error> {
        return Effect.promise(async () => {
            const response = await fetch(`/purchase_orders/get_purchase_order/${this.purchaseOrderId}`);
            if (!response.ok) {
                const msg = await response.text();
                throw new Error(`Failed to fetch purchaseOrder data: ${msg}`);
            }
            return response.json();
        });
    }

    public getDataEffect(): Effect.Effect<any, Error> {
        if (!this._dataEffect) {
            this._dataEffect = this.loadDataEffect();
        }
        return this._dataEffect;
    }

    public initialize(): Effect.Effect<void, Error> {
        return this.getDataEffect().pipe(
            Effect.map(async (data) => {
                this.purchaseOrder = new PurchaseOrder();
                await this.purchaseOrder.loadAll(data);

                this.setUpSections();
                this.setUpTabs();
                this.setActiveTab();
                this.purchaseOrderTypeChanged();
                this.registerAllExpandableArticles();
                this.initSwapy();

                invertImages();

                document.title = this.purchaseOrder.getName();
                document.getElementById("purchase-order-title")!.textContent = this.purchaseOrder.getName();
                document.getElementById("business-name")!.textContent = this.purchaseOrder.meta_data.business_info.name;
                document.getElementById("business-address")!.innerHTML = this.purchaseOrder.meta_data.business_info.address.replace(/\n/g, "<br>");
                document.getElementById("purchase-order-number")!.textContent = this.purchaseOrder.meta_data.purchase_order_number.toString();
                document.getElementById("purchase-order-date")!.textContent = this.purchaseOrder.meta_data.order_date;

                this.toggleLoadingIndicator(false);
            }),
        );
    }

    private initSwapy(): void {
        this.swapy = createSwapy(this.container, {
            animation: 'spring',
            autoScrollOnDrag: true,
            swapMode: 'drop',
        });
        this.swapy.enable(true);
        this.swapy.onSwap((event) => {
            document.querySelectorAll("expandable-section").forEach(el => {
                (el as any).initialize();
            });
        });
    }

    updateSwapy(): void {
        if (!this.swapy) {
            return;
        }
        this.swapy.update();
    }

    async setUpSections(): Promise<void> {
        const sections: Record<string, BaseComponent> = {
            qrCode: new QRCodeComponent(window.location.href),
            purchaseOrderDetails: new PurchaseOrderDetails(this.purchaseOrderId, this.purchaseOrder),
            items: new ItemsTable(this.purchaseOrder),
        };
        sections['totalCost'] = this.totalCostComponent = new PurchaseOrderTotalCost(this.purchaseOrder);

        await Promise.all(
            Object.values(sections).map(section => section.render())
        );

        Object.entries(sections).forEach(([key, section]) => {
            const checkbox = document.getElementById(`show-${key}`) as HTMLInputElement;
            if (!checkbox) {
                return;
            }

            const saved = localStorage.getItem(`show-${key}`);
            if (saved !== null) {
                checkbox.checked = saved === "true";
            }

            checkbox.checked ? section.show() : section.hide();

            checkbox.addEventListener("change", () => {
                localStorage.setItem(`show-${key}`, String(checkbox.checked));
                checkbox.checked ? section.show() : section.hide();
            });
        });

        const gstNumberCheckbox = document.getElementById('show-GST') as HTMLInputElement;
        const gstNumberElement = document.getElementById('gst-number') as HTMLElement;
        const gstRow = document.getElementById('gst-row') as HTMLElement;
        if (gstNumberCheckbox) {
            const saved = localStorage.getItem('show-GST');
            gstNumberCheckbox.checked = saved !== "false";
            gstNumberCheckbox.addEventListener("change", () => {
                localStorage.setItem('show-GST', String(gstNumberCheckbox.checked));
                this.totalCostComponent.updateTotalPrice();
                if (gstNumberElement) {
                    gstNumberElement.classList.toggle('hidden', !gstNumberCheckbox.checked);
                }
                if (gstRow) {
                    gstRow.classList.toggle('hidden', !gstNumberCheckbox.checked);
                }
            });
        }
        gstNumberElement.classList.toggle('hidden', !gstNumberCheckbox.checked);
        gstRow.classList.toggle('hidden', !gstNumberCheckbox.checked);

        const pstNumberCheckbox = document.getElementById('show-PST') as HTMLInputElement;
        const pstNumberElement = document.getElementById('pst-number') as HTMLElement;
        const pstRow = document.getElementById('pst-row') as HTMLElement;
        if (pstNumberCheckbox) {
            const saved = localStorage.getItem('show-PST');
            pstNumberCheckbox.checked = saved !== "false";
            pstNumberCheckbox.addEventListener("change", () => {
                localStorage.setItem('show-PST', String(pstNumberCheckbox.checked));
                this.totalCostComponent.updateTotalPrice();
                if (pstNumberElement) {
                    pstNumberElement.classList.toggle('hidden', !pstNumberCheckbox.checked);
                }
                if (pstRow) {
                    pstRow.classList.toggle('hidden', !pstNumberCheckbox.checked);
                }
            });
        }
        pstNumberElement.classList.toggle('hidden', !pstNumberCheckbox.checked);
        pstRow.classList.toggle('hidden', !pstNumberCheckbox.checked);

        const showNotesCheckbox = document.getElementById('show-notes') as HTMLInputElement;
        const notesElement = document.getElementById('notes') as HTMLElement;
        if (showNotesCheckbox) {
            const saved = localStorage.getItem('show-notes');
            showNotesCheckbox.checked = saved !== "false";
            showNotesCheckbox.addEventListener("change", () => {
                localStorage.setItem('show-notes', String(showNotesCheckbox.checked));
                notesElement.classList.toggle('hidden', !showNotesCheckbox.checked);
            });
        }
        notesElement.classList.toggle('hidden', !showNotesCheckbox.checked);
    }

    registerAllExpandableArticles() {
        const articles = document.querySelectorAll("article");

        articles.forEach(article => {
            const button = article.querySelector('button#toggle-button') as HTMLButtonElement | null;
            const wrapper = article.querySelector('.content-wrapper') as HTMLElement | null;
            const icon = button?.querySelector('i');

            if (!button || !wrapper || !icon) {
                console.warn("ExpandableSection: Missing required elements");
                return;
            }

            // Load initial state
            const storageKey = `show-${article.id}`;
            const stored = localStorage.getItem(storageKey);
            const shouldExpand = stored === null || stored === "true";

            if (shouldExpand) {
                wrapper.classList.add("expanded");
                wrapper.style.maxHeight = "none";
                icon.classList.add("rotate-180");
                icon.classList.remove("rotate-0");
            } else {
                wrapper.classList.remove("expanded");
                wrapper.style.maxHeight = "0";
                icon.classList.remove("rotate-180");
                icon.classList.add("rotate-0");
            }

            button.addEventListener("click", (e) => {
                e.preventDefault();

                const isCollapsed = !wrapper.classList.contains("expanded");
                localStorage.setItem(storageKey, String(isCollapsed));

                if (isCollapsed) {
                    wrapper.classList.add("expanded");
                    wrapper.style.maxHeight = wrapper.scrollHeight + "px";

                    icon.classList.add("rotate-180");
                    icon.classList.remove("rotate-0");

                    wrapper.addEventListener("transitionend", () => {
                        wrapper.style.maxHeight = "none"; // reset to large value after animation
                    }, { once: true });
                } else {
                    wrapper.style.maxHeight = wrapper.scrollHeight + "px"; // set current height

                    // Force reflow
                    wrapper.offsetHeight;

                    wrapper.style.maxHeight = "0";
                    wrapper.classList.remove("expanded");

                    icon.classList.remove("rotate-180");
                    icon.classList.add("rotate-0");

                    wrapper.addEventListener("transitionend", () => {
                        // Collapse finished, ensure maxHeight stays at 0
                        wrapper.style.maxHeight = "0";
                    }, { once: true });
                }
            });
        });
    }

    toggleLoadingIndicator(show: boolean) {
        const loadingIndicator = document.getElementById("loading-indicator") as HTMLElement;
        if (!loadingIndicator) {
            console.warn("Loading indicator not found");
            return;
        }
        if (show) {
            loadingIndicator.classList.remove("hidden");
        } else {
            loadingIndicator.classList.add("hidden");
        }
    }

    private getPurchaseOrderType(): PurchaseOrderStatus {
        const tabs = document.getElementById('purchase-order-type-tabs') as HTMLElement;
        for (const button of Array.from(tabs.querySelectorAll('a'))) {
            if (button.classList.contains('active')) {
                return Number(button.dataset.target) as PurchaseOrderStatus;
            }
        }
        return PurchaseOrderStatus.PURCHASE_ORDER;
    }

    setActiveTab() {
        const tabs = document.getElementById('purchase-order-type-tabs') as HTMLElement;
        const tabButtons = Array.from(tabs.querySelectorAll('a'));
        const lastActiveTab = localStorage.getItem(`purchaseOrderType-${this.purchaseOrderId}`) || PurchaseOrderStatus.PURCHASE_ORDER.toString();
        tabButtons.forEach((button) => {
            if (button.dataset.target === lastActiveTab) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    private setUpTabs() {
        const tabs = document.getElementById('purchase-order-type-tabs') as HTMLElement;
        const tabButtons = Array.from(tabs.querySelectorAll('a'));
        tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                tabs.querySelectorAll('a').forEach((button) => {
                    button.classList.remove('active');
                });
                button.classList.add('active');
                localStorage.setItem(`purchaseOrderType-${this.purchaseOrderId}`, button.dataset.target || PurchaseOrderStatus.PURCHASE_ORDER.toString());
                this.purchaseOrderTypeChanged();
            });
        });
    }

    private purchaseOrderTypeChanged() {
        const purchaseOrderType = this.getPurchaseOrderType();
        ui("theme", PURCHASE_ORDER_COLORS[purchaseOrderType]);
        this.toggleTablePriceColumns();
        this.toggleCheckboxes();
    }

    toggleCheckboxes() {
        const checkboxes = [
            document.getElementById('show-GST') as HTMLInputElement,
            document.getElementById('show-PST') as HTMLInputElement,
            document.getElementById('show-totalCost') as HTMLInputElement,
        ];

        const shouldCheck = this.getPurchaseOrderType() === PurchaseOrderStatus.QUOTE;

        for (const checkbox of checkboxes) {
            if (checkbox) {
                checkbox.checked = shouldCheck;
                checkbox.dispatchEvent(new Event('change'));
            }
        }
    }


    toggleTablePriceColumns() {
        const tables = document.querySelectorAll("table");
        tables.forEach(table => {
            const headerCells = table.querySelectorAll('thead th') as NodeListOf<HTMLElement>;
            const tableCells = table.querySelectorAll('tbody td') as NodeListOf<HTMLElement>;
            const footerCells = table.querySelectorAll('tfoot th') as NodeListOf<HTMLElement>;

            headerCells.forEach(th => {
                if (th.dataset.column === "unitPrice" || th.dataset.column === "price") {
                    th.classList.toggle("hidden", this.getPurchaseOrderType() === PurchaseOrderStatus.PURCHASE_ORDER);
                }
            });
            tableCells.forEach(td => {
                if (td.dataset.column === "unitPrice" || td.dataset.column === "price") {
                    td.classList.toggle("hidden", this.getPurchaseOrderType() === PurchaseOrderStatus.PURCHASE_ORDER);
                }
            });
            footerCells.forEach(th => {
                if (th.dataset.column === "unitPrice" || th.dataset.column === "price") {
                    th.classList.toggle("hidden", this.getPurchaseOrderType() === PurchaseOrderStatus.PURCHASE_ORDER);
                }
            });
        });
    }
}

function getpurchaseOrderIdFromUrl(): number {
    const url = new URL(window.location.href);
    const purchaseOrderId = url.searchParams.get('id');
    if (!purchaseOrderId) {
        return -1;
    }
    return parseInt(purchaseOrderId, 10);
}

document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    loadAnimationStyleSheet();

    const purchaseOrderId = getpurchaseOrderIdFromUrl();
    const purchaseOrderPrintout = new PurchaseOrderPrintout(purchaseOrderId);

    Effect.runPromise(purchaseOrderPrintout.initialize()).catch((err) => {
        console.error("Failed to load purchase order data:", err);
        ui("#purchase-order-error", -1)
    }).finally(() => {
        ui("#purchase-order-loaded", 1000)
    });

    const toggleThemeButton = document.getElementById('theme-toggle') as HTMLButtonElement;
    const toggleThemeIcon = toggleThemeButton.querySelector('i') as HTMLElement;
    toggleThemeIcon.innerText = ui("mode") === "dark" ? "light_mode" : "dark_mode";

    toggleThemeButton.addEventListener('click', () => {
        toggleTheme();
        invertImages();
        toggleThemeIcon.innerText = ui("mode") === "dark" ? "light_mode" : "dark_mode";
    });
});

window.addEventListener('beforeprint', hidePageBreaks);
window.addEventListener('afterprint', restorePageBreaks);

function hidePageBreaks() {
    const pageBreakItems = document.querySelectorAll('.page-break-item') as NodeListOf<HTMLElement>;
    pageBreakItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox.checked) {
            item.classList.add('page-break');
        } else {
            item.classList.add('hidden');
        }
    });
}

function restorePageBreaks() {
    const showPageBreaksCheckbox = document.getElementById('show-pageBreaks') as HTMLInputElement;
    const pageBreakItems = document.querySelectorAll('.page-break-item') as NodeListOf<HTMLElement>;
    pageBreakItems.forEach(item => {
        if (showPageBreaksCheckbox.checked) {
            item.classList.remove('hidden');
        }
        item.classList.remove('page-break');
    });
}

window.onbeforeprint = function () {
    ui("mode", "light");
    invertImages();
};

window.onafterprint = function () {
    loadTheme();
    invertImages();
};
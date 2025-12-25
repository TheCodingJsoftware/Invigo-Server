import { MetaData, POItemDict, PurchaseOrderData } from "@interfaces/purchase-order";
import { Component } from "@models/component";
import { Sheet } from "@models/sheet";

async function fetchWithRetry<T>(
    url: string,
    {
        retries = 3,
        timeoutMs = 10_000,
    }: { retries?: number; timeoutMs?: number } = {}
): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            return await response.json();
        } catch (err) {
            if (attempt === retries) {
                throw err;
            }
        } finally {
            clearTimeout(timeout);
        }
    }

    // Unreachable, but TS needs it
    throw new Error("fetchWithRetry failed unexpectedly");
}

export class PurchaseOrder {
    id: number = -1;
    meta_data: MetaData;

    components: Component[] = [];
    sheets: Sheet[] = [];

    components_order_data: POItemDict[] = [];
    sheets_order_data: POItemDict[] = [];

    constructor() {
        this.meta_data = new MetaData();
    }

    async loadAll(data: any): Promise<void> {
        this.loadData(data);

        await Promise.all([
            this.loadComponents(),
            this.loadSheets(),
        ]);
    }

    loadData(data: any): void {
        const purchaseOrderData = data.purchase_order_data as PurchaseOrderData;

        this.id = purchaseOrderData.id ?? -1;
        this.meta_data.loadData(purchaseOrderData.meta_data);

        this.components_order_data = [...(purchaseOrderData.components ?? [])];
        this.sheets_order_data = [...(purchaseOrderData.sheets ?? [])];
    }

    async loadComponents(): Promise<void> {
        try {
            this.components = await Promise.all(
                this.components_order_data.map(async item => {
                    const url = `/components_inventory/get_component/${item.id}`;
                    const data = await fetchWithRetry<any>(url);
                    return new Component(data);
                })
            );
        } catch (error) {
            console.error("Failed to load components:", error);
            throw error;
        }
    }

    async loadSheets(): Promise<void> {
        try {
            this.sheets = await Promise.all(
                this.sheets_order_data.map(async item => {
                    const url = `/sheets_inventory/get_sheet/${item.id}`;
                    const data = await fetchWithRetry<any>(url);
                    return new Sheet(data);
                })
            );
        } catch (error) {
            console.error("Failed to load sheets:", error);
            throw error;
        }
    }

    getComponentsCost(): number {
        return this.components.reduce((total, component) => {
            const qty = this.getComponentQuantityToOrder(component);
            return total + component.price * qty;
        }, 0);
    }

    getSheetsCost(): number {
        return this.sheets.reduce((total, sheet) => {
            const qty = this.getSheetQuantityToOrder(sheet);
            const areaFt2 = (sheet.length * sheet.width) / 144;
            return (
                total +
                sheet.price_per_pound *
                qty *
                areaFt2 *
                sheet.pounds_per_square_foot
            );
        }, 0);
    }

    getName(): string {
        return `${this.meta_data.vendor.name} PO ${this.meta_data.purchase_order_number}`;
    }

    getPurchaseOrderType(): string {
        let type = "";
        if (this.meta_data.status === 0) {
            type = "PO";
        } else if (this.meta_data.status === 1) {
            type = "Quote";
        } else if (this.meta_data.status === 2) {
            type = "RO";
        }
        return type;
    }

    setComponentOrderQuantity(component: Component, quantity: number): void {
        const item = this.components_order_data.find(i => i.id === component.id);
        if (item) {
            item.order_quantity = quantity;
        } else {
            this.components_order_data.push({
                id: component.id,
                order_quantity: quantity,
            });
        }
    }

    setSheetOrderQuantity(sheet: Sheet, quantity: number): void {
        const item = this.sheets_order_data.find(i => i.id === sheet.id);
        if (item) {
            item.order_quantity = quantity;
        } else {
            this.sheets_order_data.push({
                id: sheet.id,
                order_quantity: quantity,
            });
        }
    }

    getComponentQuantityToOrder(component: Component): number {
        return (
            this.components_order_data.find(i => i.id === component.id)
                ?.order_quantity ?? 0
        );
    }

    getSheetQuantityToOrder(sheet: Sheet): number {
        return (
            this.sheets_order_data.find(i => i.id === sheet.id)
                ?.order_quantity ?? 0
        );
    }

    toDict(): PurchaseOrderData {
        return {
            id: this.id,
            meta_data: this.meta_data.toDict(),
            components: this.components_order_data,
            sheets: this.sheets_order_data,
        };
    }
}

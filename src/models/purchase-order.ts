import { MetaData, POItemDict, PurchaseOrderData } from "@interfaces/purchase-order";
import { Component } from "@models/component";
import { Sheet } from "@models/sheet";
import { Effect } from "effect"

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

        const componentsPromise = this.loadComponents();
        const sheetsPromise = this.loadSheets();

        await Promise.all([componentsPromise, sheetsPromise]);
    }

    loadData(data: any): void {
        const purchaseOrderData = data.purchase_order_data as PurchaseOrderData;
        this.id = purchaseOrderData.id ?? -1;
        this.meta_data.loadData(purchaseOrderData.meta_data);

        this.components_order_data = [];
        for (const compData of purchaseOrderData.components ?? []) {
            this.components_order_data.push(compData);
        }

        this.sheets_order_data = [];
        for (const sheetData of purchaseOrderData.sheets ?? []) {
            this.sheets_order_data.push(sheetData);
        }
    }

    async loadComponents(): Promise<void> {
        const effects = this.components_order_data.map(item => {
            const url = `/components_inventory/get_component/${item.id}`;
            return Effect.tryPromise(() =>
                fetch(url).then(res => res.json()).then(data => new Component(data))
            ).pipe(
                Effect.retry({ times: 3 }),
                Effect.timeout("10 seconds")
            );
        });

        const all = Effect.all(effects);

        try {
            this.components = await Effect.runPromise(all);
        } catch (error) {
            console.error("Failed to load components:", error);
        }
    }

    async loadSheets(): Promise<void> {
        const effects = this.sheets_order_data.map(item => {
            const url = `/sheets_inventory/get_sheet/${item.id}`;
            return Effect.tryPromise(() =>
                fetch(url).then(res => res.json()).then(data => new Sheet(data))
            ).pipe(
                Effect.retry({ times: 3 }),
                Effect.timeout("10 seconds")
            );
        });

        const all = Effect.all(effects);

        try {
            this.sheets = await Effect.runPromise(all);
        } catch (error) {
            console.error("Failed to load sheets:", error);
        }
    }

    getComponentsCost(): number {
        return this.components.reduce((total, component) => {
            const order_quantity = this.getComponentQuantityToOrder(component);
            return total + (component.price * order_quantity);
        }, 0);
    }

    getSheetsCost(): number {
        return this.sheets.reduce((total, sheet) => {
            const order_quantity = this.getSheetQuantityToOrder(sheet);
            return total + (sheet.price_per_pound * order_quantity * ((sheet.length * sheet.width) / 144) * sheet.pounds_per_square_foot);
        }, 0);
    }

    getName(): string {
        return `${this.meta_data.vendor.name} PO ${this.meta_data.purchase_order_number}`;
    }

    setComponentOrderQuantity(component: Component, quantity: number): void {
        const item = this.components_order_data.find(i => i.id === component.id);
        if (item) {
            item.order_quantity = quantity;
        } else {
            this.components_order_data.push({ id: component.id, order_quantity: quantity });
        }
    }

    setSheetOrderQuantity(sheet: Sheet, quantity: number): void {
        const item = this.sheets_order_data.find(i => i.id === sheet.id);
        if (item) {
            item.order_quantity = quantity;
        } else {
            this.sheets_order_data.push({ id: sheet.id, order_quantity: quantity });
        }
    }

    getComponentQuantityToOrder(component: Component): number {
        return this.components_order_data.find(i => i.id === component.id)?.order_quantity ?? 0;
    }

    getSheetQuantityToOrder(sheet: Sheet): number {
        return this.sheets_order_data.find(i => i.id === sheet.id)?.order_quantity ?? 0;
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

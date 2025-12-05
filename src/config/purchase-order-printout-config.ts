import { PurchaseOrderStatus } from "@interfaces/purchase-order";

export const PURCHASE_ORDER_COLORS: Record<PurchaseOrderStatus, string> = {
    [PurchaseOrderStatus.QUOTE]: "#78dc77",
    [PurchaseOrderStatus.PURCHASE_ORDER]: "#d3bbff",
    [PurchaseOrderStatus.RELEASE_ORDER]: "#44d8f1",
};

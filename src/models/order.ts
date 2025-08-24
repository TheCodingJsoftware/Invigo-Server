import {OrderData} from "@interfaces/order";

export class Order {
    expected_arrival_time!: string;
    order_pending_quantity!: number;
    order_pending_date!: string;
    notes!: string;

    constructor(data: OrderData) {
        Object.assign(this, data);
    }

    isPending(): boolean {
        return this.order_pending_quantity > 0;
    }

    getExpectedArrivalDate(): Date {
        return new Date(this.expected_arrival_time);
    }

    getOrderPendingDate(): Date {
        return new Date(this.order_pending_date);
    }

    isOverdue(currentDate: Date = new Date()): boolean {
        return this.isPending() && this.getExpectedArrivalDate() < currentDate;
    }

    toJSON(): OrderData {
        return {...this};
    }
}
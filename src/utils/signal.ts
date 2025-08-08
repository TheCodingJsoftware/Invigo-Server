export class Signal<T = void> {
    private listeners: ((payload: T) => void)[] = [];

    connect(listener: (payload: T) => void): void {
        this.listeners.push(listener);
    }

    disconnect(listener: (payload: T) => void): void {
        this.listeners = this.listeners.filter(fn => fn !== listener);
    }

    emit(payload: T): void {
        for (const fn of this.listeners) {
            fn(payload);
        }
    }

    clear(): void {
        this.listeners = [];
    }
}

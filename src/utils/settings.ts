export class SettingsManager<T extends Record<string, any>> {
    constructor(private key: string, private defaults: T) { }

    get(): T {
        const raw = localStorage.getItem(this.key);
        if (!raw) {
            return structuredClone(this.defaults);
        }
        try {
            return { ...this.defaults, ...JSON.parse(raw) };
        } catch {
            return structuredClone(this.defaults);
        }
    }

    set(patch: Partial<T>) {
        const current = this.get();
        const next = { ...current, ...patch };
        localStorage.setItem(this.key, JSON.stringify(next));
    }

    reset() {
        localStorage.setItem(this.key, JSON.stringify(this.defaults));
    }
}



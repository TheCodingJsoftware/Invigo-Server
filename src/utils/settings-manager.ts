/* settings.ts — vanilla-only IndexedDB settings manager */
type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
type Listener<T> = (newState: T, prevState: T) => void;

const idbSupported = (() => {
    try {
        return typeof indexedDB === "object" && indexedDB !== null;
    } catch {
        return false;
    }
})();

function openDb(name: string, version: number, onUpgrade?: (db: IDBDatabase) => void) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name, version);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        if (onUpgrade) {
            req.onupgradeneeded = () => onUpgrade(req.result);
        }
    });
}

export class SettingsManager<T extends Record<string, JsonValue>> {
    private readonly dbName: string;
    private store = "settings";
    private key = "root";
    private db: IDBDatabase | null = null;
    private memory = new Map<string, T>();
    private listeners = new Set<Listener<T>>();

    constructor(
        namespace: string,
        private defaults: Readonly<T>
    ) {
        this.dbName = `settings_${namespace}`;
        if (idbSupported) {
            this.init().catch(() => { });
        }
    }

    /* ---------- Public API ---------- */

    async get(): Promise<T>;
    async get<K extends keyof T>(key: K): Promise<T[K]>;
    async get(key?: keyof T) {
        const state = await this.load();
        return key === undefined ? state : state[key];
    }

    async set(patch: DeepPartial<T>): Promise<void>;
    async set<K extends keyof T>(key: K, value: T[K]): Promise<void>;
    async set(arg0: any, arg1?: any) {
        const patch = arg1 !== undefined ? { [arg0 as keyof T]: arg1 } : arg0;
        const prev = await this.load();
        const next = this.merge(prev, patch);
        await this.persist(next);
        this.notify(prev, next);
    }

    async reset(): Promise<void> {
        const prev = await this.load();
        await this.persist(this.defaults);
        this.notify(prev, this.defaults);
    }

    onChange(cb: Listener<T>): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    /* ---------- Internals ---------- */

    private async init() {
        try {
            this.db = await openDb(this.dbName, 1, (db) => {
                if (!db.objectStoreNames.contains(this.store)) {
                    db.createObjectStore(this.store);
                }
            });
        } catch {
            console.warn("[SettingsManager] IndexedDB unavailable; using memory");
        }
    }

    private async load(): Promise<T> {
        if (!this.db) {
            return this.memory.get(this.key) ?? { ...this.defaults };
        }
        return new Promise<T>((resolve, reject) => {
            const tx = this.db!.transaction(this.store, "readonly");
            const req = tx.objectStore(this.store).get(this.key);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve({ ...this.defaults, ...(req.result ?? {}) });
        });
    }

    private async persist(state: T) {
        if (!this.db) {
            this.memory.set(this.key, state);
            return;
        }
        return new Promise<void>((resolve, reject) => {
            const tx = this.db!.transaction(this.store, "readwrite");
            tx.objectStore(this.store).put(state, this.key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    private merge<B extends Record<PropertyKey, unknown>>(
        base: B,
        patch: DeepPartial<B>
    ): B {
        const result = { ...base };

        // `key` now *is* a key of patch (and therefore of B)
        for (const [key, patchVal] of Object.entries(patch) as Array<
            [keyof B, DeepPartial<B>[keyof B]]
        >) {
            const baseVal = result[key];

            // Deep-merge only when both sides are plain objects
            if (
                patchVal &&
                typeof patchVal === "object" &&
                !Array.isArray(patchVal) &&
                baseVal &&
                typeof baseVal === "object" &&
                !Array.isArray(baseVal)
            ) {
                result[key] = this.merge(
                    baseVal as Record<PropertyKey, unknown>,
                    patchVal as DeepPartial<Record<PropertyKey, unknown>>
                ) as B[typeof key];
            } else {
                // Otherwise overwrite
                result[key] = patchVal as B[typeof key];
            }
        }
        return result;
    }

    private notify(prev: T, next: T) {
        this.listeners.forEach((fn) => fn(next, prev));
    }
}

/* ------------------------------------------------------------------ */
/* Example usage (delete if you don't need it)                          */
/* ------------------------------------------------------------------ */
// if (typeof document !== "undefined") {
//     interface Config {
//         theme: "light" | "dark";
//         locale: string;
//         api: { endpoint: string; timeout: number };
//     }

//     const cfg = new SettingsManager<Config>("myApp", {
//         theme: "light",
//         locale: "en",
//         api: { endpoint: "https://api.example.com", timeout: 5000 },
//     });

//     // Quick demo
//     (async () => {
//         await cfg.set("theme", "dark");
//         await cfg.set({ api: { timeout: 10000 } });
//         console.log(await cfg.get()); // full object
//         console.log(await cfg.get("theme")); // just theme
//     })();
// }
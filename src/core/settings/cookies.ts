export type CookieOptions = {
    days?: number;
    path?: string;
    domain?: string;
    sameSite?: "Lax" | "Strict" | "None";
    secure?: boolean;
};

export class CookieSettingsManager<T extends Record<string, any>> {
    constructor(private key: string, private defaults: T, private options: CookieOptions = {}) {
    }

    private read(): string | null {
        const name = this.key + "=";
        const parts = document.cookie.split(";");
        for (let c of parts) {
            c = c.trim();
            if (c.startsWith(name)) {
                return decodeURIComponent(c.substring(name.length));
            }
        }
        return null;
    }

    private write(value: string) {
        const opts = this.options;
        let cookie = `${this.key}=${encodeURIComponent(value)}`;
        if (opts.days && Number.isFinite(opts.days)) {
            const d = new Date();
            d.setTime(d.getTime() + opts.days * 24 * 60 * 60 * 1000);
            cookie += `; Expires=${d.toUTCString()}`;
        }
        cookie += `; Path=${opts.path ?? "/"}`;
        if (opts.domain) cookie += `; Domain=${opts.domain}`;
        if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
        if (opts.secure) cookie += `; Secure`;
        document.cookie = cookie;
    }

    get(): T {
        const raw = this.read();
        if (!raw) {
            return structuredClone(this.defaults);
        }
        try {
            return {...this.defaults, ...JSON.parse(raw)};
        } catch {
            return structuredClone(this.defaults);
        }
    }

    set(patch: Partial<T>) {
        const current = this.get();
        const next = {...current, ...patch};
        this.write(JSON.stringify(next));
    }

    reset() {
        this.write(JSON.stringify(this.defaults));
    }
}

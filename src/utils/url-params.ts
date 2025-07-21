type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type UrlParamSetOptions = {
    /** If true, use history.pushState instead of replaceState */
    push?: boolean;
};

export class UrlParamHandler {
    private serializer = {
        encode: (v: JsonValue): string => encodeURIComponent(JSON.stringify(v)),
        decode: (raw: string | null): JsonValue | undefined => {
            if (raw == null) {
                return undefined;
            }
            try {
                return JSON.parse(decodeURIComponent(raw));
            } catch {
                return undefined;
            }
        },
    };

    /* ----------------------------------------------------------
     *  QUERY STRING
     * ---------------------------------------------------------- */

    /** Read a single query param */
    getQuery(key: string): JsonValue | undefined {
        const params = new URLSearchParams(location.search);
        return this.serializer.decode(params.get(key));
    }

    /** Read *all* query params as a plain object */
    getAllQuery(): Record<string, JsonValue> {
        const params = new URLSearchParams(location.search);
        const out: Record<string, JsonValue> = {};
        for (const [k, v] of params.entries()) {
            const decoded = this.serializer.decode(v);
            if (decoded !== undefined) {
                out[k] = decoded;
            }
        }
        return out;
    }

    /** Write one or many query params */
    setQuery(
        patch: Record<string, JsonValue | undefined>,
        opts: UrlParamSetOptions = {}
    ): void {
        const url = new URL(location.href);
        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) {
                url.searchParams.delete(k);
            } else {
                url.searchParams.set(k, this.serializer.encode(v));
            }
        }
        this._commit(url, opts);
    }

    /* ----------------------------------------------------------
     *  HASH
     * ---------------------------------------------------------- */

    /** Read the entire hash as a plain object */
    getHash(): Record<string, JsonValue> {
        const raw = location.hash.startsWith("#") ? location.hash.slice(1) : "";
        const params = new URLSearchParams(raw);
        const out: Record<string, JsonValue> = {};
        for (const [k, v] of params.entries()) {
            const decoded = this.serializer.decode(v);
            if (decoded !== undefined) {
                out[k] = decoded;
            }
        }
        return out;
    }

    /** Write one or many hash params */
    setHash(
        patch: Record<string, JsonValue | undefined>,
        opts: UrlParamSetOptions = {}
    ): void {
        const params = new URLSearchParams(location.hash.slice(1));
        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) {
                params.delete(k);
            } else {
                params.set(k, this.serializer.encode(v));
            }
        }
        const url = new URL(location.href);
        url.hash = params.toString();
        this._commit(url, opts);
    }

    /* ----------------------------------------------------------
     *  DATA ATTRIBUTES
     * ---------------------------------------------------------- */

    /** Read a data attribute from any element (defaults to <html>) */
    getData(
        key: string,
        el: HTMLElement = document.documentElement
    ): JsonValue | undefined {
        const raw = el.dataset[key];
        return this.serializer.decode(raw ?? null);
    }

    /** Write a data attribute on any element (defaults to <html>) */
    setData(
        key: string,
        value: JsonValue | undefined,
        el: HTMLElement = document.documentElement
    ): void {
        if (value === undefined) {
            delete el.dataset[key];
        } else {
            el.dataset[key] = this.serializer.encode(value);
        }
    }

    /* ----------------------------------------------------------
     *  INTERNAL
     * ---------------------------------------------------------- */

    private _commit(url: URL, opts: UrlParamSetOptions) {
        if (opts.push) {
            history.pushState(null, "", url);
        } else {
            history.replaceState(null, "", url);
        }
    }
}

/* ------------------------------------------------------------------ */
/* Example usage (delete if you don’t need it)                          */
/* ------------------------------------------------------------------ */
if (typeof document !== "undefined") {
    const url = new UrlParamHandler();

    // query string
    url.setQuery({ page: 2, filter: ["red", "green"] });
    console.log(url.getQuery("page")); // 2
    console.log(url.getAllQuery());    // { page: 2, filter: [ 'red', 'green' ] }

    // hash
    url.setHash({ tab: "info", id: 42 });
    console.log(url.getHash());        // { tab: "info", id: 42 }

    // data attributes on <html>
    url.setData("theme", "dark");
    console.log(url.getData("theme")); // "dark"
}
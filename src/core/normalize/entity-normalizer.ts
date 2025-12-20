type FieldKind = "json" | "date" | "passthrough";

type NormalizationSchema<T> = {
    [K in keyof T]?: FieldKind;
};

function parseJSON(value: any) {
    if (value == null) return value;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
}

function parseDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

export function normalizeEntity<T extends Record<string, any>>(
    raw: T,
    schema: NormalizationSchema<T>
): T {
    const result: any = { ...raw };

    for (const key in schema) {
        const kind = schema[key];
        const value = raw[key];

        switch (kind) {
            case "json":
                result[key] = parseJSON(value);
                break;

            case "date":
                result[key] = parseDate(value);
                break;

            case "passthrough":
            default:
                result[key] = value;
        }
    }

    return result as T;
}

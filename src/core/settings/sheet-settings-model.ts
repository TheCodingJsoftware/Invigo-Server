interface SheetSettings {
    cost_for_laser: Record<string, number>; // e.g., { "Nitrogen": 150, "CO2": 100 }
    materials: string[];
    thicknesses: string[];
    pounds_per_square_foot: Record<string, Record<string, PoundsPerSquareFootEntry>>;
    price_per_pound: Record<string, PricePerPoundEntry>;
    cutting_methods: Record<string, CuttingMethod>;
    thickness_ids: Record<string, string>;
}

interface PoundsPerSquareFootEntry {
    pounds_per_square_foot: number;
    latest_change: string;
}

interface PricePerPoundEntry {
    price_per_pound: number;
    latest_change: string;
}

interface CuttingMethod {
    name: string; // material name (e.g., "304 SS")
    cut: string;  // cutting method (e.g., "Nitrogen" | "CO2")
}

export class SheetSettingsModel {
    private static data: SheetSettings | null = null;

    static async init(): Promise<void> {
        if (!this.data) {
            const response = await fetch("/file/sheet_settings.json");
            if (!response.ok) {
                throw new Error(`Failed to fetch sheet settings: ${response.status}`);
            }
            this.data = await response.json() as SheetSettings;
        }
    }

    private static ensureLoaded(): SheetSettings {
        if (!this.data) {
            throw new Error("SheetSettings not loaded. Call SheetSettingsModel.init() first.");
        }
        return this.data;
    }

    static get settings(): SheetSettings {
        return this.ensureLoaded();
    }

    static get materials(): string[] {
        return this.ensureLoaded().materials;
    }

    static get thicknesses(): string[] {
        return this.ensureLoaded().thicknesses;
    }

    static getPricePerPound(material: string): PricePerPoundEntry | null {
        return this.ensureLoaded().price_per_pound[material] ?? null;
    }

    static getPoundsPerSquareFoot(material: string, thickness: string): PoundsPerSquareFootEntry | null {
        return this.ensureLoaded().pounds_per_square_foot[material]?.[thickness] ?? null;
    }

    static getCuttingMethod(code: string): CuttingMethod | null {
        return this.ensureLoaded().cutting_methods[code] ?? null;
    }

    static getThicknessById(id: string): string | null {
        return this.ensureLoaded().thickness_ids[id] ?? null;
    }
}

import { ComponentData } from "@interfaces/component";

export interface ComponentGroupData {
    name: string;
    base_part: ComponentData;
    components: ComponentData[];
}

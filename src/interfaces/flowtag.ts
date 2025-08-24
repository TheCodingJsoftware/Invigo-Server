export interface FlowtagData {
    name: string;
    group: number; // 0 = ASSEMBLY, 1 = LASER_CUT_PART, 2 = COMPONENT
    add_quantity_tag: string | null;
    remove_quantity_tag: string | null;
    tags: string[];
}
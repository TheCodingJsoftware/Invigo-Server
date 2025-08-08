export interface FlowTagStatus {
    completed: boolean;
    start_timer: boolean;
    next_flow_tag_message: string;
}

export interface FlowTagAttribute {
    expected_time_to_complete: number;
    next_flow_tag_message: string;
}

export interface TagDefinition {
    attribute: FlowTagAttribute;
    statuses: Record<string, FlowTagStatus>;
}

export interface FlowTagItem {
    name: string;
    group: number;
    add_quantity_tag: string | null;
    remove_quantity_tag: string | null;
    tags: string[];
}

export interface FlowTags {
    [groupName: string]: FlowTagItem[];
}

export interface FlowTagConfigData {
    notes: string;
    tags: Record<string, TagDefinition>;
    flow_tags: FlowTags;
}

export class WorkspaceSettings {
    private static data: FlowTagConfigData | null = null;

    static async load(): Promise<void> {
        if (!this.data) {
            const response = await fetch("/file/workspace_settings.json");
            this.data = await response.json();
        }
    }

    static get notes(): string {
        if (!this.data) throw new Error("WorkspaceSettings not loaded");
        return this.data.notes;
    }

    static get tags(): Record<string, TagDefinition> {
        if (!this.data) throw new Error("WorkspaceSettings not loaded");
        return this.data.tags;
    }

    static get flow_tags(): FlowTags {
        if (!this.data) throw new Error("WorkspaceSettings not loaded");
        return this.data.flow_tags;
    }
}

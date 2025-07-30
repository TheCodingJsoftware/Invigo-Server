import {JobMetaData} from "@interfaces/job";
import {LaserCutPartData} from "@interfaces/laser-cut-part";

interface PartData {
    id: number;
    job_id: number;
    assembly_group_id: number;
    name: string;
    quantity: number;
    flowtag: string[];
    flowtag_index: number;
    setup_time: string;
    setup_time_seconds: number;
    process_time: string;
    process_time_seconds: number;
    automated_time: string;
    automated_time_seconds: number;
    start_time: string;
    end_time: string;
    meta_data: LaserCutPartData["meta_data"];
    prices: LaserCutPartData["prices"];
    paint_data: LaserCutPartData["paint_data"];
    primer_data: LaserCutPartData["primer_data"];
    powder_data: LaserCutPartData["powder_data"];
    workspace_data: LaserCutPartData["workspace_data"];
    modified_at: string;
    created_at: string;
}

interface WorkspaceJobData {
    id: number;
    name: string;
    job_data: JobMetaData;
    created_at: string;
    modified_at: string;
}

type Listener<T extends WorkspaceMessage> = (data: T) => void;

type WorkspaceMessage =
    | { type: "job_created"; job: WorkspaceJobData }
    | { type: "job_updated"; job: WorkspaceJobData }
    | { type: "job_deleted"; job_id: number }
    | { type: "assembly_created"; job_id: number; data: any }
    | { type: "assembly_updated"; job_id: number; data: any }
    | { type: "assembly_deleted"; job_id: number; data: any }
    | { type: "part_created"; part: PartData }
    | { type: "part_updated"; part_id: number; delta: Partial<PartData> }
    | { type: "part_deleted"; part_id: number; };

export class WorkspaceWebSocket {
    private static socket: WebSocket;
    private static listeners: Partial<{ [K in WorkspaceMessage["type"]]: Listener<any>[] }> = {};
    static reconnectHandlers: (() => void)[] = [];

    static connect() {
        this.socket = new WebSocket(`ws://${location.host}/ws/workspace`);
        this.socket.onmessage = (event) => {
            const message: WorkspaceMessage = JSON.parse(event.data);
            this.listeners[message.type]?.forEach((cb) => cb(message));
        };

        this.socket.onclose = () => {
            setTimeout(() => {
                this.connect();
                this.reconnectHandlers.forEach((fn) => fn());
            }, 1000);
        };
    }

    static onReconnect(handler: () => void) {
        this.reconnectHandlers.push(handler);
    }

    static on<T extends WorkspaceMessage["type"]>(type: T, handler: Listener<Extract<WorkspaceMessage, { type: T }>>) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type]!.push(handler);
    }
}

import { JobMetaData } from "@interfaces/job";
import { LaserCutPartData } from "@interfaces/laser-cut-part";

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

export interface GroupedPartsChangeData {
    operation: "insert" | "update" | "delete";
    job_id?: number;
    part_name: string;
    flowtag: string[];
    flowtag_index: number;
}

type Listener<T extends WorkspaceMessage> = (data: T) => void;

type WorkspaceMessage =
    | { type: "pong" }
    | { type: "job_created"; job: WorkspaceJobData }
    | { type: "job_updated"; job: WorkspaceJobData }
    | { type: "job_deleted"; job_id: number }
    | { type: "assembly_created"; job_id: number; data: any }
    | { type: "assembly_updated"; job_id: number; data: any }
    | { type: "assembly_deleted"; job_id: number; data: any }
    | { type: "part_created"; part: PartData }
    | { type: "part_updated"; part_id: number; delta: Partial<PartData> }
    | { type: "part_deleted"; part_id: number; }
    | ({ type: "grouped_parts_job_view_changed" } & GroupedPartsChangeData)
    | ({ type: "grouped_parts_global_view_changed" } & GroupedPartsChangeData);

export class WorkspaceWebSocket {
    private static socket: WebSocket;
    private static listeners: Partial<{ [K in WorkspaceMessage["type"]]: Listener<any>[] }> = {};
    static reconnectHandlers: (() => void)[] = [];
    private static buffer: Partial<Record<WorkspaceMessage["type"], any[]>> = {};
    private static timers: Partial<Record<WorkspaceMessage["type"], number>> = {};
    private static heartbeatTimer: number | null = null;


    static connect() {
        this.socket = new WebSocket(`ws://${location.host}/ws/workspace`);

        this.socket.onopen = () => {
            // Start sending heartbeats every 25s
            this.heartbeatTimer = window.setInterval(() => {
                if (this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ type: "ping" }));
                }
            }, 25000);
        };

        this.socket.onmessage = (event) => {
            const message: WorkspaceMessage = JSON.parse(event.data);

            if (message.type === "pong") {
                // optional: handle server pong
                return;
            }

            if (
                message.type === "grouped_parts_job_view_changed" ||
                message.type === "grouped_parts_global_view_changed"
            ) {
                this.enqueue(message); // debounce bursts
            } else {
                this.listeners[message.type]?.forEach((cb) => cb(message));
            }
        };

        this.socket.onclose = () => {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
            setTimeout(() => {
                this.connect();
                this.reconnectHandlers.forEach((fn) => fn());
            }, 1000);
        };
    }

    static onReconnect(handler: () => void) {
        this.reconnectHandlers.push(handler);
    }

    private static enqueue<T extends WorkspaceMessage>(msg: T, delay = 300) {
        const type = msg.type;
        if (!this.buffer[type]) this.buffer[type] = [];
        this.buffer[type]!.push(msg);

        if (!this.timers[type]) {
            this.timers[type] = window.setTimeout(() => {
                const batch = this.buffer[type] ?? [];
                delete this.buffer[type];
                delete this.timers[type];

                // Fire one synthetic batched event
                this.listeners[type]?.forEach((cb) =>
                    cb({ type: `${type}_batched`, events: batch } as any)
                );
            }, delay);
        }
    }

    static on<T extends WorkspaceMessage["type"]>(type: T, handler: Listener<Extract<WorkspaceMessage, { type: T }>>) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type]!.push(handler);
    }
}

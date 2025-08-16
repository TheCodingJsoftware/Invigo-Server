import { PartData } from "@components/workspace/parts/part-page";
import { PartViewConfig } from "@config/part-view-mode";
import { ViewSettingsManager } from "@core/settings/view-settings";
import { SnackbarComponent } from "@components/common/snackbar/snackbar-component";
import { WorkspaceFilter } from "@models/workspace-filter";
import { UserContext } from "@core/auth/user-context";
import { WorkspaceSettings } from "@core/settings/workspace-settings";

export enum PartDataType {
    WORKSPACE = "workspace_data",
    INVENTORY = "inventory_data",
    META = "meta_data",
    PRICES = "prices",
    PAINT = "paint_data",
    PRIMER = "primer_data",
    POWDER = "powder_data",
    FLOWTAG_INDEX = "flowtag_index",
    FLOWTAG_STATUS_INDEX = "flowtag_status_index"
}

interface PartDataParams {
    jobId?: number;
    groupId: number;
    name: string;
    flowtag: string[];
    flowtagIndex: number;
    flowtagStatusIndex: number;
    dataType: PartDataType;
}

interface UpdatePartDataParams extends PartDataParams {
    newValue: any;
}

interface RecutPartDataParams extends PartDataParams {
    recutQuantity: number;
    recutReason: string;
}

export class PartDataService {
    private static buildFetchUrl(params: PartDataParams): string {
        const url = new URL('/api/workspace/laser_cut_part', window.location.origin);
        url.searchParams.append('view', PartViewConfig[ViewSettingsManager.get().lastActivePartView].dbView);

        if (params.jobId) url.searchParams.append('job_id', params.jobId.toString());

        url.searchParams.append('name', params.name);
        url.searchParams.append('flowtag', params.flowtag.join(','));
        url.searchParams.append('flowtag_index', params.flowtagIndex.toString())
        url.searchParams.append('flowtag_status_index', params.flowtagStatusIndex.toString())
        url.searchParams.append('data_type', params.dataType);

        return url.toString();
    }

    private static buildUpdateUrl(): string {
        return new URL('/api/workspace/laser_cut_part', window.location.origin).toString();
    }

    private static buildRequestRecutUrl(): string {
        return new URL('/api/workspace/request_recut', window.location.origin).toString();
    }

    private static buildRecutFinishedUrl(): string {
        return new URL('/api/workspace/recut_finished', window.location.origin).toString();
    }

    private static buildGetPartsUrl(): string {
        const settings = WorkspaceFilter.getManager().get();
        const user = Object.freeze(UserContext.getInstance().user);

        const currentView = ViewSettingsManager.get().lastActivePartView;
        const dbView = PartViewConfig[currentView].dbView;
        const url = new URL(`/api/workspace/view/parts/${dbView}`, window.location.origin);

        url.searchParams.append("show_completed", String(Number(settings.showCompleted)));

        const filterTags = Object
            .entries(settings)
            .filter(([key, value]) => key.startsWith("show_tag:") && value)
            .map(([key]) => key.slice("show_tag:".length));

        if (filterTags.length > 0) {
            url.searchParams.append("tags", filterTags.join(","));
        } else {
            const tagNames = Object.keys(WorkspaceSettings.tags);
            const viewableTags = tagNames.filter(tag => user.canViewTag(tag));
            if (viewableTags.length > 0) {
                url.searchParams.append("tags", viewableTags.join(","));
            }
        }

        return url.toString();
    }

    static async getParts(): Promise<PartData[]> {
        const response = await fetch(this.buildGetPartsUrl(), {
            method: 'GET',
        })

        if (!response.ok) {
            new SnackbarComponent({
                type: "error",
                message: `getParts - error: ${response.status}: ${response.statusText}`,
                position: "bottom",
                duration: 1000,
            })
        }
        return await response.json();
    }

    static async updatePartData(params: UpdatePartDataParams): Promise<any> {
        const response = await fetch(this.buildUpdateUrl(), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Name': UserContext.getInstance().user.name
            },
            body: JSON.stringify({
                view: PartViewConfig[ViewSettingsManager.get().lastActivePartView].dbView,
                job_id: params.jobId,
                group_id: params.groupId,
                name: params.name,
                flowtag: params.flowtag,
                flowtag_index: params.flowtagIndex,
                flowtag_status_index: params.flowtagStatusIndex,
                data_type: params.dataType,
                new_value: params.newValue,
            })
        });

        if (!response.ok) {
            new SnackbarComponent({
                type: "error",
                message: "Failed to update part data",
                position: "bottom",
                duration: 1000,
            })
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    static async requestRecut(params: Omit<RecutPartDataParams, "dataType">): Promise<any> {
        const response = await fetch(this.buildRequestRecutUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Name': UserContext.getInstance().user.name
            },
            body: JSON.stringify({
                view: PartViewConfig[ViewSettingsManager.get().lastActivePartView].dbView,
                job_id: params.jobId,
                group_id: params.groupId,
                name: params.name,
                flowtag: params.flowtag,
                flowtag_index: params.flowtagIndex,
                flowtag_status_index: params.flowtagStatusIndex,
                recut_quantity: params.recutQuantity,
                recut_reason: params.recutReason,
            })
        });

        if (!response.ok) {
            new SnackbarComponent({
                type: "error",
                message: "Failed to request recut",
                position: "bottom",
                duration: 1000,
            })
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    static async recutFinished(params: Omit<PartDataParams, "dataType">): Promise<any> {
        const response = await fetch(this.buildRecutFinishedUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Name': UserContext.getInstance().user.name
            },
            body: JSON.stringify({
                view: PartViewConfig[ViewSettingsManager.get().lastActivePartView].dbView,
                job_id: params.jobId,
                group_id: params.groupId,
                name: params.name,
                flowtag: params.flowtag,
                flowtag_index: params.flowtagIndex,
                flowtag_status_index: params.flowtagStatusIndex,
            })
        });

        if (!response.ok) {
            new SnackbarComponent({
                type: "error",
                message: "Failed to request recut",
                position: "bottom",
                duration: 1000,
            })
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    static async updateFlowtagIndex(params: Omit<UpdatePartDataParams, "dataType">): Promise<any> {
        return await this.updatePartData({
            ...params,
            dataType: PartDataType.FLOWTAG_INDEX
        });
    }

    static async updateFlowtagStatusIndex(params: Omit<UpdatePartDataParams, "dataType">): Promise<any> {
        return await this.updatePartData({
            ...params,
            dataType: PartDataType.FLOWTAG_STATUS_INDEX
        });
    }

    static async fetchPartData<T>(params: PartDataParams): Promise<T> {
        const response = await fetch(this.buildFetchUrl(params));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        return result.data;
    }

    static async getWorkspaceData(params: Omit<PartDataParams, 'dataType'>) {
        const data = await this.fetchPartData<string>({
            ...params,
            dataType: PartDataType.WORKSPACE
        });

        return JSON.parse(data) as PartData['workspace_data'];
    }
}
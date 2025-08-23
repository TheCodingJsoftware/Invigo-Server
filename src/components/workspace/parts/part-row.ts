import { UserContext } from "@core/auth/user-context";
import { WorkspaceRowCheckbox } from "@components/common/checkboxes/workspace-row-checkbox";
import { PartSelectionManager } from "@components/workspace/parts/part-selection-manager";
import { Loading } from "@components/common/loading/loading";
import { PartDataService } from "@components/workspace/parts/part-data.service";
import { PartData } from "@components/workspace/parts/part-page";
import { DialogComponent } from "@components/common/dialog/dialog-component";
import { invertImages } from "@utils/theme";
import { WorkspacePermissions } from "@core/auth/workspace-permissions";
import { WorkspaceSettings } from "@core/settings/workspace-settings";
import { FlowtagStatusMenuButton } from "@components/common/buttons/flowtag-status-menu-button";
import { IncrementFlowtagButton } from "@components/common/buttons/increment-flowtag-button";
import { RecutButton } from "@components/common/buttons/recut-button";
import { RecutDialog } from "@components/common/dialog/recut-dialog";
import { SnackbarComponent } from "@components/common/snackbar/snackbar-component";
import { PartColumn } from "@components/workspace/parts/parts-table";
import { FileButton } from "@components/common/buttons/file-button";
import { RecutFinishedButton } from "@components/common/buttons/recut-finished-button";
import {TimerButton} from "@components/common/buttons/timer-button";

export class PartRow {
    readonly element: HTMLTableRowElement;
    readonly checkbox = new WorkspaceRowCheckbox();
    readonly data: PartData;
    readonly #user = Object.freeze(UserContext.getInstance().user);
    onCheckboxChanged?: (row: PartRow) => void;

    constructor(data: PartData, private readonly columns: PartColumn[]) {
        this.data = data;
        this.element = document.createElement("tr");

        this.checkbox.onchange = () => this.onCheckboxChange();
        this.checkbox.checkbox.addEventListener("click", (ev) => {
            PartSelectionManager.setLastClickEvent(ev);
        });

        this.element.addEventListener("mouseenter", () => {
            this.element.classList.add("hovering");
            this.checkbox.show();
        });

        this.element.addEventListener("mouseleave", () => {
            if (!this.checkbox.checked) {
                this.element.classList.remove("hovering");
                this.checkbox.hide();
            }
        });

        if (data.is_completed) {
            this.element.classList.add("finished");
        }

        for (const column of this.columns) {
            const td = document.createElement("td");

            if (column.key === 'checkbox') {
                td.classList.add("min");
                td.appendChild(this.checkbox.dom);
            } else if (column.key === 'thumbnail') {
                const img = document.createElement("img");
                img.classList.add("part-table-thumbnail", "small-round", "border");
                img.loading = "lazy";
                img.src = <string>column.render(data);
                img.alt = data.name;
                img.onclick = () => {
                    new DialogComponent({
                        title: data.name,
                        bodyContent: `<img class="responsive small-round" src="${img.src}" alt="${img.alt}" />`,
                    })
                    invertImages();
                }
                td.classList.add("min");
                td.appendChild(img);
            } else if (column.key === 'icon') {
                const icon = document.createElement("i");
                icon.innerHTML = <string>column.render(data);
                icon.classList.add("green-font");
                td.classList.add("min");
                td.appendChild(icon);
            } else if (column.key === 'actions') {
                td.appendChild(PartRow.createActions(data));

            } else if (column.key === 'files') {
                td.appendChild(PartRow.createFiles(data));
            } else if (column.key === "current_flowtag") {
                var content = column.render(data);
                if (data.recut) {
                    content = "Recutting";
                } else if (data.recoat) {
                    content = "Recoating";
                }
                if (typeof content === 'string') {
                    td.textContent = content;
                }
            } else {
                const content = column.render(data);
                if (typeof content === 'string') {
                    td.textContent = content;
                } else {
                    td.appendChild(content);
                }
            }
            this.element.appendChild(td);
        }
    }

    private onCheckboxChange(): void {
        if (this.checkbox.checked) {
            this.element.classList.add("selected");
            PartSelectionManager.add(this);
        } else {
            this.element.classList.remove("selected");
            PartSelectionManager.remove(this);
        }

        if (this.onCheckboxChanged) {
            this.onCheckboxChanged(this);
        }
    }

    static createFiles(data: PartData): HTMLElement {
        const user = Object.freeze(UserContext.getInstance().user);
        const container = document.createElement("div");
        container.classList.add("row");

        user.require(WorkspacePermissions.ViewBendingFiles, () => {
            data.workspace_data.bending_files.forEach((file) => {
                const fileButton = new FileButton(data, file)
                container.appendChild(fileButton.element);
            });
        });

        user.require(WorkspacePermissions.ViewWeldingFiles, () => {
            data.workspace_data.welding_files.forEach((file) => {
                const fileButton = new FileButton(data, file)
                container.appendChild(fileButton.element);
            });
        })


        user.require(WorkspacePermissions.ViewCNCMillingFiles, () => {
            data.workspace_data.cnc_milling_files.forEach((file) => {
                const fileButton = new FileButton(data, file)
                container.appendChild(fileButton.element);
            });
        })

        return container;
    }

    static createActions(data: PartData): HTMLElement {
        const user = Object.freeze(UserContext.getInstance().user);
        const container = document.createElement("div");
        container.classList.add("row");

        if (user.can(WorkspacePermissions.CanToggleTimer)){
            const timerButton = new TimerButton(data);
            if (data.is_timing) {
                timerButton.toggle()
            }
            timerButton.onclick((data) => {
                if (data.is_timing) {
                    PartRow.stopTiming(data);
                } else {
                    PartRow.startTiming(data);
                }
            });
            container.appendChild(timerButton.getElement());
        }

        if (!data.is_completed && !data.recut && user.canApplyTag(data.current_flowtag) && user.can(WorkspacePermissions.AdvanceFlow)) {
            if (Object.keys(WorkspaceSettings.tags[data.current_flowtag].statuses).length > 1) {
                const flowtagStatusButton = new FlowtagStatusMenuButton(data)
                flowtagStatusButton.selectionchange((data) => PartRow.flowtagStatusChanged(flowtagStatusButton, data))
                container.appendChild(flowtagStatusButton.getElement());
            } else {
                const incrementFlowtagButton = new IncrementFlowtagButton(data);
                incrementFlowtagButton.onclick((data) => PartRow.incrementFlowtagIndex(data));
                container.appendChild(incrementFlowtagButton.getElement());
            }
        }

        if (data.flowtag_index > 0 && user.can(WorkspacePermissions.CanRequestRecut)) {
            const recutButton = new RecutButton(data);
            recutButton.onclick((data) => PartRow.markAsRecut(data));
            container.appendChild(recutButton.getElement());
        }

        if (data.recut && user.can(WorkspacePermissions.CanFinishRecut)) {
            const recutButton = new RecutFinishedButton(data);
            recutButton.onclick((data) => PartRow.markAsRecutFinished(data));
            container.appendChild(recutButton.getElement());
        }

        return container;
    }

    static async startTiming(data: PartData): Promise<void> {
        try {
            Loading.show();
            PartDataService.startTiming({
                groupId: data.group_id,
                jobId: data.job_id,
                name: data.name,
                flowtag: data.flowtag,
                flowtagIndex: data.flowtag_index,
                flowtagStatusIndex: data.flowtag_status_index,
                startTime: data.start_time,
                endTime: data.end_time,
                newValue: true,
            });
            new SnackbarComponent({
                message: "Started timing",
                icon: "timer",
                type: "green",
                position: "bottom",
                duration: 1000,
            });
        } catch (error) {
            console.error('Failed to start timing:', error);
            new DialogComponent({title: "Error", bodyContent: "Failed to start timing.", width: "small-width"})
        }
    }

    static async stopTiming(data: PartData): Promise<void> {
        try {
            Loading.show();
            PartDataService.stopTiming({
                groupId: data.group_id,
                jobId: data.job_id,
                name: data.name,
                flowtag: data.flowtag,
                flowtagIndex: data.flowtag_index,
                flowtagStatusIndex: data.flowtag_status_index,
                startTime: data.start_time,
                endTime: data.end_time,
                newValue: false,
            });
            new SnackbarComponent({
                message: "Stopped timing",
                icon: "timer",
                type: "green",
                position: "bottom",
                duration: 1000,
            });
        } catch (error) {
            console.error('Failed to stop timing:', error);
            new DialogComponent({title: "Error", bodyContent: "Failed to stop timing.", width: "small-width"})
        }
    }

    static async markAsRecut(data: PartData): Promise<void> {
        const recutDialog = new RecutDialog([data]);
    }

    static async markAsRecutFinished(data: PartData): Promise<void> {
        try {
            Loading.show();
            PartDataService.recutFinished({
                jobId: data.job_id,
                groupId: data.group_id,
                name: data.name,
                flowtag: data.flowtag,
                flowtagIndex: data.flowtag_index,
                flowtagStatusIndex: data.flowtag_status_index,
                startTime: data.start_time,
                endTime: data.end_time,
            })
            new SnackbarComponent({
                message: "Successfully marked as recut finished.",
                icon: "check",
                type: "green",
                position: "bottom",
                duration: 1000,
            });
        } catch (error) {
            console.error('Failed to mark as recut finished:', error);
            new DialogComponent({title: "Error", bodyContent: "Failed to mark as recut finished.", width: "small-width"});
        }
    }

    static async flowtagStatusChanged(flowtagStatusButton: FlowtagStatusMenuButton, data: PartData): Promise<void> {
        try {
            Loading.show();
            const statuses = WorkspaceSettings.tags[data.current_flowtag].statuses;
            const newStatusIndex = flowtagStatusButton.getSelectedIndex();
            const newStatusKey = flowtagStatusButton.getSelectedStatusKey();
            if (WorkspaceSettings.tags[data.current_flowtag].statuses[newStatusKey].completed) {
                await PartRow.incrementFlowtagIndex(data);
            } else {
                await PartDataService.updateFlowtagStatusIndex({
                    groupId: data.group_id,
                    jobId: data.job_id,
                    name: data.name,
                    flowtag: data.flowtag,
                    flowtagIndex: data.flowtag_index,
                    flowtagStatusIndex: data.flowtag_status_index,
                    startTime: data.start_time,
                    endTime: data.end_time,
                    newValue: flowtagStatusButton.getSelectedIndex(),
                });
                new SnackbarComponent({
                    message: "Synced",
                    icon: "sync",
                    type: "green",
                    position: "bottom",
                    duration: 1000,
                });
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            new DialogComponent({
                title: "Error",
                bodyContent: "Failed to update status.",
                width: "small-width"
            });
        }
    }

    static async incrementFlowtagIndex(data: PartData): Promise<void> {
        try {
            Loading.show();
            await PartDataService.updateFlowtagIndex({
                groupId: data.group_id,
                jobId: data.job_id,
                name: data.name,
                flowtag: data.flowtag,
                flowtagIndex: data.flowtag_index,
                flowtagStatusIndex: data.flowtag_status_index,
                startTime: data.start_time,
                endTime: data.end_time,
                newValue: data.flowtag_index + 1,
            });
            new SnackbarComponent({
                message: "Moved to next process",
                type: "green",
                position: "bottom",
                duration: 1000,
            });
        } catch (error) {
            console.error('Failed to increment process:', error);
            new DialogComponent({
                title: "Error",
                bodyContent: "Failed to increment process",
                width: "small-width"
            });
        }
    }

    static async showWorkspaceData(data: PartData): Promise<void> {
        try {
            const workspaceData = await PartDataService.getWorkspaceData({
                groupId: data.group_id,
                jobId: data.job_id,
                name: data.name,
                flowtag: data.flowtag,
                flowtagIndex: data.flowtag_index,
                flowtagStatusIndex: data.flowtag_status_index,
                startTime: data.start_time,
                endTime: data.end_time,
            });

            new DialogComponent({
                title: `Workspace Data - ${data.name}`,
                bodyContent: `<pre>${JSON.stringify(workspaceData, null, 4)}</pre>`,
                width: "medium-width"
            });
        } catch (error) {
            console.error('Failed to fetch workspace data:', error);
            new DialogComponent({
                title: "Error",
                bodyContent: "Failed to load workspace data",
                width: "small-width"
            });
        }
    }
} 11
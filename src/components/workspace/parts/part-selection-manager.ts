import { RecutDialog } from "@components/common/dialog/recut-dialog";
import { FileViewerDialog } from "@components/common/dialog/file-viewer-dialog";
import { PartRow } from "@components/workspace/parts/part-row";
import { UserContext } from "@core/auth/user-context";
import { WorkspacePermissions } from "@core/auth/workspace-permissions";
import { fetchJobData } from "./job-element";
import { applyScopedBeerTheme } from "@config/material-theme-cookie";

export class PartSelectionManager {
    private static element: HTMLElement;
    private static selectedRows: Set<PartRow> = new Set();
    private static onChangeHandlers: ((rows: PartRow[]) => void)[] = [];
    private static lastClick: MouseEvent | null = null;
    private static dragOffsetX = 0;
    private static dragOffsetY = 0;
    private static isDragging = false;
    private static signalsBlocked = false;

    static buildFloatingMenuContent(selected: PartRow[]): HTMLElement {
        const user = Object.freeze(UserContext.getInstance().user);

        const container = document.createElement("div");
        container.classList.add("menu-card");

        const handle = document.createElement("i");
        handle.addEventListener("mousedown", this.startDrag);
        handle.classList.add("handle");
        handle.innerHTML = "drag_indicator";

        const label = document.createElement("span");
        label.textContent = `${selected.length} selected`;

        const verticalStack = document.createElement("nav");
        verticalStack.classList.add("vertical");

        const completeButton = document.createElement("button");
        completeButton.disabled = selected.some(row => row.data.is_completed);
        completeButton.classList.add("transparent", "responsive", "left-align");
        completeButton.id = "mark-complete";
        completeButton.onclick = () => this.markSelectionComplete();
        completeButton.innerHTML = `
            <i>check</i>
            <span>Mark Complete</span>
        `.trim();

        if (!user.can(WorkspacePermissions.AdvanceFlow)) {
            completeButton.classList.add("hidden");
        }

        const startTimingButton = document.createElement("button");
        startTimingButton.disabled = selected.some(row => row.data.is_timing);
        startTimingButton.classList.add("transparent", "responsive", "left-align");
        startTimingButton.id = "start-timing";
        startTimingButton.onclick = () => this.startTiming();
        startTimingButton.innerHTML = `
            <i>play_arrow</i>
            <span>Start Timing</span>
        `.trim();

        const stopTimingButton = document.createElement("button");
        stopTimingButton.disabled = selected.some(row => !row.data.is_timing);
        stopTimingButton.classList.add("transparent", "responsive", "left-align");
        stopTimingButton.id = "stop-timing";
        stopTimingButton.onclick = () => this.stopTiming();
        stopTimingButton.innerHTML = `
            <i>stop</i>
            <span>Stop Timing</span>
        `.trim();

        if (!user.can(WorkspacePermissions.CanToggleTimer)) {
            startTimingButton.classList.add("hidden");
            stopTimingButton.classList.add("hidden");
        }

        const viewFilesButton = document.createElement("button");
        viewFilesButton.classList.add("transparent", "responsive", "left-align");
        viewFilesButton.id = "view-files";
        viewFilesButton.onclick = () => this.viewSelectedFiles();
        viewFilesButton.innerHTML = `
            <i>preview</i>
            <span>View Files</span>
        `.trim();

        const recutButton = document.createElement("button");
        recutButton.classList.add("transparent", "responsive", "left-align");
        recutButton.id = "recut-button";
        recutButton.onclick = () => this.recutParts();
        recutButton.innerHTML = `
            <i>undo</i>
            <span>Recut</span>
        `.trim();

        if (!user.can(WorkspacePermissions.CanRequestRecut)) {
            recutButton.classList.add("hidden");
        }

        const clearButton = document.createElement("button");
        clearButton.classList.add("transparent", "responsive", "left-align");
        clearButton.id = "clear-selection";
        clearButton.onclick = () => this.clearSelection();
        clearButton.innerHTML = `
            <i>close</i>
            <span>Clear selection</span>
        `.trim();

        container.appendChild(handle);
        container.appendChild(label);
        verticalStack.appendChild(completeButton);
        verticalStack.appendChild(startTimingButton);
        verticalStack.appendChild(stopTimingButton);
        verticalStack.appendChild(viewFilesButton);
        verticalStack.appendChild(recutButton);
        verticalStack.appendChild(clearButton);
        container.appendChild(verticalStack);

        return container;
    }

    static markSelectionComplete() {
        for (const row of this.getSelected()) {
            if (!row.data.is_completed) {
                PartRow.incrementFlowtagIndex(row.data);
            }
            this.remove(row);
        }
        this.clearSelection();
    }

    static startTiming() {
        for (const row of this.getSelected()) {
            if (!row.data.is_timing) {
                PartRow.startTiming(row.data);
            }
        }
        this.clearSelection();
    }

    static stopTiming() {
        for (const row of this.getSelected()) {
            if (row.data.is_timing) {
                PartRow.stopTiming(row.data);
            }
        }
        this.clearSelection();
    }

    static recutParts() {
        const selectedParts = this.getSelected().map(partRow => partRow.data);
        const recutPartsDialog = new RecutDialog(selectedParts);
        this.applyJobThemeAsync(selectedParts[0].job_id, recutPartsDialog.element);
    }

    static applyJobThemeAsync(jobId: number, dialog: HTMLElement) {
        fetchJobData(jobId)
            .then(data => {
                applyScopedBeerTheme(
                    dialog,
                    data.job_data.color,
                    `recut-dialog-${jobId}`
                );
            })
            .catch(() => {
                /* no-op: dialog stays default themed */
            });
    }

    static viewSelectedFiles() {
        const selectedParts = this.getSelected().map(partRow => partRow.data);
        const viewFilesDialog = new FileViewerDialog("Viewer", selectedParts)
        this.applyJobThemeAsync(selectedParts[0].job_id, viewFilesDialog.element);
    }

    static clearSelection() {
        this.blockSignals(true);
        for (const row of this.getSelected()) {
            row.checkbox.checked = false;
            row.checkbox.checkbox.dispatchEvent(new Event("change"));
        }
        this.blockSignals(false);
        this.update([]);
    }

    static update(rows: PartRow[]) {
        this.selectedRows = new Set(rows);

        if (!this.element) {
            this.element = document.createElement("article");
            this.element.classList.add("floating-part-menu", "absolute", "blur", "round", "fade-hidden");
            document.body.appendChild(this.element);
        }

        if (this.signalsBlocked) return;

        if (rows.length === 0) {
            this.hide();
            return;
        } else {
            this.show();
        }

        const pos = this.getLastClickPosition();

        const baseY = window.scrollY;
        const baseX = window.scrollX;

        let targetX: number, targetY: number;

        if (pos) {
            targetX = pos.x + baseX + 25;
            targetY = pos.y + baseY - 80;
        } else {
            const last = rows[rows.length - 1];
            const rect = last.checkbox.dom.getBoundingClientRect();
            targetX = rect.left + baseX + 50;
            targetY = rect.bottom + baseY + 8;
        }

        this.element.style.transform = `translate(${targetX}px, ${targetY}px)`;

        this.element.replaceChildren(
            this.buildFloatingMenuContent(rows)
        );
    }

    static blockSignals(state: boolean) {
        this.signalsBlocked = state;
    }

    static show() {
        this.element.classList.remove("fade-hidden");
    }

    static hide() {
        this.element.classList.add("fade-hidden");
    }

    static setLastClickEvent(event: MouseEvent) {
        this.lastClick = event;
    }

    static getLastClickPosition(): { x: number; y: number } | null {
        return this.lastClick ? { x: this.lastClick.clientX, y: this.lastClick.clientY } : null;
    }

    static add(row: PartRow) {
        this.selectedRows.add(row);
        this.notify();
    }

    static remove(row: PartRow) {
        this.selectedRows.delete(row);
        this.notify();
    }

    static clear() {
        this.selectedRows.clear();
        this.notify();
    }

    static getSelected(): PartRow[] {
        return Array.from(this.selectedRows);
    }

    static onChange(handler: (rows: PartRow[]) => void) {
        this.onChangeHandlers.push(handler);
    }

    private static startDrag = (e: MouseEvent) => {
        if (!this.element) return;

        this.isDragging = true;
        this.element.classList.add("dragging");

        const rect = this.element.getBoundingClientRect();
        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;

        document.addEventListener("mousemove", this.onDrag);
        document.addEventListener("mouseup", this.stopDrag);
    };

    private static onDrag = (e: MouseEvent) => {
        if (!this.isDragging || !this.element) return;

        const x = e.pageX - this.dragOffsetX;
        const y = e.pageY - this.dragOffsetY;

        this.element.style.top = "unset";
        this.element.style.left = "unset";
        this.element.style.transform = `translate(${x}px, ${y}px)`;
    };

    private static stopDrag = () => {
        this.isDragging = false;
        this.element.classList.remove("dragging");

        document.removeEventListener("mousemove", this.onDrag);
        document.removeEventListener("mouseup", this.stopDrag);
    };

    private static notify() {
        if (this.signalsBlocked) return;
        for (const h of this.onChangeHandlers) {
            h(this.getSelected());
        }
    }
}
import {DialogComponent} from "@components/common/dialog/dialog-component";
import {PartData} from "@components/workspace/parts/part-container";
import {PartDataService} from "@components/workspace/parts/part-data.service";
import {SnackbarComponent} from "../snackbar/snackbar-component";

export class RecutDialog extends DialogComponent {
    parts: PartData[];
    recutQuantity: number = 0;
    recutReason: string = "";

    constructor(parts: PartData[]) {
        super({
            id: "recut-dialog",
            title: `Recutting ${parts.length} part(s)`,
            position: "bottom",
            bodyContent: `
                <div class="grid center-align">
                    <div class="s12 field label border round">
                        <input type="number" id="recut-count" value="0">
                        <label>Recut Count</label>
                    </div>
                    <div class="s12 field textarea label border small-round extra">
                        <textarea id="recut-reason"></textarea>
                        <label>Description</label>
                        <span class="helper">Give a detailed description as to why this needs to be recut.</span>
                    </div>
                </div>
            `,
            footerContent: `
                <nav class="row top-margin right-align">
                    <span class="italic max">Recutting a part sends it back to ${parts[0].flowtag[0]}.</span>
                    <button type="button" id="send-recut" disabled>
                        <i>send</i>
                        <span>Request Recut</span>
                    </button>
                </nav>`
        });
        this.parts = parts;
        this.init();
    }

    init() {
        const sendRecutButton = this.element.querySelector("#send-recut") as HTMLButtonElement;
        sendRecutButton.addEventListener("click", async () => {
            for (const part of this.parts) {
                await PartDataService.requestRecut({
                    jobId: part.job_id,
                    groupId: part.group_id,
                    name: part.name,
                    flowtag: part.flowtag,
                    flowtagIndex: part.flowtag_index,
                    flowtagStatusIndex: part.flowtag_status_index,
                    startTime: part.start_time,
                    endTime: part.end_time,
                    recutQuantity: this.recutQuantity,
                    recutReason: this.recutReason
                })
            }
            this.close();
            new SnackbarComponent({
                message: `Successfully requested recut for ${this.parts.length} part(s).`,
                type: "green",
                duration: 1000,
                icon: "check"
            })
        })

        const recutCount = this.element.querySelector("#recut-count") as HTMLTextAreaElement;
        recutCount.addEventListener("change", () => {
            const recutQuantity = Number(recutCount.value);
            this.recutQuantity = recutQuantity
            sendRecutButton.disabled = recutQuantity <= 0;
        })

        const description = this.element.querySelector("#recut-reason") as HTMLTextAreaElement;
        description.addEventListener("change", () => {
            this.recutReason = description.value;
        })
    }
}

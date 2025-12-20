import { PartData } from "@components/workspace/parts/part-container";
import { invertImages } from "@utils/theme";
import { WorkspacePartDialog } from "@components/common/dialog/workspace-part-dialog";
import { fetchJobData } from "@components/workspace/parts/job-element";
import { applyScopedBeerTheme } from "@config/material-theme-cookie";


export class PartButton {
    readonly part: PartData;

    readonly button: HTMLButtonElement;
    private readonly image: HTMLImageElement;
    private readonly span: HTMLSpanElement;
    private readonly helper: HTMLSpanElement;

    constructor(part: PartData) {
        this.part = part;

        this.button = document.createElement("button");
        this.button.className = "part-button extra border small-round blur left-align"
        this.button.addEventListener("click", () => this.buttonPressed());

        this.image = document.createElement("img");
        this.image.className = "responsive";
        this.image.loading = "lazy";
        this.image.width = 48
        this.image.height = 48
        this.image.src = `/images/${this.part.name}`
        this.image.alt = "Thumbnail";

        if (ui("mode") === "light") {
            this.image.style.filter = 'invert(0)';
        } else {
            this.image.style.filter = 'invert(0.9)';
        }

        this.span = document.createElement("span");
        this.span.textContent = this.part.name;

        this.helper = document.createElement("span");
        this.helper.className = "row small-text";
        this.helper.textContent = `${this.part.meta_data.gauge} ${this.part.meta_data.material}`;

        this.button.appendChild(this.image);
        this.button.appendChild(this.span);
        this.span.appendChild(this.helper);
    }

    buttonPressed() {
        const dialog = new WorkspacePartDialog(this.part);
        invertImages(dialog.element);
        applyScopedBeerTheme(
            dialog.element,
            this.part.job_data.job_data.color,
            `workspace-part-${this.part.job_id}`
        );
        applyScopedBeerTheme(
            dialog.element,
            this.part.job_data.job_data.color,
            `workspace-part-dialog-job-${this.part.job_id}`
        );
        dialog.show();
    }
}
import {PartData} from "@components/workspace/parts/part-container";
import {invertImages} from "@utils/theme";
import {DialogComponent} from "@components/common/dialog/dialog-component";


export class PartButton {
    readonly element: HTMLButtonElement;
    readonly part: PartData;

    private readonly image: HTMLImageElement;
    private readonly span: HTMLSpanElement;
    private readonly tooltip: HTMLDivElement;

    constructor(part: PartData) {
        this.part = part;

        this.element = document.createElement("button");
        this.element.className = "part-button extra border small-round blur"
        this.element.addEventListener("click", () => this.buttonPressed());

        this.tooltip = document.createElement("div");
        this.tooltip.className = "tooltip bottom";
        this.tooltip.innerHTML = `
            ${this.part.meta_data.gauge} ${this.part.meta_data.material}
        `.trim();

        this.image = document.createElement("img");
        this.image.className = "responsive";
        this.image.loading = "lazy";
        this.image.width = 48
        this.image.height = 48
        this.image.src = `/images/${this.part.name}`
        this.image.alt = "Thumbnail";

        this.span = document.createElement("span");
        this.span.textContent = this.part.name;

        this.element.appendChild(this.image);
        this.element.appendChild(this.span);
        this.element.appendChild(this.tooltip);
    }

    buttonPressed() {
        // const fileViewerDialog = new FileViewerDialog([this.part], this.filePath);

        new DialogComponent({
            title: this.part.name,
            bodyContent: `<img class="responsive small-round" src="${this.image.src}" alt="${this.image.alt}" />`,
        })
        invertImages();
    }
}
import { DialogComponent } from "@components/common/dialog/dialog-component";
import { PartData } from "@components/workspace/parts/part-container";
import { PartElement } from "@components/workspace/parts/part-element";
import { invertImages } from "@utils/theme";

export class WorkspacePartDialog extends DialogComponent {
    readonly part: PartData;
    private keyHandler?: (e: KeyboardEvent) => void;

    constructor(part: PartData) {
        super({
            id: `workspace-part-dialog-${part.name}`,
            title: part.name,
            position: "bottom",
            bodyContent: `<div id="part-container"></div>`
        });

        this.part = part;
    }

    show(): Promise<boolean> {
        const partContainer = this.element.querySelector<HTMLDivElement>("#part-container")!;
        partContainer.replaceChildren(new PartElement(this.part).element);

        invertImages(this.element); // scope this if your util supports it

        return new Promise<boolean>(resolve => {
            this.keyHandler = (e: KeyboardEvent) => {
                if (e.key === "Escape" || e.key === "Enter") {
                    this.cleanup();
                    this.close();
                    resolve(true);
                }
            };

            this.element.addEventListener("keydown", this.keyHandler);
        });
    }

    private cleanup() {
        if (this.keyHandler) {
            this.element.removeEventListener("keydown", this.keyHandler);
            this.keyHandler = undefined;
        }
    }
}

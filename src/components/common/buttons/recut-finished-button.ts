import {PartData} from "@components/workspace/parts/part-container";

export class RecutFinishedButton {
    private readonly data: PartData;
    private readonly element: HTMLButtonElement;

    constructor(data: PartData) {
        this.data = data;
        this.element = document.createElement("button");
        this.init();
    }

    init() {
        this.element.className = "chip border round blur";
        this.element.innerHTML = `
            <i>redo</i>
            <span>Recut Complete</span>
        `.trim();
    }

    onclick(handler: (data: PartData, ev: MouseEvent) => void): this {
        this.element.addEventListener("click", (ev) => handler(this.data, ev));
        return this;
    }

    getElement(): HTMLButtonElement {
        return this.element;
    }
}

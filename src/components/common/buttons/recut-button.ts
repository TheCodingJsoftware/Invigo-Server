import {PartData} from "@components/workspace/parts/part-page";

export class RecutButton {
    private readonly data: PartData;
    private readonly element: HTMLButtonElement;

    constructor(data: PartData) {
        this.data = data;
        this.element = document.createElement("button");
        this.init();
    }

    init() {
        this.element.classList.add("chip", "border", "round");
        this.element.innerHTML = `
            <i>undo</i>
            <span>Needs Recut</span>
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

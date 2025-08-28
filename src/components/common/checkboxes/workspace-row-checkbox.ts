export class WorkspaceRowCheckbox {
    readonly element: HTMLLabelElement;
    private readonly input: HTMLInputElement;

    constructor(initialState = false, text = "") {
        this.element = document.createElement("label");
        this.element.classList.add("table-checkbox", "checkbox", "large");

        this.input = document.createElement("input");
        this.input.id = `checkbox-${Math.random().toString(36).substring(2, 15)}`;
        this.input.type = "checkbox";
        this.input.checked = initialState;

        const label = document.createElement("label");
        label.classList.add("hidden");
        label.textContent = "checkbox"
        label.htmlFor = this.input.id;

        const span = document.createElement("span");
        span.innerText = text;

        this.element.appendChild(this.input);
        this.element.appendChild(span);
        this.element.appendChild(label);
    }

    get checked(): boolean {
        return this.input.checked;
    }

    set checked(value: boolean) {
        this.input.checked = value;

        if (this.input.checked || this.input.indeterminate) {
            this.show();
        } else {
            this.hide();
        }
    }

    get indeterminate(): boolean {
        return this.input.indeterminate;
    }

    set indeterminate(value: boolean) {
        this.input.indeterminate = value;

        if (this.input.checked || this.input.indeterminate) {
            this.show();
        } else {
            this.hide();
        }
    }

    show() {
        this.element.classList.add("show-checkbox");
    }

    hide() {
        this.element.classList.remove("show-checkbox");
    }

    set onchange(handler: (ev: Event) => any) {
        this.input.onchange = handler;
    }

    get dom(): HTMLElement {
        return this.element;
    }

    get checkbox(): HTMLInputElement {
        return this.input;
    }
}
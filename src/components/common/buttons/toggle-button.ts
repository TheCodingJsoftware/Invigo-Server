export class ToggleButton {
    private readonly button: HTMLButtonElement;
    private readonly row: HTMLElement;
    private readonly icon: HTMLElement;
    private readonly label: HTMLSpanElement;
    private checked: boolean;

    onChange?: (state: boolean) => void;

    constructor(labelText: string, value: string, checked = false) {
        this.checked = checked;

        this.button = document.createElement("button");
        this.button.type = "button";
        this.button.className = "left-align border small-round tiny-margin";
        this.button.dataset.value = value;
        this.button.setAttribute("role", "button");
        this.button.setAttribute("aria-pressed", String(checked));

        // ---- ROW (icon + text stay horizontal forever) ----
        this.row = document.createElement("nav");
        this.row.className = "tiny-space left-align";

        this.icon = document.createElement("i");
        this.label = document.createElement("span");
        this.label.textContent = labelText;

        this.row.append(this.icon, this.label);
        this.button.append(this.row);

        this.updateUI();
        this.button.addEventListener("click", () => this.toggle());
    }

    get element(): HTMLButtonElement {
        return this.button;
    }

    get value(): string {
        return this.button.dataset.value ?? "";
    }

    isChecked(): boolean {
        return this.checked;
    }

    setChecked(state: boolean): void {
        if (this.checked !== state) {
            this.checked = state;
            this.updateUI();
            this.onChange?.(state);
        }
    }

    toggle(): void {
        this.setChecked(!this.checked);
    }

    private updateUI(): void {
        this.button.classList.toggle("fill", this.checked);
        this.icon.textContent = this.checked ? "check_box" : "check_box_outline_blank";
        this.button.setAttribute("aria-pressed", String(this.checked));
    }
}
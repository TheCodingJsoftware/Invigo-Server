import {PermissionMap} from "@core/auth/workspace-permissions";

export class PermissionToggleButton {
    private readonly button: HTMLElement;
    private readonly icon: HTMLElement;
    private checked: boolean;

    constructor(value: string, checked: boolean) {
        const entry = PermissionMap[value];
        this.checked = checked;

        this.button = document.createElement("button");
        this.button.className = "left-align chip round perm tiny-margin";
        this.button.dataset.value = value;
        this.button.setAttribute("role", "checkbox");
        this.button.setAttribute("aria-checked", String(checked));

        this.icon = document.createElement("i");
        this.icon.textContent = checked ? "check_circle" : "circle";

        const label = document.createElement("span");
        label.textContent = entry.label;

        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.textContent = entry.description;

        this.button.append(this.icon, label, tooltip);
        this.setChecked(checked);

        this.button.addEventListener("click", () => this.setChecked(!this.checked));
    }

    get element(): HTMLElement {
        return this.button;
    }

    get value(): string {
        return this.button.dataset.value!;
    }

    isChecked(): boolean {
        return this.checked;
    }

    setChecked(state: boolean): void {
        this.checked = state;
        this.button.classList.toggle("fill", state);
        this.icon.textContent = state ? "check_circle" : "circle";
        this.button.setAttribute("aria-checked", String(state));
    }
}
import { WorkspaceSort, BooleanSettingKey } from "@models/workspace-sort";
import { Signal } from "@utils/signal";

export class SortMenuButton {
    readonly button: HTMLButtonElement;
    readonly onToggle = new Signal<{ key: BooleanSettingKey; value: boolean }>();
    private readonly menu: HTMLMenuElement;

    constructor() {
        this.button = document.createElement("button");
        this.button.id = "sort-menu-button";
        this.button.className = "circle transparent"

        const icon = document.createElement("i");
        icon.textContent = "sort";

        this.menu = document.createElement("menu");
        this.menu.className = "no-wrap left";

        this.button.appendChild(icon);
        this.button.appendChild(this.menu);

        this.buildMenu();
    }

    private buildMenu() {
        const settings = WorkspaceSort.getManager().get();

        (Object.keys(settings) as BooleanSettingKey[]).forEach((key) => {
            const li = document.createElement("li");
            const active = (WorkspaceSort as any)[key];

            const checkIcon = document.createElement("i");
            checkIcon.textContent = "check";
            if (!active) checkIcon.style.visibility = "hidden";

            li.appendChild(checkIcon);
            li.append(" " + this.titleFromKey(key));
            li.classList.toggle("fill", active);

            li.addEventListener("click", () => {
                const next = !(WorkspaceSort as any)[key];
                (WorkspaceSort as any)[key] = next;
                li.classList.toggle("fill", next);
                checkIcon.style.visibility = next ? "visible" : "hidden";
                this.onToggle.emit({ key, value: next });
            });

            this.menu.appendChild(li);
        });
    }

    private titleFromKey(key: string): string {
        return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
    }
}

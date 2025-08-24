import {BooleanSettingKey, WorkspaceFilter} from "@models/workspace-filter";
import {Signal} from "@utils/signal";

export class FilterMenuButton {
    readonly button: HTMLButtonElement;
    readonly badge: HTMLDivElement;
    readonly onToggle = new Signal<{ key: BooleanSettingKey; value: boolean }>();
    private readonly menu: HTMLMenuElement;

    constructor() {
        this.button = document.createElement("button");
        this.button.id = "filter-menu-button";
        this.button.className = "circle transparent";

        this.badge = document.createElement("div");
        this.badge.className = "badge";
        this.button.appendChild(this.badge);

        const icon = document.createElement("i");
        icon.textContent = "filter_list";

        this.menu = document.createElement("menu");
        this.menu.className = "no-wrap left";

        this.button.appendChild(icon);
        this.button.appendChild(this.menu);

        this.buildMenu();
        this.updateBadge();
    }

    private buildMenu() {
        const settings = WorkspaceFilter.getManager().get();
        (Object.keys(settings) as BooleanSettingKey[]).forEach((key) => {
            if ((key as string) === "searchQuery") return;

            const li = document.createElement("li");
            const active = (WorkspaceFilter as any)[key];

            const checkIcon = document.createElement("i");
            checkIcon.textContent = "check";
            if (!active) checkIcon.style.visibility = "hidden";

            li.appendChild(checkIcon);
            li.append(" " + this.titleFromKey(key));
            li.classList.toggle("fill", active);

            li.addEventListener("click", () => {
                const next = !(WorkspaceFilter as any)[key];
                (WorkspaceFilter as any)[key] = next;
                li.classList.toggle("fill", next);
                checkIcon.style.visibility = next ? "visible" : "hidden";
                this.onToggle.emit({key, value: next});
                this.updateBadge();
            });

            this.menu.appendChild(li);
        });
    }

    private updateBadge() {
        const settings = WorkspaceFilter.getManager().get();
        const activeCount = (Object.keys(settings) as BooleanSettingKey[])
            .filter(key => (WorkspaceFilter as any)[key])
            .length;

        if (activeCount > 0) {
            this.badge.textContent = String(activeCount);
            this.badge.style.display = "";
        } else {
            this.badge.style.display = "none";
        }
    }

    private titleFromKey(key: string): string {
        return key.replace("_", " ").replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
    }
}

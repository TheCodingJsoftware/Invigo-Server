import {DataTypeSwitcherMode} from "@config/data-type-mode";
import {WorkspacePermissions} from "@core/auth/workspace-permissions";
import {ViewBus} from "@components/workspace/views/view-bus";
import {DataTypeSwitcher} from "@components/workspace/views/switchers/data-type-switcher";
import {PartViewSwitcher} from "@components/workspace/views/switchers/part-view-switcher";
import {AssemblyViewSwitcher} from "@components/workspace/views/switchers/assembly-view-switcher";
import {NestViewSwitcher} from "@components/workspace/views/switchers/nest-view-switcher";
import {JobViewSwitcher} from "@components/workspace/views/switchers/job-view-switcher";
import {UserContext} from "@core/auth/user-context";

export class ViewSwitcherPanel {
    readonly element: HTMLElement;
    readonly #user = Object.freeze(UserContext.getInstance().user);

    private dataTypeSwitcher = new DataTypeSwitcher();
    private partViewSwitcher = new PartViewSwitcher();
    private assemblyViewSwitcher = new AssemblyViewSwitcher();
    private nestViewSwitcher = new NestViewSwitcher();
    private jobViewSwitcher = new JobViewSwitcher();

    constructor() {
        this.element = document.createElement("div");
    }

    initialize() {
        if (this.#user.can(WorkspacePermissions.SwitchDataTypes)) {
            this.dataTypeSwitcher.initialize();
            this.element.appendChild(this.dataTypeSwitcher.element);
        }
        if (this.#user.can(WorkspacePermissions.SwitchPartView)) {
            this.partViewSwitcher.initialize();
            this.element.appendChild(this.partViewSwitcher.element);
        }
        if (this.#user.can(WorkspacePermissions.SwitchAssemblyView)) {
            this.assemblyViewSwitcher.initialize();
            this.element.appendChild(this.assemblyViewSwitcher.element);
        }
        if (this.#user.can(WorkspacePermissions.SwitchNestView)) {
            this.nestViewSwitcher.initialize();
            this.element.appendChild(this.nestViewSwitcher.element);
        }
        if (this.#user.can(WorkspacePermissions.SwitchJobView)) {
            this.jobViewSwitcher.initialize();
            this.element.appendChild(this.jobViewSwitcher.element);
        }

        ViewBus.subscribe((view) => {
            if (this.#user.can(WorkspacePermissions.SwitchPartView)) {
                this.partViewSwitcher.element.style.display = view.dataType === DataTypeSwitcherMode.Part ? "block" : "none";
            }
            if (this.#user.can(WorkspacePermissions.SwitchAssemblyView)) {
                this.assemblyViewSwitcher.element.style.display = view.dataType === DataTypeSwitcherMode.Assembly ? "block" : "none";
            }
            if (this.#user.can(WorkspacePermissions.SwitchNestView)) {
                this.nestViewSwitcher.element.style.display = view.dataType === DataTypeSwitcherMode.Nest ? "block" : "none";
            }
            if (this.#user.can(WorkspacePermissions.SwitchJobView)) {
                this.jobViewSwitcher.element.style.display = view.dataType === DataTypeSwitcherMode.Job ? "block" : "none";
            }
        });
    }
}

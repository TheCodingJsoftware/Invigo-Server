import "beercss"
import '@static/css/style.css';
import '@static/css/theme.css';
import {WorkspacePermissions, PermissionMap, extendPermissionMapWithTags} from "@core/auth/workspace-permissions";
import { User } from "@core/auth/user";
import { WorkspaceSettings } from "@core/settings/workspace-settings";

interface Role {
    id: number;
    name: string;
    permissions: string[];
}

class PermissionToggle {
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

async function fetchRoles(): Promise<Role[]> {
    const res = await fetch("/api/roles");
    const json = await res.json();
    return json.roles;
}

async function updateRole(role: Role): Promise<void> {
    await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role),
    });
}

async function deleteRole(role: Role): Promise<void> {
    await fetch(`/api/roles?id=${role.id}`, { method: "DELETE" });
}

function renderRole(role: Role): HTMLElement {
    const toggles: PermissionToggle[] = [];
    const el = document.createElement("article");
    el.classList.add("border", "round", "grid");

    const nameField = document.createElement("div");
    nameField.className = "s12 field label border small-round";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "role-name";
    nameInput.value = role.name;

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Role Name";
    nameField.append(nameInput, nameLabel);

    // Fieldsets
    const generalFieldset = document.createElement("fieldset");
    generalFieldset.className = "s12 m4 l4 permissions wrap small-round";
    generalFieldset.innerHTML = `<legend>General Permissions</legend>`;
    const generalNav = document.createElement("nav");
    generalNav.className = "grid no-space";
    generalFieldset.append(generalNav);

    const viewTagFieldset = document.createElement("fieldset");
    viewTagFieldset.className = "s12 m4 l4 permissions wrap small-round";
    viewTagFieldset.innerHTML = `<legend>View Process Tags</legend>`;
    const viewNav = document.createElement("nav");
    viewNav.className = "grid no-space";
    viewTagFieldset.append(viewNav);

    const applyTagFieldset = document.createElement("fieldset");
    applyTagFieldset.className = "s12 m4 l4 permissions wrap small-round";
    applyTagFieldset.innerHTML = `<legend>Apply Process Tags</legend>`;
    const applyNav = document.createElement("nav");
    applyNav.className = "grid no-space";
    applyTagFieldset.append(applyNav);

    Object.values(PermissionMap).forEach(p => {
        const toggle = new PermissionToggle(p.value, role.permissions.includes(p.value));
        toggles.push(toggle);

        if (p.value.startsWith("view_tag:")) {
            toggle.element.classList.add("s12");
            viewNav.appendChild(toggle.element);
        } else if (p.value.startsWith("apply_tag:")) {
            toggle.element.classList.add("s12");
            applyNav.appendChild(toggle.element);
        } else {
            toggle.element.classList.add("s12", "m6", "l6");
            generalNav.appendChild(toggle.element);
        }
    });

    const saveBtn = document.createElement("button");
    saveBtn.className = "save";
    saveBtn.innerHTML = `<i>save</i><span>Save</span>`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete error";
    deleteBtn.innerHTML = `<i>delete</i><span>Delete</span>`;

    const actions = document.createElement("nav");
    actions.className = "s12 right-align";
    actions.append(saveBtn, deleteBtn);

    el.append(nameField, generalFieldset, viewTagFieldset, applyTagFieldset, actions);

    saveBtn.addEventListener("click", async () => {
        const updated: Role = {
            id: role.id,
            name: nameInput.value,
            permissions: toggles.filter(t => t.isChecked()).map(t => t.value)
        };
        await updateRole(updated);
        await loadRoles();
    });

    deleteBtn.addEventListener("click", async () => {
        const confirmed = confirm(`Are you sure you want to delete the role "${role.name}"?`);
        if (!confirmed) return;

        await deleteRole(role);
        await loadRoles();
    });

    return el;
}

async function loadRoles() {
    const roles = await fetchRoles();
    const container = document.getElementById("roles-list")!;
    container.innerHTML = "";
    roles.forEach(role => container.appendChild(renderRole(role)));
    return container;
}

document.getElementById("add-role")?.addEventListener("click", async () => {
    const newRole: Role = { id: 0, name: "new", permissions: [] };
    await updateRole(newRole);
    await loadRoles();
});

WorkspaceSettings.load().then(() => {
    extendPermissionMapWithTags();
});

User.fetchCurrent().then(async (user) => {
    if (user.can(WorkspacePermissions.EditRoles)) {
        await loadRoles();
    } else {
        document.getElementById("add-role")!.classList.add("hidden");
        ui("#not-allowed", -1);
    }
});

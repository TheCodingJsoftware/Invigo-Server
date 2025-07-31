import "beercss"
import '@static/css/style.css';
import '@static/css/theme.css';
import { Permissions, PermissionMap } from "@core/auth/permissions";
import { User } from "@core/auth/user";

interface Role {
    id: number;
    name: string;
    permissions: string[];
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
    const el = document.createElement("article");
    el.classList.add("border", "round");

    const checkboxes = Object.values(PermissionMap).map(p => {
        const checked = role.permissions.includes(p.value) ? "checked" : "";
        return `
            <label class="checkbox">
                <input type="checkbox" value="${p.value}" class="perm" ${checked}>
                <span>${p.label}</span>
            </label>
        `;
    }).join("");

    el.innerHTML = `
        <div>
            <div class="field label border small-round">
                <input type="text" class="role-name" value="${role.name}">
                <label>Role Name</label>
            </div>
            <fieldset class="permissions wrap small-round">
                <legend>Permissions</legend>
                    <nav class="wrap">
                        ${checkboxes}
                    </nav>
            </fieldset>
            <nav class="right-align">
                <button class="save">
                    <i>save</i>
                    <span>Save</span>
                </button>
                <button class="delete">
                    <i>delete</i>
                    <span>Delete</span>
                </button>
            </nav>
        </div>
    `;

    el.querySelector(".save")?.addEventListener("click", async () => {
        const updated: Role = {
            id: role.id,
            name: (el.querySelector(".role-name") as HTMLInputElement).value,
            permissions: Array.from(el.querySelectorAll(".perm:checked")).map(
                (cb) => (cb as HTMLInputElement).value
            ),
        };
        await updateRole(updated);
        await loadRoles();
    });

    el.querySelector(".delete")?.addEventListener("click", async () => {
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

User.fetchCurrent().then(user => {
    if (user.can(Permissions.EditRoles)) {
        loadRoles();
    } else {
        document.getElementById("add-role")!.classList.add("hidden");
        ui("#not-allowed", -1);
    }
});
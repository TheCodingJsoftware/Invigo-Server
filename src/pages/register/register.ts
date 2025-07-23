import "beercss";
import '@static/css/style.css';
import '@static/css/theme.css';
import { Permission } from "@auth/permissions";
import { User } from "@auth/user";

window.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("register-form")!;
    const roleSelect = document.getElementById("role") as HTMLSelectElement;

    const [rolesRes, userRes] = await Promise.allSettled([
        fetch("/api/roles"),
        fetch("/api/protected", { credentials: "include" })
    ]);

    let allowed = false;

    if (userRes.status === "fulfilled" && userRes.value.ok) {
        const userData = await userRes.value.json();
        const user = new User(userData);
        allowed = user.can(Permission.AssignRoles);
    }

    if (!allowed) {
        form.classList.add("hidden");
        ui("#not-allowed", -1);
        return;
    }

    if (rolesRes.status === "fulfilled") {
        const json = await rolesRes.value.json();
        for (const role of json.roles as { id: number; name: string }[]) {
            const opt = document.createElement("option");
            opt.value = role.name;
            opt.textContent = role.name;
            roleSelect.appendChild(opt);
        }
    } else {
        form.classList.add("hidden");
    }
});

document.getElementById("register-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (document.getElementById("name") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const role = (document.getElementById("role") as HTMLSelectElement).value;

    const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password, role }),
        credentials: "include",
    });

    if (res.ok) {
        (document.getElementById("name-text")!).textContent = name;
        (document.getElementById("password-text")!).textContent = password;
        ui("#login-credentials");
    } else {
        (document.getElementById("register-error")!).textContent = "Registration failed.";
        ui("#register-error", -1);
    }
});

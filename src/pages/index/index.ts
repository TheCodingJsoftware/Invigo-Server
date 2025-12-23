import "beercss";
import "@utils/theme";
import { AppearanceDialog } from "@components/common/dialog/appearance-dialog";
import { UserContext } from "@core/auth/user-context";
import { PermissionMap } from "@core/auth/workspace-permissions";
import { LoginDialog } from "@components/common/dialog/login-dialog";

// ----------------------------------
// Permission UI handling
// ----------------------------------

function hideProtectedElements(): void {
    document
        .querySelectorAll<HTMLElement>("[data-auth]")
        .forEach(el => {
            el.style.display = "none";
        });
}

function applyPermissions(): void {
    const user = UserContext.getInstance().user;

    document
        .querySelectorAll<HTMLElement>("[data-auth]")
        .forEach(el => {
            const permKey = el.dataset.permission;
            if (!permKey) return;

            const permission = PermissionMap[permKey];
            if (!permission) return;

            if (user.can(permission)) {
                el.style.display = "";
            }
        });
}

// ----------------------------------
// Bootstrap
// ----------------------------------

document.addEventListener("DOMContentLoaded", async () => {
    hideProtectedElements();

    const themeButton = document.getElementById("theme-button") as HTMLButtonElement;
    themeButton.onclick = () => new AppearanceDialog();

    const logoutButton = document.getElementById("logout-button") as HTMLButtonElement;
    logoutButton.onclick = async () => {
        await fetch("/api/logout", { method: "POST", credentials: "include" });
        window.location.reload();
    }

    const loginButton = document.getElementById("login-button") as HTMLButtonElement;
    loginButton.onclick = () => {
        new LoginDialog();
    };

    await UserContext.init();

    applyPermissions();

    const user = UserContext.getInstance().user;
    if (user.id !== 0) {
        logoutButton.classList.remove("hidden");
        loginButton.classList.add("hidden");
        const welcome = document.getElementById("welcome-message");
        if (welcome) {
            welcome.textContent = `Welcome back, ${user.name}!`;
            ui(welcome, 2000);
        }
    }
});

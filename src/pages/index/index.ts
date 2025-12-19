import "beercss";
import "@utils/theme";
import { AppearanceDialog } from "@components/common/dialog/appearance-dialog";
import { UserContext } from "@core/auth/user-context";
import { PermissionMap } from "@core/auth/workspace-permissions";

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

    await UserContext.init();

    applyPermissions();

    const user = UserContext.getInstance().user;
    if (user.id !== 0) {
        const welcome = document.getElementById("welcome-message");
        if (welcome) {
            welcome.textContent = `Welcome back, ${user.name}!`;
            ui(welcome, 2000);
        }
    }
});

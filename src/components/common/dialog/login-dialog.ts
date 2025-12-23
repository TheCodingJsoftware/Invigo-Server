import "beercss";
import "@utils/theme";

import { DialogComponent } from "@components/common/dialog/dialog-component";

interface LoginUser {
    name: string;
}

export class LoginDialog extends DialogComponent {
    private errorEl!: HTMLElement;

    constructor() {
        super({
            id: "login-dialog",
            title: "Login",
            bodyContent: `<form id="login-form" class="grid large-space">
                <div class="s12 field small-round label border">
                    <input id="username" required autocomplete="username" />
                    <label>Username</label>
                </div>

                <div class="s12 field small-round label border">
                    <input id="password" type="password" required autocomplete="current-password" />
                    <label>Password</label>
                    <output class="invalid" id="login-error"></output>
                </div>

                <button class="s12" type="submit">
                    <i>login</i>
                    <span>Login</span>
                </button>
            </form>

            <div id="logout-container" class="hidden">
                <p id="user-info"></p>
                <button class="responsive">
                    <i>logout</i>
                    <span>Logout</span>
                </button>
            </div>`,
        });

        this.render();
        this.checkSession();
    }

    private render(): void {
        this.errorEl = this.query("#login-error") as HTMLElement;

        this.query<HTMLFormElement>("#login-form")!
            .addEventListener("submit", this.handleLogin);

        this.query<HTMLButtonElement>("#logout-container button")!
            .addEventListener("click", this.handleLogout);
    }

    /* -----------------------------
       Session detection
       ----------------------------- */

    private async checkSession(): Promise<void> {
        try {
            const res = await fetch("/api/protected", {
                credentials: "include",
            });

            if (!res.ok) return;

            const user: LoginUser = await res.json();
            this.showLoggedIn(user);
        } catch {
            // silent — show login form
        }
    }

    private showLoggedIn(user: LoginUser): void {
        this.query("#login-form")!.classList.add("hidden");

        const logout = this.query("#logout-container")!;
        logout.classList.remove("hidden");

        this.query("#user-info")!.textContent =
            `Logged in as ${user.name}`;
    }

    /* -----------------------------
       Login / Logout
       ----------------------------- */

    private handleLogin = async (e: SubmitEvent): Promise<void> => {
        e.preventDefault();
        this.errorEl.textContent = "";

        const name = (this.query("#username") as HTMLInputElement).value;
        const password = (this.query("#password") as HTMLInputElement).value;

        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name, password }),
        });

        if (!res.ok) {
            this.errorEl.textContent = "Login failed.";
            return;
        }

        // successful login
        window.location.reload();
    };

    private handleLogout = async (): Promise<void> => {
        await fetch("/api/logout", {
            method: "POST",
            credentials: "include",
        });

        window.location.reload();
    };
}

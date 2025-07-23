import "beercss"
import '@static/css/style.css';
import '@static/css/theme.css';

window.addEventListener("DOMContentLoaded", async () => {
    const logoutDiv = document.getElementById("logout-container");
    const loginForm = document.getElementById("login-form");
    const userInfo = document.getElementById("user-info");
    const logoutButton = document.querySelector("#logout-container button");
    logoutButton?.addEventListener("click", logout);

    try {
        const res = await fetch("/api/protected", { credentials: "include" });
        if (res.ok) {
            const user = await res.json();
            userInfo!.textContent = `Logged in as ${user.name}`;
            logoutDiv?.classList.remove("hidden");
            loginForm?.classList.add("hidden");
        } else {
            logoutDiv?.classList.add("hidden");
            loginForm?.classList.remove("hidden");
        }
    } catch (error) {
        logoutDiv?.classList.add("hidden");
        loginForm?.classList.remove("hidden");
    }
});

document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (document.getElementById("name") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // <- crucial!
        body: JSON.stringify({ name, password }),
    });

    if (res.ok) {
        window.location.reload();
    } else {
        document.getElementById("login-error")!.textContent = "Login failed.";
    }
});

async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    window.location.reload();
}
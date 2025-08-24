import "beercss"
import "@utils/theme"

document.getElementById("register-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (document.getElementById("name") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const roles = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='role']:checked"))
        .map(input => input.value);

    const res = await fetch("/api/users", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name, password, roles}),
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

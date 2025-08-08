import "beercss"
import '@static/css/style.css';
import '@static/css/theme.css';

document.addEventListener("DOMContentLoaded", async () => {
    const articles = document.querySelectorAll("article[data-user-id]") as NodeListOf<HTMLElement>;
    articles.forEach((article) => {
        if (!article.dataset.userId) {
            return;
        }
        const userId = parseInt(article.dataset.userId);
        const nameInput = article.querySelector("input[name='name']") as HTMLInputElement;
        const roleInputs = article.querySelectorAll("input[name='role']") as NodeListOf<HTMLInputElement>;
        const passwordInput = article.querySelector("input[name='password']") as HTMLInputElement;

        article.querySelector(".save-user")?.addEventListener("click", async () => {
            const name = nameInput.value.trim();
            const roles = Array.from(roleInputs)
                .filter(input => input.checked)
                .map(input => input.value);

            const res = await fetch(`/api/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, roles })
            });
            if (res.ok) {
                ui("#user-updated", 1000);
            } else {
                ui("#user-update-failed", 1000);
            }
        });

        article.querySelector(".set-password")?.addEventListener("click", async () => {
            const password = passwordInput.value;
            if (!password) {
                return;
            }

            const res = await fetch(`/api/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });
            if (res.ok) {
                ui("#password-updated", 1000);
                passwordInput.value = "";
            } else {
                ui("#password-update-failed", 1000);
            }
        });

        article.querySelector(".delete-user")?.addEventListener("click", async () => {
            if (!confirm("Are you sure you want to delete this user?")) {
                return;
            }

            const res = await fetch(`/api/users/${userId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                article.remove();
                ui("#user-deleted", 1000);
            } else {
                ui("#user-delete-failed", 1000);
            }
        });
    });
});
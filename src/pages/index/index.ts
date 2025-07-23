import "beercss"
import '@static/css/style.css';
import '@static/css/theme.css';

// if ('serviceWorker' in navigator) {
//     navigator.serviceWorker.register('/service-worker.js');
// }

document.addEventListener("DOMContentLoaded", async () => {
    await fetch("/api/protected", { credentials: "include" }).then(async (res) => {
        if (res.ok) {
            const user = await res.json();
            const welcomeMessage = document.getElementById("welcome-message") as HTMLElement;
            welcomeMessage.innerText = `Welcome back, ${user.name}!`;
            ui("#welcome-message", 2000);
        }
    });
});
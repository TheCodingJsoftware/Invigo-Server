import "beercss"
import "@utils/theme"
import {AppearanceDialog} from "@components/common/dialog/appearance-dialog";

//  if ('serviceWorker' in navigator) {
//      navigator.serviceWorker.register('/service-worker.js');
//  }

document.addEventListener("DOMContentLoaded", async () => {
    const themeButtnon = document.getElementById("theme-button") as HTMLButtonElement;
    themeButtnon.onclick = () => {new AppearanceDialog()};

    await fetch("/api/protected", {credentials: "include"}).then(async (res) => {
        if (res.ok) {
            const user = await res.json();
            const welcomeMessage = document.getElementById("welcome-message") as HTMLElement;
            welcomeMessage.innerText = `Welcome back, ${user.name}!`;
            ui("#welcome-message", 2000);
        }
    });
});
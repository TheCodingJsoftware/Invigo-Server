import "beercss"
import "@utils/theme"
import confetti from "canvas-confetti";


function fireConfettiFromButton(button: HTMLElement, hard = true) {
    const rect = button.getBoundingClientRect();

    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
        particleCount: hard ? rand(120, 240) : rand(20, 40),
        spread: rand(50, 80),
        startVelocity: rand(35, 55),
        origin: { x, y },
        angle: rand(80, 100),
    });
}

function rand(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min);
}


function playSuccessSoundOnce() {
    const audio = new Audio("/static/sounds/sound.wav");
    audio.preload = "auto";
    audio.play().catch(() => { });
}

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get("type") || "";
    const message = urlParams.get("message") || "No message provided.";
    const title = urlParams.get("title") || "Message";

    if (type === "error") {
        ui("theme", "#ff5252");
    } else if (type === "warning") {
        ui("theme", "#ffb300");
    } else if (type === "success") {
        ui("theme", "#4caf50");
        const closeBtn = document.getElementById("message-close-button") as HTMLButtonElement;
        closeBtn.onclick = () => {
            fireConfettiFromButton(closeBtn, true);

            // optional: still play your sound
            const audio = new Audio("/static/sounds/sound.wav");
            audio.play().catch(() => { });
        };
    } else {
        ui("theme", "#006493");
    }

    document.getElementById("message-content")!.textContent = message;
    document.getElementById("title")!.textContent = title;
    document.getElementById("message-title")!.textContent = title;
});

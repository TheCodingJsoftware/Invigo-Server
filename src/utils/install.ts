let installPrompt: BeforeInstallPromptEvent | null = null;

export {};

declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isAppInstalled(): boolean {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone
    );
}

function hideInstallButton() {
    const installButtons = document.querySelectorAll("#install");
    installButtons.forEach((button) => button.classList.add("hidden"));
}

function showInstallButton() {
    const installButtons = document.querySelectorAll("#install");
    installButtons.forEach((button) => button.classList.remove("hidden"));
}

async function handleInstallClick() {
    if (!installPrompt) return;
    try {
        const result = await installPrompt.prompt();
        if (result.outcome === "accepted") {
            installPrompt = null;
            hideInstallButton();
        }
    } catch (err) {
        console.error("Error showing install prompt:", err);
    }
}

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;

    if (!isAppInstalled()) {
        showInstallButton();
    } else {
        hideInstallButton();
    }
});

window.addEventListener("appinstalled", () => {
    installPrompt = null;
    hideInstallButton();
});

export function initInstall() {
    if (isAppInstalled()) {
        hideInstallButton();
    }

    const installButtons = document.querySelectorAll("#install");
    installButtons.forEach((button) => button.addEventListener("click", handleInstallClick));
    if (!installPrompt) {
        hideInstallButton();
    }
}

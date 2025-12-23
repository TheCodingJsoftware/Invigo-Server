import "beercss"
import "@utils/theme"

function goToMainUrl() {
    window.location.href = "/";
}

window.goToMainUrl = goToMainUrl;

const logContainer = document.getElementById("log-container");
const CHUNK_SIZE = 200;

async function loadLogsInBackground() {
    if (!logContainer) return;

    const res = await fetch("/api/server-logs", { credentials: "include" });
    if (!res.ok) return;

    const { logs } = await res.json();

    let index = 0;

    function renderChunk(deadline) {
        let count = 0;
        const fragment = document.createDocumentFragment();

        while (
            index < logs.length &&
            count < CHUNK_SIZE &&
            (!deadline || deadline.timeRemaining() > 5)
        ) {
            const code = document.createElement("code");
            code.className = "log-line no-margin no-line no-wrap no-padding transparent";
            code.innerHTML = logs[index];
            fragment.appendChild(code);

            index++;
            count++;
        }

        logContainer.appendChild(fragment);

        if (index < logs.length) {
            requestIdleCallback(renderChunk);
        }
    }

    requestIdleCallback(renderChunk);
}

function resize() {
    const article = document.querySelector("article.scroll");
    if (!article) return;

    const topOffset = article.getBoundingClientRect().top; // Distance from top of screen
    const bottomPadding = 46;

    // Calculate space remaining from article's top to bottom of viewport
    const availableHeight = window.innerHeight - topOffset - bottomPadding;

    article.style.height = `${availableHeight}px`;
    article.style.maxHeight = `${availableHeight}px`;
}

// Initial resize
window.addEventListener("load", resize);
window.addEventListener("resize", resize);

document.addEventListener("DOMContentLoaded", function () {
    const search = document.getElementById("search");
    const savedSearch = localStorage.getItem("searchText");
    const scrollKeyX = "logScrollX";
    const scrollKeyY = "logScrollY";
    const article = document.querySelector("article.scroll");

    // Restore article scroll (horizontal and vertical)
    if (article) {
        const savedX = localStorage.getItem(scrollKeyX);
        const savedY = localStorage.getItem(scrollKeyY);

        if (savedX !== null) article.scrollLeft = parseInt(savedX, 10);
        if (savedY !== null) {
            // Delay scrollTop in case content isn't fully loaded yet
            setTimeout(() => {
                article.scrollTop = parseInt(savedY, 10);
            }, 0);
        }

        // Save scroll
        article.addEventListener("scroll", () => {
            localStorage.setItem(scrollKeyX, article.scrollLeft);
            localStorage.setItem(scrollKeyY, article.scrollTop);

            const nearBottom =
                article.scrollTop + article.clientHeight >= article.scrollHeight - 200;

            if (nearBottom) {
                loadLogs();
            }
        });
    }


    if (search) {
        search.addEventListener("input", function () {
            const searchText = search.value.toLowerCase();

            localStorage.setItem("searchText", search.value);

            const logLines = document.querySelectorAll(".log-line");
            for (let i = 0; i < logLines.length; i++) {
                const logLine = logLines[i];
                const logText = logLine.textContent.toLowerCase();
                if (logText.includes(searchText)) {
                    logLine.classList.remove("hidden");
                } else {
                    logLine.classList.add("hidden");
                }
            }
        });
    }

    const quickSearches = document.querySelectorAll("#quick-search");
    for (let i = 0; i < quickSearches.length; i++) {
        const quickSearch = quickSearches[i];
        quickSearch.addEventListener("click", function () {
            const span = quickSearch.querySelector("span");
            const searchText = span.textContent.toLowerCase();
            search.value = searchText;
            search.dispatchEvent(new Event("input"));
        });
    }

    if (search && savedSearch) {
        search.value = savedSearch;
        search.dispatchEvent(new Event("input"));
    }
    loadLogsInBackground();
    resize();
});
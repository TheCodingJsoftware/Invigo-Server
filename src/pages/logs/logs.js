import "beercss"
import "@utils/theme"

function goToMainUrl() {
    window.location.href = "/";
}

function fetchLogContent(file_name) {
    const formData = new FormData();
    formData.append("log_file_name", file_name);

    const logNameElement = document.getElementById("log-name");
    if (logNameElement) {
        logNameElement.textContent = file_name;
    }

    fetch("/api/fetch-log", {
        method: "POST",
        body: formData
    })
        .then(response => response.text())
        .then(data => {
            document.getElementById("log_content").innerHTML = data;
            ui("#log_dialog");
            window.location.hash = encodeURIComponent(file_name);
        })
        .catch(error => {
            console.error('Error fetching log content:', error);
        });
}

function deleteLog(logFileName, button) {
    const formData = new FormData();
    formData.append("log_file_name", logFileName);

    fetch("/api/delete-log", {
        method: "POST",
        body: formData
    })
        .then(response => response.text())
        .then(data => {
            const parent = button.parentElement;
            parent.parentElement.removeChild(parent);
        })
        .catch(error => {
            console.error('Error deleting log file:', error);
        });
}

function checkForHash() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        fetchLogContent(decodeURIComponent(hash));
    }
}

function formatTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    const units = [
        [60, "second"],
        [60, "minute"],
        [24, "hour"],
        [7, "day"],
        [4.345, "week"],
        [12, "month"],
        [Number.POSITIVE_INFINITY, "year"],
    ];

    let value = seconds;
    let unit = "second";

    for (const [limit, name] of units) {
        if (value < limit) {
            unit = name;
            break;
        }
        value /= limit;
    }

    value = Math.floor(value);
    return `${value} ${unit}${value !== 1 ? "s" : ""} ago`;
}

document.addEventListener("DOMContentLoaded", function () {
    checkForHash();

    const buttons = document.querySelectorAll(".error-log");

    buttons.forEach(btn => {
        const dateStr = btn.dataset.date;
        if (!dateStr) return;

        const normalized = dateStr.replace(
            /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+)\s+\w+\s+(\d+)/,
            "$1 $2 $3"
        );

        const logDate = new Date(normalized);
        if (isNaN(logDate.getTime())) return;
        console.log(logDate);

        const ageText = formatTimeAgo(logDate);

        let span = btn.querySelector(".log-age");
        if (!span) {
            span = document.createElement("span");
            span.className = "log-age";
            btn.appendChild(span);
        }

        span.textContent = `(${ageText})`;
    });

    const logDialog = document.getElementById('log_dialog');
    if (logDialog) {
        logDialog.addEventListener('close', function () {
            window.location.hash = "";
        });
    }
});

window.goToMainUrl = goToMainUrl;
window.deleteLog = deleteLog;
window.fetchLogContent = fetchLogContent;
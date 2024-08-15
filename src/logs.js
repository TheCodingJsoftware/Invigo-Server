import "beercss"

function goToMainUrl() {
    window.location.href = "/";
}

function fetchLogContent(file_name) {
    const formData = new FormData();
    formData.append("log_file_name", file_name);

    fetch("/fetch_log", {
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

    fetch("/delete_log", {
            method: "POST",
            body: formData
        })
        .then(response => response.text())
        .then(data => {
            console.log(data);
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

document.addEventListener("DOMContentLoaded", function() {
    checkForHash();

    const logDialog = document.getElementById('log_dialog');
    if (logDialog) {
        logDialog.addEventListener('close', function() {
            window.location.hash = "";
        });
    }
});

window.goToMainUrl = goToMainUrl;
window.deleteLog = deleteLog;
window.fetchLogContent = fetchLogContent;
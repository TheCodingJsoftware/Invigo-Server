import "beercss"
import "@utils/theme"

function goToMainUrl() {
    window.location.href = "/";
}

function openPrintout(job_id) {
    window.location.href = "/jobs/view?id=" + job_id;
}

window.goToMainUrl = goToMainUrl;
window.openPrintout = openPrintout;
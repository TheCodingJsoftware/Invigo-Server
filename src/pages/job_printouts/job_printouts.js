import "beercss"
import "@utils/theme"
import "material-dynamic-colors";

document.addEventListener("DOMContentLoaded", () => {
    const jobStatuses = Array.from(document.querySelectorAll('.tabbed a'));

    jobStatuses.forEach((status, index) => {
        status.addEventListener("click", () => {
            const page = document.querySelector(`${status.dataset.ui}`);
            page.classList.add("active");
            localStorage.setItem("saved-job-status-tab", status.dataset.ui);
            ui("theme", status.dataset.color);
        });
    });

    const savedTab = localStorage.getItem("saved-job-status-tab") || "workspace";

    if (savedTab) {
        jobStatuses.forEach(status => {
            const page = document.querySelector(`${status.dataset.ui}`);
            page.classList.remove("active");
            status.classList.remove("active");
            if (status.dataset.ui === savedTab) {
                status.click();
                status.classList.add("active");
                page.classList.add("active");
            }
        });
    }
});

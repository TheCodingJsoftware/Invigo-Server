import "beercss";
import "material-dynamic-colors";
import { UserContext } from "@core/auth/user-context";
import { PartElement } from "@components/workspace/parts/part-element";
import { PartData } from "@components/workspace/parts/part-container";
import { invertImages } from "@utils/theme";
import { fetchJobData } from "@components/workspace/parts/job-element";

function loadJSONFromScript<T>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing script tag: ${id}`);
    return JSON.parse(el.textContent || "{}") as T;
}

document.addEventListener("DOMContentLoaded", async () => {
    await UserContext.init();
    const jobId = Number(document.body.dataset.jobId);
    const partName = document.body.dataset.partName;
    if (!jobId || !partName) {
        throw new Error("Missing jobId or partName");
    }
    const jobData = await fetchJobData(jobId);
    ui("theme", jobData.job_data.color);
    const partData = loadJSONFromScript<PartData>("part-data");
    const partElement = new PartElement(partData);
    partElement.element.classList.add("middle");
    partElement.element.classList.remove("border");
    document.querySelector("main")!.appendChild(partElement.element);
    invertImages();
});

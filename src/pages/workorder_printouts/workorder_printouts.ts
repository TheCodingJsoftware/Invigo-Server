import "beercss";
import "@utils/theme";
import { DialogComponent } from "@components/common/dialog/dialog-component";
import { invertImages } from "@utils/theme";
import { NestedSheets } from "@components/nested-sheets";
import { Nest } from "@models/nest";
import { NestedParts } from "@components/nested-parts";
import { NestedPartsSummary } from "@components/nested-parts-summary";

document.addEventListener("DOMContentLoaded", () => {
    const nestButtons = document.querySelectorAll(
        ".nest-button"
    ) as NodeListOf<HTMLButtonElement>;

    nestButtons.forEach((button) => {
        let hoverLoaded = false;

        button.addEventListener("mouseover", async () => {
            if (hoverLoaded) return;
            hoverLoaded = true;

            const res = await fetch(
                `/workorders/get/nest/${button.dataset.id}/${button.dataset.name}`,
                {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                }
            );

            const json = await res.json();

            const nest = new Nest(json);
            const nestedSheets = new NestedSheets(-1, [nest]);

            const tooltip = button.querySelector(".tooltip") as HTMLDivElement;
            tooltip.innerHTML = nestedSheets.generateNestedSheetsListHTML(nest);
            tooltip.querySelector("article")!.classList.add("medium-elevate");

            invertImages(tooltip);
        }, { once: true });


        button.addEventListener("click", async () => {

            const res = await fetch(
                `/workorders/get/nest/${button.dataset.id}/${button.dataset.name}`,
                {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                }
            );

            const json = await res.json();

            const nest = new Nest(json);

            const nestedSheets = new NestedSheets(-1, [nest]);
            const nestedParts = new NestedPartsSummary(-1, [nest]).build();
            nestedParts.querySelectorAll('.hide-on-print').forEach(el => el.remove());

            new DialogComponent({
                id: "workorder-dialog",
                title: `${button.dataset.name}`,
                bodyContent: `
                    ${nestedSheets.generateNestedSheetsListHTML(nest)}
                    ${nestedParts.outerHTML}
                `,
            });

            invertImages();
        });
    });

    invertImages();
});

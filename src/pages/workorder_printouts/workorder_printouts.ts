import "beercss"
import "@utils/theme"
import { DialogComponent } from "@components/common/dialog/dialog-component";
import { invertImages } from "@utils/theme";

document.addEventListener("DOMContentLoaded", () => {
    const nestButtons = document.querySelectorAll(".nest-button") as NodeListOf<HTMLButtonElement>;
    nestButtons.forEach((button) => {
        button.addEventListener("click", () => {
            new DialogComponent({
                id: "workorder-dialog",
                title: `${button.dataset.name}`,
                bodyContent: `<img class="responsive round nest-image" height="440" width="580" src="/images/${button.dataset.image}" alt="nest-image">`
            });
            invertImages();
        });
    });
    invertImages();
});

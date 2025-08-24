import "beercss"
import "@utils/theme"
import {DialogComponent} from "@components/common/dialog/dialog-component";

document.addEventListener("DOMContentLoaded", () => {
    const nestButtons = document.querySelectorAll(".nest-button") as NodeListOf<HTMLButtonElement>;
    nestButtons.forEach((button) => {
        button.addEventListener("click", () => {
            new DialogComponent({
                id: "workorder-dialog",
                bodyContent: `<img class="responsive round nest-image" src="http://invi.go/image/${button.dataset.image}" alt="nest-image">`
            });
        });
    });
});

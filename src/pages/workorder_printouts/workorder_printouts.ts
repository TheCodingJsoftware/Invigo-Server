import "beercss"
import "@utils/theme"
import { DialogComponent } from "@components/common/dialog/dialog-component";

document.addEventListener("DOMContentLoaded", () => {
    const nestButtons = document.querySelectorAll(".nest-button") as NodeListOf<HTMLButtonElement>;
    nestButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const dialog = new DialogComponent(`
                <nav class="row">
                    <h5 class="max">${button.dataset.name}</h5>
                    <button class="circle transparent" id="close-btn">
                        <i>close</i>
                    </button>
                </nav>
                <img class="responsive round nest-image" src="http://invi.go/image/${button.dataset.image}" alt="nest-image">
            `, { id: "workorder-dialog", autoRemove: true });

            dialog.query<HTMLButtonElement>("#close-btn")?.addEventListener("click", () => {
                ui("#workorder-dialog");
            });
        });
    });
});

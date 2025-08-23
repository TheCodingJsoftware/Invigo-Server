import {DateRangeDialog} from "@components/common/dialog/date-range-dialog";

export class DateRangeButton {
    readonly button: HTMLButtonElement;

    constructor() {
        this.button = document.createElement("button");
        this.button.id = "date-range-button";
        this.button.className = "circle transparent";
        this.button.addEventListener("click", () => {
            new DateRangeDialog();
        })

        const icon = document.createElement("i");
        icon.textContent = "date_range";

        this.button.appendChild(icon);
    }

}

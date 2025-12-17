import { DialogComponent } from "@components/common/dialog/dialog-component";

export class AreYouSureDialog extends DialogComponent {
    constructor(title: string = "Are you sure?", bodyContent: string) {
        super({
            id: "are-you-sure-dialog",
            title: title,
            isModal: true,
            headerContent: `<h5>${title}</h5>`,
            bodyContent: `<div>${bodyContent}</div>`,
            footerContent: `
                <nav class="row top-margin right-align">
                    <button id="confirm" autofocus>
                        <i>check</i>
                        <span>Confirm</span>
                    </button>
                    <button id="cancel" class="transparent link">
                        <i>cancel</i>
                        <span>Cancel</span>
                    </button>
                </nav>`
        });
    }

    show(): Promise<boolean> {
        return new Promise(resolve => {
            const confirm = this.element.querySelector("#confirm")!;
            const cancel = this.element.querySelector("#cancel")!;

            const close = (value: boolean) => {
                this.close();
                resolve(value);
            };

            confirm.addEventListener("click", () => close(true));
            cancel.addEventListener("click", () => close(false));

            this.element.addEventListener("keydown", e => {
                if (e.key === "Escape") close(false);
                if (e.key === "Enter") close(true);
            });
        });
    }

}

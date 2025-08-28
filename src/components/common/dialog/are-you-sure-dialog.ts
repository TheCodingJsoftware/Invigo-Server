import {DialogComponent} from "@components/common/dialog/dialog-component";

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
                    <button class="transparent link" id="yes">
                        <i>check</i>
                        <span>Yes</span>
                    </button>
                    <button class="transparent link border" id="no">
                        <i>cancel</i>
                        <span>No</span>
                    </button>
                    <button id="cancel">
                        <i>cancel</i>
                        <span>Cancel</span>
                    </button>
                </nav>`
        });
    }

    show(): Promise<boolean> {
        return new Promise((resolve) => {
            const yesButton = this.element.querySelector("#yes") as HTMLButtonElement;
            const noButton = this.element.querySelector("#no") as HTMLButtonElement;
            const cancelButton = this.element.querySelector("#cancel") as HTMLButtonElement;

            const cleanUp = () => {
                yesButton.removeEventListener("click", onYes);
                noButton.removeEventListener("click", onNo);
                cancelButton.removeEventListener("click", onCancel);
                this.close(); // assuming DialogComponent has a close() method
            };

            const onYes = () => { cleanUp(); resolve(true); };
            const onNo = () => { cleanUp(); resolve(false); };
            const onCancel = () => { cleanUp(); resolve(false); };

            yesButton.addEventListener("click", onYes);
            noButton.addEventListener("click", onNo);
            cancelButton.addEventListener("click", onCancel);
        });
    }
}

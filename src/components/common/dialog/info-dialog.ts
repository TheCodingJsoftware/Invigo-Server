import { DialogComponent } from "@components/common/dialog/dialog-component";

export class InfoDialog extends DialogComponent {
    constructor(title: string = "Info", bodyContent: string) {
        super({
            id: "info-dialog",
            title: title,
            bodyContent: `<div>${bodyContent}</div>`,
            footerContent: `
                <nav class="row top-margin right-align">
                    <button id="ok" class="transparent link" autofocus>
                        <span>Ok</span>
                    </button>
                </nav>`
        });
    }

    show(): Promise<boolean> {
        return new Promise(resolve => {
            const okButton = this.element.querySelector("#ok")!;

            const close = (value: boolean) => {
                this.close();
                resolve(value);
            };

            okButton.addEventListener("click", () => close(true));

            this.element.addEventListener("keydown", e => {
                if (e.key === "Escape") close(true);
                if (e.key === "Enter") close(true);
            });
        });
    }
}

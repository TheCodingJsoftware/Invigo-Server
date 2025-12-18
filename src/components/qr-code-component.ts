import { PanelComponent } from '@interfaces/panel-component';
import QRCode from 'qrcode';

export class QRCodeComponent implements PanelComponent {
    url: string;
    element!: HTMLElement;
    description?: string;

    constructor(url: string, description?: string) {
        this.url = encodeURI(url);
        this.description = description;
    }

    public async build(): Promise<HTMLElement> {
        const template = document.createElement("template");
        template.innerHTML = `
        <article class="round border no-padding page-break-inside">
            <nav class="hide-on-print left-padding top-padding right-padding">
                <div class="handle" data-swapy-handle><i>drag_indicator</i></div>
                <h4 class="max">QR Code</h4>
                <a class="circle link transparent" href="${this.url}" target="_blank">
                    <i>open_in_new</i>
                </a>
            </nav>
            <div class="qr-code center-align middle-align"></div>
            ${this.description ? `<h6 class="center-align">${this.description}</h6>` : ''}
        </article>
        `.trim(); // Trim leading whitespace

        const qrCodeDiv = template.content.cloneNode(true) as DocumentFragment;
        const qrDiv = qrCodeDiv.querySelector('.qr-code') as HTMLElement;

        const canvas = document.createElement('canvas');
        canvas.className = "padding";
        await QRCode.toCanvas(canvas, this.url, {
            width: 256,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        });
        qrDiv.appendChild(canvas);

        this.element = qrCodeDiv.firstElementChild as HTMLElement;
        this.element.id = `qr-code-${this.url}`;

        return this.element;
    }

    public async render(): Promise<void> {
        const container = document.querySelector('#qr-code-container') as HTMLDivElement;
        container.appendChild(await this.build());
        return Promise.resolve();
    }

    public hide(): void {
        this.element?.classList.add("hidden");
    }

    public show(): void {
        this.element?.classList.remove("hidden");
    }
}

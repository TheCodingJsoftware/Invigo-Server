import "beercss"
import "@utils/theme"
import "@static/css/style.css"
import QRCode from 'qrcode'

async function loadQRCodes() {
    for (const item of document.querySelectorAll('.qr-item')) {
        const name = item.getAttribute('data-name');
        const baseUrl = window.location.origin + '/';
        const encodedUrl = encodeURI(
            name === "add_cutoff_sheet"
                ? baseUrl + name.replace(/ /g, "_")
                : baseUrl + "sheets_in_inventory/" + name.replace(/ /g, "_")
        );
        const qrDiv = item.querySelector(name === "add_cutoff_sheet" ? '.qr-code-add-cut-off' : '.qr-code');

        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, encodedUrl, {
            width: name === "add_cutoff_sheet" ? 512 : 256,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        });
        qrDiv.appendChild(canvas);

        qrDiv.style.cursor = 'pointer';
        qrDiv.addEventListener('click', () => {
            window.open(encodedUrl, '_blank');
        });
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    await loadQRCodes();
});

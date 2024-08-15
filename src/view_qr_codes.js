import "beercss"

function goToMainUrl() {
    window.location.href = "/"
}

document.addEventListener('DOMContentLoaded', async function () {
    const baseUrl = "http://invi.go/";
    document.querySelectorAll('.qr-item').forEach(item => {
        const name = item.getAttribute('data-name');
        if (name == "add_cutoff_sheet") {
            const encodedUrl = encodeURI(baseUrl + name.replace(/ /g, "_"));
            const qrDiv = item.querySelector('.qr-code-add-cut-off');
            new QRCode(qrDiv, {
                text: encodedUrl,
                width: 2048,
                height: 2048,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            qrDiv.style.cursor = 'pointer';
            qrDiv.addEventListener('click', function () {
                window.open(encodedUrl, '_blank');
            });
        } else {
            const sheetsUrl = baseUrl + "sheets_in_inventory/"
            const encodedUrl = encodeURI(sheetsUrl + name.replace(/ /g, "_"));
            const qrDiv = item.querySelector('.qr-code');
            new QRCode(qrDiv, {
                text: encodedUrl,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            qrDiv.style.cursor = 'pointer';
            qrDiv.addEventListener('click', function () {
                window.open(encodedUrl, '_blank');
            });
        }
    });
});

window.addEventListener('beforeprint', function () {
    document.body.classList.remove('dark');
    document.body.classList.add('light');
});

window.addEventListener('afterprint', function () {
    document.body.classList.remove('light');
    document.body.classList.add('dark');
});

window.goToMainUrl = goToMainUrl;
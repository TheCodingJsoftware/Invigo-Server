const puppeteer = require("puppeteer");

(async () => {
    const url = process.argv[2];
    const output = process.argv[3];
    const storageEncoded = process.argv[4];

    if (!url || !output || !storageEncoded) {
        console.error("Missing arguments: url, output, localStorage");
        process.exit(1);
    }

    const localStorageData = JSON.parse(Buffer.from(storageEncoded, "base64").toString());

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--single-process",
            "--no-zygote",
        ],
    });
    const page = await browser.newPage();

    await page.goto("about:blank");

    await page.evaluateOnNewDocument((state) => {
        for (const [key, value] of Object.entries(state)) {
            localStorage.setItem(key, value);
        }
    }, localStorageData);

    await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });

    await page.evaluate(() => {
        if (window.applyStoredSettings) {
            window.applyStoredSettings();
        }
    });

    await page.emulateMediaType("print"); // for print-style layout

    await new Promise(resolve => setTimeout(resolve, 500));

    await page.screenshot({
        path: output,
        type: "png",
        fullPage: true,
    });

    await browser.close();
})();

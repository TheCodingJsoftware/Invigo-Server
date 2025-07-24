const puppeteer = require("puppeteer");

(async () => {
    const url = process.argv[2];               // Full URL like: http://localhost:5057/view?id=11
    const output = process.argv[3];            // Output file path
    const storageEncoded = process.argv[4];    // base64-encoded JSON localStorage

    if (!url || !output || !storageEncoded) {
        console.error("Missing arguments: url, output, localStorage");
        process.exit(1);
    }

    const localStorageData = JSON.parse(Buffer.from(storageEncoded, "base64").toString());

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.goto("about:blank");

    await page.evaluateOnNewDocument((state) => {
        for (const [key, value] of Object.entries(state)) {
            localStorage.setItem(key, value);
        }
    }, localStorageData);

    await page.goto(url, { waitUntil: "networkidle0" });

    await page.evaluate(() => {
        if (window.applyStoredSettings) window.applyStoredSettings();
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    await page.pdf({
        path: output,
        format: "A4",
        printBackground: true,
        margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
    });

    await browser.close();
})();

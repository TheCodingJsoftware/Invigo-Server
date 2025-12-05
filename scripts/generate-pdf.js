const fs = require("fs");
const puppeteer = require("puppeteer");

(async () => {
    const url = process.argv[2];
    const output = process.argv[3];
    const storageArg = process.argv[4];

    if (!url || !output || !storageArg) process.exit(1);

    let localStorageData = {};
    if (fs.existsSync(storageArg)) {
        localStorageData = JSON.parse(fs.readFileSync(storageArg, "utf8"));
    } else {
        const b64 = storageArg.replace(/-/g, "+").replace(/_/g, "/");
        localStorageData = JSON.parse(Buffer.from(b64, "base64").toString());
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    const page = await browser.newPage();

    await page.goto("about:blank");

    await page.evaluateOnNewDocument((state) => {
        for (const [k, v] of Object.entries(state)) localStorage.setItem(k, v);
    }, localStorageData);

    const internalUrl = url.replace("http://invi.go", "http://10.0.0.10:5057");
    await page.goto(internalUrl, { waitUntil: "networkidle0", timeout: 20000 });

    await page.evaluate(() => {
        if (window.applyStoredSettings) window.applyStoredSettings();
    });

    await new Promise((r) => setTimeout(r, 500));

    await page.pdf({
        path: output,
        format: "A4",
        printBackground: true,
        margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
    });

    await browser.close();
})();

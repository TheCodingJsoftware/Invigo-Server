const express = require("express");
const puppeteer = require("puppeteer");
const { URL } = require("url");

const app = express();
app.use(express.json({ limit: "5mb" }));

async function applyLocalStorage(page, targetUrl, storage) {
    if (!storage || typeof storage !== "object") {
        throw new Error("localStorage payload missing or invalid");
    }

    const u = new URL(targetUrl);
    const origin = `${u.protocol}//${u.host}`;

    // Load correct origin
    await page.goto(origin, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
    });

    // Apply storage on THAT origin
    await page.evaluate((state) => {
        localStorage.clear();
        for (const [k, v] of Object.entries(state)) {
            localStorage.setItem(k, String(v));
        }
    }, storage);
}

async function render({ url, localStorage, mode }) {
    if (!url) throw new Error("Missing url");

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
        ],
    });

    try {
        const page = await browser.newPage();

        await page.setViewport({
            width: 1400,
            height: 900,
            deviceScaleFactor: 2,
        });

        // Apply storage correctly
        await applyLocalStorage(page, url, localStorage);

        // Load real page
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
        });

        // Force app to boot WITH storage
        await page.reload({
            waitUntil: "networkidle0",
            timeout: 60000,
        });

        // Optional hook
        await page.evaluate(() => {
            if (window.applyStoredSettings) window.applyStoredSettings();
        });

        if (mode === "png") {
            await page.emulateMediaType("screen");
            await page.emulateMediaType("print");
            return await page.screenshot({
                type: "png",
                fullPage: true,
                printBackground: true,
                preferCSSPageSize: true,
            });
        }

        await page.emulateMediaType("print");
        return await page.pdf({
            printBackground: true,
            preferCSSPageSize: true,
        });
    } finally {
        await browser.close();
    }
}

app.post("/pdf", async (req, res) => {
    const raw = await render({
        url: req.body.url,
        localStorage: req.body.localStorage,
        mode: "pdf",
    });

    // FORCE Node Buffer
    const buf = Buffer.isBuffer(raw)
        ? raw
        : Buffer.from(raw);

    // SAFE check
    if (buf.slice(0, 5).toString("ascii") !== "%PDF-") {
        throw new Error(
            "Not a PDF. First 32 bytes: " + buf.slice(0, 32).toString("hex")
        );
    }

    res.status(200)
        .set("Content-Type", "application/pdf")
        .set("Content-Disposition", 'inline; filename="output.pdf"')
        .send(buf);

});
app.post("/png", async (req, res) => {
    try {
        const buf = await render({
            url: req.body.url,
            localStorage: req.body.localStorage,
            mode: "png",
        });

        res.status(200)
            .set("Content-Type", "image/png")
            .set("Content-Disposition", 'inline; filename="output.png"')
            .send(buf);
    } catch (e) {
        console.error(e);
        res.status(500).type("text/plain").send(String(e.stack || e));
    }
});

app.listen(3000, "0.0.0.0", () => {
    console.log("puppeteer renderer listening on :3000");
});

import { DialogComponent } from "@components/common/dialog/dialog-component";
import { PurchaseOrder } from "@models/purchase-order";

let Editor: typeof import('@toast-ui/editor').Editor;
let Viewer: typeof import('@toast-ui/editor/dist/toastui-editor-viewer').default;

function loadToastUICSS(): Promise<void> {
    const cssUrls = [
        "https://cdn.jsdelivr.net/npm/@toast-ui/editor/dist/toastui-editor.css",
        "https://cdn.jsdelivr.net/npm/@toast-ui/editor/dist/theme/toastui-editor-dark.css",
    ];

    return Promise.all(cssUrls.map(href => {
        return new Promise<void>((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.onload = () => resolve();
            link.onerror = () => reject(`Failed to load: ${href}`);
            document.head.appendChild(link);
        });
    })).then(() => {
    });
}

async function loadEditorModules() {
    const editorModule = await import('@toast-ui/editor');
    const viewerModule = await import('@toast-ui/editor/dist/toastui-editor-viewer');
    Editor = editorModule.Editor;
    Viewer = viewerModule.default;
}

export class EmailDialogComponent extends DialogComponent {
    editor!: InstanceType<typeof Editor>;
    purchaseOrder: PurchaseOrder;

    constructor(purchaseOrder: PurchaseOrder) {
        super({
            id: "email-dialog",
            title: purchaseOrder.getName(),
            bodyContent: `
                <div class="padding">
                    <div class="s12 field label border small-round">
                        <input type="email" id="email-from" value="${purchaseOrder.meta_data.contact_info.name} (${purchaseOrder.meta_data.contact_info.email})" disabled>
                        <label for="email-from">From</label>
                    </div>
                    <div class="s12 field label border small-round">
                        <input type="email" id="email-to" value="${purchaseOrder.meta_data.vendor.email}" required>
                        <label for="email-to">To</label>
                        <output>${purchaseOrder.meta_data.vendor.name}</span>
                    </div>
                    <div class="s12 field label border small-round">
                        <input type="email" id="email-cc">
                        <label>CC (Optional)</label>
                    </div>
                    <div class="s12 field label border small-round">
                        <input type="text" id="email-subject" value="PO ${purchaseOrder.meta_data.purchase_order_number} from ${purchaseOrder.meta_data.business_info.name}">
                        <label>Subject</label>
                    </div>
                    <div class="s12 border no-round">
                        <div id="email-body" style="z-index: 0;"></div>
                    </div>
                </div>
            `,
            footerContent: `
                    <nav class="s12 row top-margin right-align">
                        <p class="italic max">This printout is automatically attached as a PDF.</p>
                        <button type="button" id="email-send">
                            <i>send</i>
                            <span>Send</span>
                        </button>
                    </nav>`
        });
        this.purchaseOrder = purchaseOrder;

        this.init();
    }

    async init() {
        try {
            await Promise.all([
                loadToastUICSS(),
                loadEditorModules(),
            ]);

            // ui("mode") can return auto, this is why we check.
            const editorTheme = ui("mode") === "dark" ? "dark" : "light";

            this.editor = new Editor({
                el: this.query("#email-body") as HTMLElement,
                previewStyle: "vertical",
                height: "500px",
                initialEditType: "wysiwyg",
                initialValue: localStorage.getItem("email-body") || "",
                usageStatistics: false,
                theme: editorTheme,
            });

            this.editor.on("change", () => {
                localStorage.setItem("email-body", this.editor.getMarkdown());
            });

            this.query("#email-send")?.addEventListener("click", async () => {
                const to = (this.query<HTMLInputElement>("#email-to")?.value || "").trim();
                const cc = (this.query<HTMLInputElement>("#email-cc")?.value || "").trim();
                const subject = (this.query<HTMLInputElement>("#email-subject")?.value || "").trim();
                const body = this.editor.getHTML();

                if (!to || !subject || !body) {
                    ui("#email-missing-fields", 1500);
                    return;
                }

                ui("#sending-email", 1500);

                const storageObj: Record<string, string> = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) storageObj[key] = localStorage.getItem(key)!;
                }

                const pageUrl = location.href;

                const res = await fetch("/api/email-purchase-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to, cc, subject, body, pageUrl,
                        localStorage: storageObj,
                        senderEmail: this.purchaseOrder.meta_data.contact_info.email,
                        encryptedPassword: this.purchaseOrder.meta_data.contact_info.password,
                    }),
                });

                if (!res.ok) {
                    ui("#email-send-failed", 2000);
                    return;
                }

                await fetch(`/api/email-sent/${this.purchaseOrder.id}`, {
                    method: "POST",
                });

                ui("#email-sent", 2000);
                this.close();
            });

        } catch (err) {
            console.error("Failed to initialize EmailDialogComponent:", err);
            ui("#email-init-failed", 2000);
        }
    }
}

import { DueButton } from "@components/common/buttons/due-button";
import { PartData } from "./part-container";
import { PartRow } from "./part-row";
import { SnackbarComponent } from "@components/common/snackbar/snackbar-component";
import { InfoDialog } from "@components/common/dialog/info-dialog";
import { applyScopedBeerTheme } from "@config/material-theme-cookie";
import { CurrentProcessButton } from "@components/common/buttons/current-process-button";


export function parsePgTimestamp(input: string | Date): Date | null {
    if (input instanceof Date) return input;

    if (typeof input !== "string") return null;

    // Normalize PostgreSQL timestamp → ISO 8601
    // 2025-12-16 00:19:58.643081+00
    // → 2025-12-16T00:19:58.643+00:00
    const normalized = input
        .replace(" ", "T")
        .replace(/(\.\d{3})\d+/, "$1") // trim microseconds → milliseconds
        .replace(/\+(\d{2})$/, "+$1:00");

    const date = new Date(normalized);
    return isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(input: string | Date): string {
    const date = parsePgTimestamp(input);
    if (!date) return "unknown";

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;

    const years = Math.floor(days / 365);
    return `${years} year${years !== 1 ? "s" : ""} ago`;
}

export function bindLiveRelativeTime(
    el: HTMLElement,
    timestamp: string | Date
): () => void {
    const update = () => {
        el.textContent = formatDateAndRelative(timestamp);
    };

    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
}

export function formatDateAndRelative(input: string | Date): string {
    const date = parsePgTimestamp(input);
    if (!date) return "Last modified: unknown";

    const absolute = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

    const relative = formatRelativeTime(date);

    return `Last modified: ${absolute} (${relative})`;
}

export function buildFlowtagNav(
    flowtags: string[],
    currentIndex: number
): HTMLElement {
    const nav = document.createElement("nav");
    nav.className = "row align-center";

    flowtags.forEach((tag, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "center-align";

        const button = document.createElement("button");
        button.className = "circle";

        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.textContent = tag;

        if (index < currentIndex) {
            // completed
            button.innerHTML = "<i>check_circle</i>";
            tooltip.textContent = `${tag} (completed)`;
        } else if (index === currentIndex) {
            // current
            button.innerHTML = `<div class="shape loading-indicator max medium-space"></div>`;
            button.classList.add("fill", "extra");
            tooltip.textContent = `${tag} (current)`;
        } else {
            // future
            button.innerHTML = "<i>circle</i>";
            button.classList.add("fill");
            button.disabled = true;
            tooltip.textContent = `${tag} (future)`;
        }

        button.appendChild(tooltip);

        const label = document.createElement("div");
        label.className = "small-margin";
        label.textContent = tag;

        wrapper.append(button, label);
        nav.appendChild(wrapper);

        // divider (not after last)
        if (index < flowtags.length - 1) {
            const hr = document.createElement("hr");
            hr.className = "max";
            nav.appendChild(hr);
        }
    });

    return nav;
}

export class PartElement {
    readonly element: HTMLElement;
    part: PartData;

    constructor(part: PartData) {
        this.part = part;

        this.element = document.createElement("article");
        this.element.classList.add("round", "border", "no-padding");
        this.element.setAttribute("data-part-id", String(this.part.name));

        this.build();
    }

    private build(): void {
        /* ---------- IMAGE COLUMN ---------- */
        const img = document.createElement("img");
        img.className = "responsive left-round medium-height medium-width";
        img.loading = "lazy";
        img.width = 48;
        img.height = 48;
        img.src = `/images/${this.part.name}`;
        img.alt = this.part.name;

        const imageCol = document.createElement("div");
        imageCol.className = "s12 m5 l4";
        imageCol.appendChild(img);

        /* ---------- CONTENT COLUMN ---------- */
        const content = document.createElement("div");
        content.className = "padding";

        const title = document.createElement("h6");
        title.textContent = this.part.name;

        const subtitle = document.createElement("div");
        subtitle.className = "small";
        subtitle.textContent = `${this.part.meta_data.gauge} ${this.part.meta_data.material}`;

        const lastModified = new Date(this.part.meta_data.modified_date);
        const modifiedString = lastModified.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });

        const modifiedInfo = document.createElement("div");
        modifiedInfo.className = "tiny-text light-text";

        const stopLiveUpdate = bindLiveRelativeTime(
            modifiedInfo,
            this.part.modified_at
        );

        this.element.addEventListener("DOMNodeRemoved", () => {
            stopLiveUpdate();
        });

        const files = PartRow.createFiles(this.part);
        const filesWrap = document.createElement("div");
        filesWrap.appendChild(files);

        const dueInfo = document.createElement("div");
        const processButton = new CurrentProcessButton(
            this.part.current_flowtag,
            this.part
        );
        dueInfo.appendChild(processButton.getElement());

        if (!this.part.is_completed) {
            const dueButton = new DueButton("", this.part);
            dueInfo.appendChild(dueButton.getElement());
        }

        const flowNav = buildFlowtagNav(
            this.part.flowtag,
            this.part.flowtag_index
        );

        const actionsNave = document.createElement("nav");
        actionsNave.className = "row right-align";

        const copyButton = document.createElement("button");
        copyButton.innerHTML = `<i>content_copy</i><span>Copy URL</span>`;

        copyButton.addEventListener("click", async () => {
            const partURL = `${window.location.origin}/workspace/part/${this.part.job_id}/${this.part.name}`;

            let copied = false;

            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(partURL);
                    copied = true;
                } catch {
                    copied = false;
                }
            }

            if (copied) {
                new SnackbarComponent({
                    message: "Part URL copied to clipboard!",
                    color: "green",
                    icon: "content_copy",
                    duration: 1000
                });
                return;
            }

            // Clipboard failed → manual copy dialog
            const dialog = new InfoDialog(
                "Copy Part URL",
                `<p>
                    Automatic copying is not available in this browser.
                    Please copy the URL below manually:
                </p>
                <div class="field label border small-round">
                    <input
                        id="manual-copy-input"
                        type="text"
                        value="${partURL}"
                        readonly/>
                <label>URL</label>
                </div>
            `);

            applyScopedBeerTheme(dialog.element, this.part.job_data.job_data.color, `info-dialog`);
            // Auto-select text when dialog is shown
            setTimeout(() => {
                const input = dialog.element.querySelector<HTMLInputElement>(
                    "#manual-copy-input"
                );
                input?.focus();
                input?.select();
            }, 200);
            await dialog.show();
        });


        actionsNave.appendChild(copyButton);

        content.append(
            title,
            subtitle,
            modifiedInfo,
            filesWrap,
            dueInfo,
            flowNav,
            actionsNave
        );

        const contentCol = document.createElement("div");
        contentCol.className = "s12 m7 l8";
        contentCol.appendChild(content);

        /* ---------- GRID ---------- */
        const grid = document.createElement("div");
        grid.className = "grid no-space";
        grid.append(imageCol, contentCol);

        /* ---------- ARTICLE ---------- */
        this.element.appendChild(grid);
    }

}
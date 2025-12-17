import "beercss"
import '@static/css/style.css';
import "material-dynamic-colors";
import { invertImages, loadAnimationStyleSheet, loadTheme } from "@utils/theme"
import { Workorder } from "@models/workorder";
import { WorkorderData } from "@interfaces/workorder";
import { Nest } from "@models/nest";
import { AreYouSureDialog } from "@components/common/dialog/are-you-sure-dialog";
import { SnackbarComponent } from "@components/common/snackbar/snackbar-component";
import { InfoDialog } from "@components/common/dialog/info-dialog";
import { LaserCutPart } from "@models/laser-cut-part";
import { DialogComponent } from "@components/common/dialog/dialog-component";

const naturalCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base"
});

function getWorkorderIDFromUrl(): number {
    const id = new URL(window.location.href).searchParams.get("id");
    return id ? parseInt(id, 10) : -1;
}

class PartButton {
    readonly button: HTMLButtonElement;

    constructor(private readonly part: LaserCutPart) {
        this.button = document.createElement("button");
        this.button.className =
            "part-button extra border small-round blur left-align tiny-margin";

        this.button.addEventListener("click", () => this.openPreview());
        this.build();
    }

    private build(): void {
        const img = document.createElement("img");
        img.className = "responsive";
        img.loading = "lazy";
        img.width = 48;
        img.height = 48;
        img.src = `/images/${this.part.name}`;
        img.alt = this.part.name;

        const name = document.createElement("span");
        name.textContent = this.part.name;

        const helper = document.createElement("span");
        helper.className = "row small-text";
        helper.textContent = `#${this.part.meta_data.part_number}`;

        name.appendChild(helper);
        this.button.append(img, name);
    }

    private openPreview(): void {
        new DialogComponent({
            title: this.part.name,
            bodyContent: `<img class="responsive small-round" src="/images/${this.part.name}" />`,
        });
        invertImages();
    }
}


class NestContainer {
    readonly container: HTMLDivElement;
    private readonly partsContainer: HTMLDivElement;

    constructor(private readonly nest: Nest) {
        this.container = document.createElement("div");
        this.container.classList.add("nest-container", "s12", "m6", "l6");

        this.partsContainer = document.createElement("div");
        this.partsContainer.className = "parts-container";

        this.build();
        this.renderParts();
    }

    private build(): void {
        const article = document.createElement("article");
        article.className = "round border no-padding";

        const header = document.createElement("div");
        header.className = "absolute top left right padding top-round small-blur";

        const nav = document.createElement("nav");
        nav.className = "vertical no-space";

        const title = document.createElement("span");
        title.className = "bold large-text";
        title.textContent = this.nest.name;

        const desc = document.createElement("span");
        desc.textContent =
            `${this.nest.sheet.width}in x ${this.nest.sheet.length}in - ` +
            `${this.nest.sheet.thickness} ${this.nest.sheet.material} - ` +
            `${this.nest.sheet_count} sheets`;

        nav.append(title, desc);
        header.appendChild(nav);

        const img = document.createElement("img");
        img.className = "responsive top-round top-margin top-padding";
        img.src = `/images/${this.nest.image_path}`;
        img.alt = this.nest.name;

        const content = document.createElement("div");
        content.className = "padding";
        content.appendChild(this.partsContainer);

        article.append(img, header, content);
        this.container.appendChild(article);
    }

    private renderParts(): void {
        const sortedParts = [...this.nest.laser_cut_parts].sort((a, b) =>
            naturalCollator.compare(a.name, b.name)
        );

        for (const part of sortedParts) {
            this.partsContainer.appendChild(new PartButton(part).button);
        }
    }
}

class WorkorderUpdatePage {
    private dataPromise: Promise<WorkorderData> | null = null;
    private workorder!: Workorder;

    constructor(
        private readonly workorderId: number,
        private readonly container: HTMLDivElement
    ) { }

    async initialize(): Promise<void> {
        try {
            const data = await this.getData();
            this.workorder = new Workorder(data);

            for (const nest of this.workorder.nests) {
                this.container.appendChild(new NestContainer(nest).container);
            }
        } catch (err) {
            console.error(err);
            new SnackbarComponent({
                message: String(err),
                type: "error",
                duration: 5000
            });
        } finally {
            this.toggleLoading(false);
            invertImages();
        }
    }

    private toggleLoading(show: boolean): void {
        document
            .getElementById("loading-indicator")
            ?.classList.toggle("hidden", !show);
    }

    private getData(): Promise<WorkorderData> {
        if (!this.dataPromise) {
            this.dataPromise = this.loadData();
        }
        return this.dataPromise;
    }

    private async loadData(): Promise<WorkorderData> {
        const res = await fetch(`/workorders/get/${this.workorderId}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    loadAnimationStyleSheet();

    const workorderId = getWorkorderIDFromUrl();

    document.title = `Workorder #${workorderId}`;
    document.querySelector("#workorder-header")!.textContent = `Workorder #${workorderId}`;

    const container = document.getElementById("workorder-container") as HTMLDivElement;

    new WorkorderUpdatePage(workorderId, container).initialize();


    document.querySelector("#done-all-button")?.addEventListener("click", async () => {
        const confirmed = await new AreYouSureDialog(
            "Are you sure?",
            "Mark all parts in this workorder as complete?"
        ).show();

        if (!confirmed) return;

        const res = await fetch(
            `/api/workorder/mark_complete/${workorderId}`,
            { method: "POST" }
        );

        if (!res.ok) throw new Error(await res.text());

        new InfoDialog(
            "Workorder Updated",
            `Workorder #${workorderId} marked as complete. You may now close this tab.`,
        ).show();
    });
});

import "beercss"
import "@static/css/printout.css"
import "material-dynamic-colors";
import { NestedParts } from "@components/nested-parts";
import { NestedPartsSummary } from "@components/nested-parts-summary";
import { NestedSheets } from "@components/nested-sheets";
import { NestedSheetsSummary } from "@components/nested-sheets-summary";
import { PageBreak } from "@components/page-break";
import { QRCodeComponent } from "@components/qr-code-component";
import { BaseComponent } from "@interfaces/base-component";
import { WorkorderData } from "@interfaces/workorder";
import { Workorder } from "@models/workorder";
import { loadAnimationStyleSheet, toggleTheme, loadTheme, invertImages } from "@utils/theme"
import { Effect } from "effect"
import { createSwapy } from 'swapy'

class WorkorderPrintout {
    workorderID: number;
    private _dataEffect: Effect.Effect<any, Error> | null = null;
    public workorder!: Workorder;
    public container: HTMLDivElement;
    private swapy: ReturnType<typeof createSwapy> | null = null;

    constructor(workorderID: number) {
        this.workorderID = workorderID;
        this.container = document.getElementById('workorder-container') as HTMLDivElement;
    }

    private loadDataEffect(): Effect.Effect<WorkorderData, Error> {
        return Effect.promise(async () => {
            const response = await fetch(`/workorders/get/${this.workorderID}`);
            if (!response.ok) {
                const msg = await response.text();
                throw new Error(`Failed to fetch workorder data: ${msg}`);
            }
            return response.json();
        });
    }

    public getDataEffect(): Effect.Effect<any, Error> {
        if (!this._dataEffect) {
            this._dataEffect = this.loadDataEffect();
        }
        return this._dataEffect;
    }

    public initialize(): Effect.Effect<void, Error> {
        return this.getDataEffect().pipe(
            Effect.map((data) => {
                this.workorder = new Workorder(data);

                this.setUpSections();
                this.setupCheckboxes();
                this.handleBrokenImages();
                this.registerAllExpandableArticles();
                this.registerAllTableCheckboxes();
                this.initSwapy();

                invertImages();

                this.toggleLoadingIndicator(false);
            }),
        );
    }

    private initSwapy(): void {
        this.swapy = createSwapy(this.container, {
            animation: 'spring',
            autoScrollOnDrag: true,
            swapMode: 'drop',
        });
        this.swapy.enable(true);
        this.swapy.onSwap((event) => {
            document.querySelectorAll("expandable-section").forEach(el => {
                (el as any).initialize();
            });
        });
    }

    updateSwapy(): void {
        if (!this.swapy) {
            return;
        }
        this.swapy.update();
    }

    private async setUpSections(): Promise<void> {
        const sections: Record<string, BaseComponent> = {
            qrCode: new QRCodeComponent(window.location.href),
            pageBreak3: new PageBreak(this.workorderID, 23),
            nestSummary: new NestedSheetsSummary(this.workorderID, this.workorder.nests),
            pageBreak4: new PageBreak(this.workorderID, 24),
            nestedPartsSummary: new NestedPartsSummary(this.workorderID, this.workorder.nests),
            pageBreak5: new PageBreak(this.workorderID, 25),
            nestedSheets: new NestedSheets(this.workorderID, this.workorder.nests),
            pageBreak6: new PageBreak(this.workorderID, 26),
            nestedParts: new NestedParts(this.workorderID, this.workorder.nests),
        };

        await Promise.all(
            Object.values(sections).map(section => section.render())
        );
        Object.entries(sections).forEach(([key, section]) => {
            const viewButton = document.getElementById(`view-${key}`) as HTMLButtonElement;
            if (!viewButton) {
                return;
            }

            const checkbox = document.getElementById(`show-${key}`) as HTMLInputElement;
            if (!checkbox) {
                return;
            }

            const saved = localStorage.getItem(`show-${key}`);
            if (saved !== null) {
                checkbox.checked = saved === "true";
            }

            checkbox.checked ? section.show() : section.hide();

            checkbox.addEventListener("change", () => {
                localStorage.setItem(`show-${key}`, String(checkbox.checked));
                checkbox.checked ? section.show() : section.hide();
            });

            viewButton.addEventListener("click", () => {
                section.element.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'nearest',
                    block: 'nearest'
                });

                // Setup observer to detect when the element is in view
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            section.element.classList.add('flash-border');

                            setTimeout(() => {
                                section.element.classList.remove('flash-border');
                            }, 1000);

                            observer.disconnect();
                        }
                    });
                }, { threshold: 0.5 });

                observer.observe(section.element);
            });
        });
    }

    toggleLoadingIndicator(show: boolean) {
        const loadingIndicator = document.getElementById("loading-indicator") as HTMLElement;
        if (show) {
            loadingIndicator.classList.remove("hidden");
        } else {
            loadingIndicator.classList.add("hidden");
        }
    }

    syncAllColumnCheckboxesById(
        sourceCheckbox: HTMLInputElement,
        toggleColumnVisibility: (visible: boolean) => void
    ) {
        const id = sourceCheckbox.id;
        const allCheckboxes = document.querySelectorAll(`input[type="checkbox"]#${id}`) as NodeListOf<HTMLInputElement>;

        allCheckboxes.forEach(checkbox => {
            if (checkbox !== sourceCheckbox) {
                checkbox.checked = sourceCheckbox.checked;
                toggleColumnVisibility(checkbox.checked);
            }
        });
    }

    toggleColumnVisibilityGlobally(column: string, visible: boolean) {
        const tables = document.querySelectorAll("table");

        tables.forEach(table => {
            const headerCells = table.querySelectorAll("thead th") as NodeListOf<HTMLElement>;

            // Build column index map for this table
            const columnIndexMap: Record<string, number> = {};
            headerCells.forEach((th, index) => {
                const col = th.dataset.column;
                if (col) {
                    columnIndexMap[col] = index;
                }
            });

            const index = columnIndexMap[column];
            if (index === undefined) {
                return;
            }

            const th = headerCells[index];
            const cells = table.querySelectorAll("tbody tr, tfoot tr") as NodeListOf<HTMLTableRowElement>;
            if (th) {
                th.classList.toggle("hidden", !visible);
            }
            cells.forEach(row => {
                const cell = row.children[index];
                if (cell) {
                    cell.classList.toggle("hidden", !visible);
                }
            });
        });
    }

    registerAllTableCheckboxes() {
        const tables = document.querySelectorAll("table");

        tables.forEach(table => {
            // const parent = table.closest("article") || document;
            const checkboxes = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
            const headerCells = table.querySelectorAll('thead th') as NodeListOf<HTMLElement>;

            if (checkboxes.length === 0 || headerCells.length === 0) {
                return;
            }

            // Build column index map for this table
            const columnIndexMap: Record<string, number> = {};
            headerCells.forEach((th, index) => {
                const col = th.dataset.column;
                if (col) {
                    columnIndexMap[col] = index;
                }
            });

            checkboxes.forEach(checkbox => {
                const column = checkbox.id.replace("show-", "");
                const index = columnIndexMap[column];
                if (index === undefined) {
                    return;
                }

                const key = `show-column-${column}`;
                const storedState = localStorage.getItem(key);
                checkbox.checked = storedState !== 'false';

                const toggleColumnVisibility = (visible: boolean) => {
                    const th = headerCells[index];
                    const cells = table.querySelectorAll('tbody tr, tfoot tr') as NodeListOf<HTMLTableRowElement>;
                    if (th) {
                        th.classList.toggle('hidden', !visible);
                    }
                    cells.forEach(row => {
                        const cell = row.children[index];
                        if (cell) {
                            cell.classList.toggle('hidden', !visible);
                        }
                    });
                };

                // Initial state
                toggleColumnVisibility(checkbox.checked);

                // On change
                checkbox.addEventListener('change', () => {
                    localStorage.setItem(key, String(checkbox.checked));
                    this.toggleColumnVisibilityGlobally(column, checkbox.checked);
                    this.syncAllColumnCheckboxesById(checkbox, toggleColumnVisibility);
                });
            });
        });
    }

    registerAllExpandableArticles() {
        const articles = document.querySelectorAll("article");

        articles.forEach(article => {
            const button = article.querySelector('button#toggle-button') as HTMLButtonElement | null;
            const wrapper = article.querySelector('.content-wrapper') as HTMLElement | null;
            const icon = button?.querySelector('i');

            if (!button || !wrapper || !icon) {
                console.warn("ExpandableSection: Missing required elements");
                return;
            }

            // Load initial state
            const storageKey = `show-${article.id}`;
            const stored = localStorage.getItem(storageKey);
            const shouldExpand = stored === null || stored === "true";

            if (shouldExpand) {
                wrapper.classList.add("expanded");
                wrapper.style.maxHeight = "none";
                icon.classList.add("rotate-180");
                icon.classList.remove("rotate-0");
            } else {
                wrapper.classList.remove("expanded");
                wrapper.style.maxHeight = "0";
                icon.classList.remove("rotate-180");
                icon.classList.add("rotate-0");
            }

            button.addEventListener("click", (e) => {
                e.preventDefault();

                const isCollapsed = !wrapper.classList.contains("expanded");
                localStorage.setItem(storageKey, String(isCollapsed));

                if (isCollapsed) {
                    wrapper.classList.add("expanded");
                    wrapper.style.maxHeight = wrapper.scrollHeight + "px";

                    icon.classList.add("rotate-180");
                    icon.classList.remove("rotate-0");

                    wrapper.addEventListener("transitionend", () => {
                        wrapper.style.maxHeight = "none"; // reset to large value after animation
                    }, { once: true });
                } else {
                    wrapper.style.maxHeight = wrapper.scrollHeight + "px"; // set current height

                    // Force reflow
                    wrapper.offsetHeight;

                    wrapper.style.maxHeight = "0";
                    wrapper.classList.remove("expanded");

                    icon.classList.remove("rotate-180");
                    icon.classList.add("rotate-0");

                    wrapper.addEventListener("transitionend", () => {
                        // Collapse finished, ensure maxHeight stays at 0
                        wrapper.style.maxHeight = "0";
                    }, { once: true });
                }
            });
        });
    }

    private setupCheckboxes(): void {
        const showGridLinesCheckbox = document.getElementById('show-gridLines') as HTMLInputElement;
        showGridLinesCheckbox.addEventListener('change', () => {
            localStorage.setItem('show-gridLines', showGridLinesCheckbox.checked.toString());
            this.toggleSlotBorders(showGridLinesCheckbox.checked);
        });
        showGridLinesCheckbox.checked = localStorage.getItem('show-gridLines') === 'true';
        this.toggleSlotBorders(showGridLinesCheckbox.checked);

        const enabledPageBreaksCheckbox = document.getElementById('enable-pageBreaks') as HTMLInputElement;
        function updatePageBreakCheckboxes() {
            const checkboxs = document.querySelectorAll('.page-break-item input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
            checkboxs.forEach(checkbox => {
                checkbox.checked = enabledPageBreaksCheckbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });
        }
        enabledPageBreaksCheckbox.addEventListener('change', () => {
            localStorage.setItem('enable-pageBreaks', enabledPageBreaksCheckbox.checked.toString());
            updatePageBreakCheckboxes();
        });
        enabledPageBreaksCheckbox.checked = localStorage.getItem('enable-pageBreaks') === 'true';
        if (enabledPageBreaksCheckbox.checked) {
            updatePageBreakCheckboxes();
        }

        const showPageBreaksCheckbox = document.getElementById('show-pageBreaks') as HTMLInputElement;
        function updateShowPageBreaksCheckbox() {
            const pageBreakItems = document.querySelectorAll('.page-break-item') as NodeListOf<HTMLElement>;
            pageBreakItems.forEach(item => {
                const article = item.querySelector('article') as HTMLElement;
                if (showPageBreaksCheckbox.checked) {
                    item.classList.remove('hidden');
                    article.classList.remove('hidden');
                } else {
                    article.classList.add('hidden');
                }
            });
        }
        showPageBreaksCheckbox.addEventListener('change', () => {
            localStorage.setItem('show-pageBreaks', showPageBreaksCheckbox.checked.toString());
            updateShowPageBreaksCheckbox();
        });
        showPageBreaksCheckbox.checked = localStorage.getItem('show-pageBreaks') === 'true';
        updateShowPageBreaksCheckbox();
    }

    private handleBrokenImages(): void {
        setTimeout(() => {
            document.querySelectorAll('img').forEach((img) => {
                img.onerror = function () {
                    this.classList.add('hidden');
                };
                if (img.src.includes('404.jpeg')) {
                    img.classList.add('hidden');
                }
                if (!img.complete || img.naturalWidth === 0) {
                    img.dispatchEvent(new Event("error"));
                }
            });
        }, 1000);
    }

    private toggleSlotBorders(enable: boolean) {
        const slots = document.querySelectorAll('.slot') as NodeListOf<HTMLElement>;
        slots.forEach(slot => {
            if (enable) {
                slot.style.border = '1px dashed var(--on-primary-container)';
                slot.style.minHeight = '60px';
                slot.style.margin = '3px';
                slot.style.padding = '3px';
            } else {
                slot.style.border = 'none';
                slot.style.minHeight = '0px';
                slot.style.margin = '0px';
                slot.style.padding = '0px';
            }
        });
    }
}

function getWorkorderIDFromUrl(): number {
    const url = new URL(window.location.href);
    const workorderId = url.searchParams.get('id');
    if (!workorderId) {
        return -1;
    }
    return parseInt(workorderId, 10);
}

document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    ui("theme", "#9ecaff");
    loadAnimationStyleSheet();

    const workorderId = getWorkorderIDFromUrl();
    const workorderPrintout = new WorkorderPrintout(workorderId);

    Effect.runPromise(workorderPrintout.initialize()).catch((err) => {
        console.error("Failed to load workorder data:", err);
        ui("#workorder-error", -1)
    }).finally(() => {
        ui("#workorder-loaded", 1000)
    });

    // const addRowButton = document.getElementById('add-row-button') as HTMLButtonElement;
    // const addPageBreakButton = document.getElementById('add-page-break-button') as HTMLButtonElement;
    const toggleThemeButton = document.getElementById('theme-toggle') as HTMLButtonElement;
    const toggleThemeIcon = toggleThemeButton.querySelector('i') as HTMLElement;
    toggleThemeIcon.innerText = ui("mode") === "dark" ? "light_mode" : "dark_mode";

    toggleThemeButton.addEventListener('click', () => {
        toggleTheme();
        invertImages();
        toggleThemeIcon.innerText = ui("mode") === "dark" ? "light_mode" : "dark_mode";
    });

    const todayDate = document.getElementById('today-date') as HTMLSpanElement;
    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-US", {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString("en-US", {
        hour: 'numeric',
        minute: '2-digit'
    });
    todayDate.innerText = `${formattedDate} at ${formattedTime}`;

    const backToTop = document.getElementById('back-to-top') as HTMLButtonElement;
    backToTop.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});

window.addEventListener('beforeprint', hidePageBreaks);
window.addEventListener('afterprint', restorePageBreaks);

function hidePageBreaks() {
    const pageBreakItems = document.querySelectorAll('.page-break-item') as NodeListOf<HTMLElement>;
    pageBreakItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox.checked) {
            item.classList.add('page-break');
        } else {
            item.classList.add('hidden');
        }
    });
}

function restorePageBreaks() {
    const showPageBreaksCheckbox = document.getElementById('show-pageBreaks') as HTMLInputElement;
    const pageBreakItems = document.querySelectorAll('.page-break-item') as NodeListOf<HTMLElement>;
    pageBreakItems.forEach(item => {
        if (showPageBreaksCheckbox.checked) {
            item.classList.remove('hidden');
        }
        item.classList.remove('page-break');
    });
}

window.onbeforeprint = function () {
    ui("mode", "light");
    invertImages();
};

window.onafterprint = function () {
    loadTheme();
    invertImages();
};
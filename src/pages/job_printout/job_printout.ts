import "beercss"
import "@static/css/printout.css"
import "material-dynamic-colors";
import { AssembliesParts } from "@components/assemblies-parts";
import { AssembliesSummary } from "@components/assemblies-summary";
import { JobDetails } from "@components/job-details";
import { NestedParts } from "@components/nested-parts";
import { NestedPartsSummary } from "@components/nested-parts-summary";
import { NestedSheets } from "@components/nested-sheets";
import { NestedSheetsSummary } from "@components/nested-sheets-summary";
import { NetWeight } from "@components/net-weight";
import { PageBreak } from "@components/page-break";
import { QRCodeComponent } from "@components/qr-code-component";
import { TotalCost } from "@components/total-cost";
import { CHECKBOX_CONFIG } from "@config/checkbox-config";
import { JOB_COLORS, JobType } from "@config/job-printout-config";
import { BaseComponent } from "@interfaces/base-component";
import { JobData } from "@interfaces/job";
import { Job } from "@models/job";
import { loadAnimationStyleSheet, toggleTheme, loadTheme, invertImages } from "@utils/theme"
import { Effect } from "effect"
import { createSwapy } from 'swapy'
import flatpickr from "flatpickr";
require("flatpickr/dist/themes/dark.css");
import { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";

class JobPrintout {
    jobID: number;
    private _dataEffect: Effect.Effect<any, Error> | null = null;
    public job!: Job;
    public container: HTMLDivElement;
    private swapy: ReturnType<typeof createSwapy> | null = null;

    constructor(jobID: number) {
        this.jobID = jobID;
        this.container = document.getElementById('job-container') as HTMLDivElement;
    }

    private loadDataEffect(): Effect.Effect<JobData, Error> {
        return Effect.promise(async () => {
            const response = await fetch(`/jobs/get_job/${this.jobID}`);
            if (!response.ok) {
                const msg = await response.text();
                throw new Error(`Failed to fetch job data: ${msg}`);
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
                this.job = new Job(data);

                this.loadJobTypeFromStorage();
                this.setUpTabs();
                this.setUpSections();
                this.setupCheckboxes();
                this.handleBrokenImages();
                this.registerAllExpandableArticles();
                this.registerAllTableCheckboxes();
                this.initSwapy();

                const dateShipped_fp = flatpickr("#date-shipped", {
                    enableTime: true,
                    dateFormat: "Y-m-d h:i K"
                }) as FlatpickrInstance;
                const dateExpected_fp = flatpickr("#date-expected", {
                    enableTime: true,
                    dateFormat: "Y-m-d h:i K"
                }) as FlatpickrInstance;

                dateShipped_fp.setDate(this.job.job_data.ship_to);
                dateExpected_fp.setDate(this.job.job_data.ending_date);

                invertImages();

                document.title = this.job.job_data.name;
                document.getElementById("job-title")!.textContent = this.job.job_data.name;
                document.getElementById("job-print-title")!.textContent = this.job.job_data.name;

                this.changeCheckboxes(this.getJobType());

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
            jobDetails: new JobDetails(this.jobID, this.job.job_data),
            pageBreak2: new PageBreak(this.jobID, 22),
            assembliesSummary: new AssembliesSummary(this.jobID, this.job),
            pageBreak3: new PageBreak(this.jobID, 23),
            nestSummary: new NestedSheetsSummary(this.jobID, this.job.nests),
            pageBreak4: new PageBreak(this.jobID, 24),
            nestedPartsSummary: new NestedPartsSummary(this.jobID, this.job.nests),
            pageBreak5: new PageBreak(this.jobID, 25),
            nestedSheets: new NestedSheets(this.jobID, this.job.nests),
            pageBreak6: new PageBreak(this.jobID, 26),
            nestedParts: new NestedParts(this.jobID, this.job.nests),
            pageBreak7: new PageBreak(this.jobID, 27),
            assembliesParts: new AssembliesParts(this.jobID, this.job),
            totalCost: new TotalCost(this.job),
            netWeight: new NetWeight(this.job),
        };

        await Promise.all(
            Object.values(sections).map(section => section.render())
        );
        if (this.job.job_data.business_info) {
            document.getElementById("business-name")!.textContent = this.job.job_data.business_info.name;
            document.getElementById("business-address")!.innerHTML = this.job.job_data.business_info.address.replace(/\n/g, "<br>");
        }

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

    private getJobType(): JobType {
        const tabs = document.getElementById('job-type-tabs') as HTMLElement;
        for (const button of Array.from(tabs.querySelectorAll('a'))) {
            if (button.classList.contains('active')) {
                return button.dataset.target as JobType;
            }
        }
        return JobType.Quote;
    }

    private setUpTabs() {
        const tabs = document.getElementById('job-type-tabs') as HTMLElement;
        const tabButtons = Array.from(tabs.querySelectorAll('a'));
        tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                tabs.querySelectorAll('a').forEach((button) => {
                    button.classList.remove('active');
                });
                button.classList.add('active');
                this.jobTypeChanged();
            });
        });

        this.changeJobPrintoutType(this.getJobType());
    }

    private loadJobTypeFromStorage() {
        const jobType = localStorage.getItem(`job-type-id-${this.jobID}`) as JobType;
        if (jobType) {
            ui("theme", JOB_COLORS[jobType]);
            this.setActiveTab(jobType);
        } else {
            ui("theme", this.job.job_data.color);
        }
    }

    setActiveTab(jobType: JobType) {
        const tabs = document.getElementById('job-type-tabs') as HTMLElement;
        const tabButtons = Array.from(tabs.querySelectorAll('a'));
        tabButtons.forEach((button) => {
            if (button.dataset.target === jobType) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    private changeCheckboxes(jobType: JobType) {
        const config = CHECKBOX_CONFIG[jobType.toLowerCase() as keyof typeof CHECKBOX_CONFIG];
        if (!config) {
            return;
        }

        const checkboxes = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;

        checkboxes.forEach(cb => {
            const id = cb.id || "";
            const name = cb.name || "";

            // Combine id and name for keyword search
            const text = `${id} ${name}`.toLowerCase();

            // Check if this checkbox relates to any key in config
            for (const key in config) {
                if (text.includes(key)) {
                    cb.checked = config[key];
                    break;
                }
            }
        });
        this.refreshAllTableColumns();
    }

    private refreshAllTableColumns() {
        const tables = document.querySelectorAll("table");
        tables.forEach(table => {
            const headerCells = table.querySelectorAll('thead th') as NodeListOf<HTMLElement>;
            const columnIndexMap: Record<string, number> = {};

            headerCells.forEach((th, index) => {
                const col = th.dataset.column;
                if (col) {
                    columnIndexMap[col] = index;
                }
            });

            const checkboxes = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;

            checkboxes.forEach(checkbox => {
                const column = checkbox.id.replace("show-", "");
                const index = columnIndexMap[column];
                if (index === undefined) {
                    return;
                }

                const visible = checkbox.checked;
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
            });
        });
    }

    private jobTypeChanged() {
        const jobType = this.getJobType();
        localStorage.setItem(`job-type-id-${this.jobID}`, jobType);
        ui("theme", JOB_COLORS[jobType]);
        this.changeCheckboxes(jobType);
        this.changeJobPrintoutType(jobType);
    }

    private changeJobPrintoutType(jobType: JobType) {
        const jobPrintoutType = document.getElementById('job-printout-type') as HTMLButtonElement;
        const businessInfo = document.getElementById('business-info') as HTMLElement;
        if (jobType === JobType.Quote) {
            jobPrintoutType.querySelector('i')!.innerText = 'request_quote';
            jobPrintoutType.querySelector('span')!.textContent = 'Quote';
            businessInfo.classList.remove('hidden');
        } else if (jobType === JobType.WorkOrder) {
            jobPrintoutType.querySelector('i')!.innerText = 'construction'
            jobPrintoutType.querySelector('span')!.textContent = 'Workorder';
            businessInfo.classList.add('hidden');
        }
        else if (jobType === JobType.PackingSlip) {
            jobPrintoutType.querySelector('i')!.innerText = 'receipt_long'
            jobPrintoutType.querySelector('span')!.textContent = 'Packing Slip';
            businessInfo.classList.remove('hidden');
        }
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

class SwapyGrid {
    private grid: HTMLDivElement;
    private slots: HTMLElement[];
    private items: HTMLElement[];

    constructor(grid: HTMLDivElement) {
        this.grid = grid;
        this.slots = Array.from(grid.querySelectorAll('[data-swapy-slot]'));
        this.items = Array.from(grid.querySelectorAll('[data-swapy-item]'));
    }

    createSlot(span: number = 12, innerHTML: string = ""): HTMLDivElement {
        const slot = document.createElement("div");
        slot.className = `s${span} slot`;
        slot.dataset.swapySpan = span.toString();
        slot.innerHTML = innerHTML;
        slot.dataset.swapySlot = (this.slots.length + 1).toString();
        this.slots.push(slot);
        this.grid.appendChild(slot);
        return slot;
    }

    removeSlot(slot: HTMLDivElement) {
        slot.remove();
        this.slots = this.slots.filter(s => s !== slot);
    }

    getSlot(slotId: number): HTMLElement | null {
        return this.slots.find(slot => slot.dataset.swapySlot === slotId.toString()) || null;
    }

    updateSlotSpan(slotId: number, newSpan: number) {
        const slot = this.getSlot(slotId);
        if (slot) {
            // Remove all s1-s12 classes
            slot.className = slot.className.replace(/\bs\d+\b/g, '');
            slot.classList.add(`s${newSpan}`, "slot");
        }
    }
    addPageBreak() {
        const slot = this.createSlot();
        const pageBreak = new PageBreak(-1, this.items.length + 1);
        const pageBreakHTML = pageBreak.build();
        this.items.push(pageBreakHTML);
        slot.appendChild(pageBreakHTML);
    }
}

function getJobIDFromUrl(): number {
    const url = new URL(window.location.href);
    const jobId = url.searchParams.get('id');
    if (!jobId) {
        return -1;
    }
    return parseInt(jobId, 10);
}

const getLocalStorageObject = (): Record<string, string> => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            obj[key] = localStorage.getItem(key)!;
        }
    }
    return obj;
};

const generateBlob = async (endpoint: string): Promise<Blob | null> => {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localStorage: getLocalStorageObject() }),
    });

    if (!res.ok) {
        return null;
    }
    return await res.blob();
};

document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    loadAnimationStyleSheet();

    const jobId = getJobIDFromUrl();
    const jobPrintout = new JobPrintout(jobId);

    // const swapyGrid = new SwapyGrid(jobPrintout.container.querySelector('.grid') as HTMLDivElement);

    Effect.runPromise(jobPrintout.initialize()).catch((err) => {
        console.error("Failed to load job data:", err);
        ui("#job-error", -1)
    }).finally(() => {
        ui("#job-loaded", 1000)
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

    const downloadBtn = document.getElementById("download-pdf") as HTMLButtonElement;
    downloadBtn.addEventListener("click", async () => {
        const blob = await generateBlob(`/api/generate-pdf?url=${encodeURIComponent(location.href)}`);
        if (!blob) {
            return ui("#pdf-generation-failed", 1000);
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "page.pdf";
        a.click();
        URL.revokeObjectURL(url);

        ui("#pdf-loaded", 1000);
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

    // addRowButton.addEventListener('click', () => {
    //     swapyGrid.createSlot();
    //     jobPrintout.updateSwapy();
    // });

    // addPageBreakButton.addEventListener('click', () => {
    //     swapyGrid.addPageBreak();
    //     jobPrintout.updateSwapy();
    // });
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
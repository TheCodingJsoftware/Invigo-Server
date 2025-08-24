import {Signal} from "@utils/signal";
import {WorkspaceFilter} from "@models/workspace-filter";

type SearchInputOptions = {
    label?: string;
    debounceMs?: number;
    resultsText?: (count: number) => string;
};

export class SearchInput {
    static readonly onChange = new Signal<{ query: string }>();
    static readonly onSearch = new Signal<{ query: string }>();

    static element: HTMLDivElement | undefined;
    private static progress: HTMLProgressElement | undefined;
    private static icon: HTMLElement | undefined;
    private static input: HTMLInputElement | undefined;
    private static labelEl: HTMLLabelElement | undefined;
    private static clearBtn: HTMLElement | undefined;
    private static helper: HTMLSpanElement | undefined;

    private static resultsText: (count: number) => string = (n) => `${n} result${n === 1 ? "" : "s"}`;
    private static debounceMs = 300;
    private static debounceId: number | null = null;
    private static resultsCount: number | null = null;
    private static initialized = false;

    private constructor() {
    }

    static init(opts: SearchInputOptions = {}): HTMLDivElement {
        if (this.initialized && this.element) {
            if (opts.label) this.setLabel(opts.label);
            if (typeof opts.debounceMs === "number") this.setDebounce(opts.debounceMs);
            if (opts.resultsText) this.resultsText = opts.resultsText;
            return this.element;
        }

        this.element = document.createElement("div");
        this.element.className = "field label prefix suffix round border absolute center";

        this.progress = document.createElement("progress");
        this.progress.className = "circle";

        this.icon = document.createElement("i");
        this.icon.textContent = "search";

        this.input = document.createElement("input");
        this.input.type = "text";
        this.input.value = WorkspaceFilter.searchQuery ?? "";

        this.labelEl = document.createElement("label");
        this.labelEl.textContent = opts.label ?? "Search";

        this.clearBtn = document.createElement("a");
        this.clearBtn.className = "circle transparent hidden";
        const closeI = document.createElement("i");
        closeI.textContent = "close";
        this.clearBtn.appendChild(closeI);

        this.helper = document.createElement("span");
        this.helper.className = "helper hidden";

        this.element.appendChild(this.icon);
        this.element.appendChild(this.input);
        this.element.appendChild(this.labelEl);
        this.element.appendChild(this.clearBtn);
        this.element.appendChild(this.helper);

        if (typeof opts.debounceMs === "number") this.debounceMs = Math.max(0, opts.debounceMs);
        if (opts.resultsText) this.resultsText = opts.resultsText;

        this.updateClearVisibility();
        this.updateHelper();
        this.bind();

        this.initialized = true;
        return this.element;
    }

    static attachTo(parent: HTMLElement, position: InsertPosition = "beforeend"): void {
        if (!this.initialized) this.init();
        parent.insertAdjacentElement(position, this.element!);
    }

    private static bind() {
        this.input!.addEventListener("input", () => this.queueEmit());
        this.input!.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this.emitImmediately();
        });
        this.clearBtn!.addEventListener("click", () => {
            if (!this.input!.value) return;
            this.input!.value = "";
            WorkspaceFilter.searchQuery = "";
            this.resultsCount = null;
            this.updateHelper();
            this.updateClearVisibility();
            this.emitImmediately();
        });
        this.input!.addEventListener("focus", () => this.updateClearVisibility());
        this.input!.addEventListener("blur", () => this.updateClearVisibility());
    }

    private static mountIndicator(showProgress: boolean) {
        const before = this.input!;
        if (showProgress) {
            if (this.icon!.parentElement === this.element) {
                this.element!.replaceChild(this.progress!, this.icon!);
            } else if (this.progress!.parentElement !== this.element) {
                this.element!.insertBefore(this.progress!, before);
            }
        } else {
            if (this.progress!.parentElement === this.element) {
                this.element!.replaceChild(this.icon!, this.progress!);
            } else if (this.icon!.parentElement !== this.element) {
                this.element!.insertBefore(this.icon!, before);
            }
        }
    }

    private static queueEmit() {
        this.updateClearVisibility();
        this.updateHelper();
        if (this.debounceId !== null) clearTimeout(this.debounceId);
        this.setLoading(true);
        this.debounceId = window.setTimeout(() => {
            this.debounceId = null;
            WorkspaceFilter.searchQuery = this.query;
            this.onChange.emit({query: this.query});
        }, this.debounceMs);
    }

    private static emitImmediately() {
        if (this.debounceId !== null) {
            clearTimeout(this.debounceId);
            this.debounceId = null;
        }
        this.setLoading(true);
        const q = this.query;
        WorkspaceFilter.searchQuery = q;
        this.onChange.emit({query: q});
        this.onSearch.emit({query: q});
    }

    private static updateHelper() {
        if (!this.input!.value.trim() || this.resultsCount === null) {
            this.helper!.classList.add("hidden");
            return;
        }
        this.helper!.textContent = this.resultsText(this.resultsCount);
        this.helper!.classList.remove("hidden");
    }

    private static updateClearVisibility() {
        if (this.input!.value) this.clearBtn!.classList.remove("hidden");
        else this.clearBtn!.classList.add("hidden");
    }

    static setLoading(loading: boolean) {
        this.mountIndicator(loading);
    }

    static setResultsCount(count: number | null) {
        this.resultsCount = count;
        this.setLoading(false);
        this.updateHelper();
    }

    static get query(): string {
        return this.input?.value ?? "";
    }

    static set query(value: string) {
        if (!this.initialized) this.init();
        this.input!.value = value ?? "";
        WorkspaceFilter.searchQuery = this.input!.value;
        this.updateClearVisibility();
        this.updateHelper();
    }

    static focus() {
        if (!this.initialized) this.init();
        this.input!.focus();
        this.input!.select?.();
    }

    static setLabel(text: string) {
        if (!this.initialized) this.init();
        this.labelEl!.textContent = text;
    }

    static setDebounce(ms: number) {
        this.debounceMs = Math.max(0, ms | 0);
    }
}

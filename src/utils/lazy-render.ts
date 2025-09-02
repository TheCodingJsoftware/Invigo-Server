export type LazyLoadLoader = (el: Element) => void;

export class LazyLoad {
    private io: IntersectionObserver | null;
    private once: boolean;
    private loader: LazyLoadLoader;

    constructor(
        targets: Element | Element[] | NodeListOf<Element> | string,
        loader?: LazyLoadLoader,
        options?: IntersectionObserverInit & { once?: boolean }
    ) {
        this.once = options?.once ?? true;
        this.loader = loader ?? this.defaultLoader;
        this.io = typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver(this.onIntersect, options)
            : null;
        this.addAll(targets);
        if (!this.io) this.loadAll(targets);
    }

    observe(target: Element) {
        if (this.io) this.io.observe(target);
        else this.loader(target);
    }

    unobserve(target: Element) {
        if (this.io) this.io.unobserve(target);
    }

    destroy() {
        if (this.io) this.io.disconnect();
        this.io = null;
    }

    private addAll(targets: Element | Element[] | NodeListOf<Element> | string) {
        this.each(targets, el => this.observe(el));
    }

    private loadAll(targets: Element | Element[] | NodeListOf<Element> | string) {
        this.each(targets, el => this.loader(el));
    }

    private each(
        targets: Element | Element[] | NodeListOf<Element> | ArrayLike<Element> | string,
        fn: (el: Element) => void
    ) {
        if (typeof targets === "string") {
            document.querySelectorAll(targets).forEach(fn);
        } else if (targets instanceof Element) {
            fn(targets);
        } else {
            Array.prototype.forEach.call(targets as ArrayLike<Element>, fn);
        }
    }

    private onIntersect = (entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target;
            this.loader(el);
            if (this.once) this.unobserve(el);
        }
    };

    private defaultLoader = (el: Element) => {
        const he = el as HTMLElement;
        const ds = (el as any).dataset || {};
        if (el instanceof HTMLImageElement) {
            if (ds.llSrc) el.src = ds.llSrc;
            if (ds.llSrcset) el.srcset = ds.llSrcset;
            if (ds.llSizes) el.sizes = ds.llSizes;
        } else if (el instanceof HTMLIFrameElement) {
            if (ds.llSrc) el.src = ds.llSrc;
        } else if (el instanceof HTMLVideoElement) {
            if (ds.llSrc) {
                const s = document.createElement("source");
                s.src = ds.llSrc;
                el.appendChild(s);
                el.load();
            }
        } else {
            if (ds.llBg) he.style.backgroundImage = `url("${ds.llBg}")`;
            if (ds.llHtml) he.innerHTML = ds.llHtml;
            if (ds.llClass) he.classList.add(...ds.llClass.split(/\s+/).filter(Boolean));
            if (ds.llSrc) el.setAttribute("src", ds.llSrc);
        }
        el.setAttribute("data-ll-loaded", "");
        delete (ds as any).llSrc;
        delete (ds as any).llSrcset;
        delete (ds as any).llSizes;
        delete (ds as any).llBg;
        delete (ds as any).llHtml;
        delete (ds as any).llClass;
    };
}

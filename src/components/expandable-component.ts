export class ExpandableComponent extends HTMLElement {
    connectedCallback(){
        this.initialize();
    }

    initialize() {
        if (![...this.children].some(el => el.tagName.toLowerCase() === "article")) {
            const wrapper = document.createElement("article");
            wrapper.className = "border round page-break-inside";
            wrapper.innerHTML = this.innerHTML;
            this.innerHTML = "";
            this.appendChild(wrapper);
        }
    }

    public hide(): void {
        this.classList.add("hidden");
    }

    public show(): void {
        this.classList.remove("hidden");
    }

    render(): Promise<void> {
        return Promise.resolve();
    }
}

customElements.define('expandable-section', ExpandableComponent);

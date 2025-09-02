export class SelectionModel<K> {
    private baseline = false;                 // false = nothing selected by default; true = everything selected
    private overrides = new Map<K, boolean>(); // key -> explicit selection different from baseline
    private keys: K[] = [];

    setKeys(keys: K[]) {
        this.keys = keys;
        // prune overrides for keys not present
        const keySet = new Set(keys);
        for (const k of [...this.overrides.keys()]) if (!keySet.has(k)) this.overrides.delete(k);
    }

    isSelected(key: K): boolean {
        return this.overrides.has(key) ? this.overrides.get(key)! : this.baseline;
    }

    setSelected(key: K, selected: boolean) {
        if (selected === this.baseline) this.overrides.delete(key);
        else this.overrides.set(key, selected);
    }

    toggle(key: K) {
        this.setSelected(key, !this.isSelected(key));
    }

    selectAll(flag: boolean) {
        this.baseline = flag;
        this.overrides.clear(); // compact
    }

    clear() {
        this.selectAll(false);
    }

    counts() {
        const total = this.keys.length;
        if (!this.baseline) {
            // only overrides set to true count
            let sel = 0;
            for (const v of this.overrides.values()) if (v) sel++;
            return {total, selected: sel};
        } else {
            // all selected except overrides false
            let un = 0;
            for (const v of this.overrides.values()) if (!v) un++;
            return {total, selected: total - un};
        }
    }

    // For newly mounted rows to sync:
    forEachVisible(keys: K[], fn: (key: K, selected: boolean) => void) {
        for (const k of keys) fn(k, this.isSelected(k));
    }
}

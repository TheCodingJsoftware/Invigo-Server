import "beercss";
import "@utils/theme";
import { InventoryType, SearchInventory, SearchItem } from "@components/way_back_machine/search-inventory";
import { HistoryChart } from "@components/way_back_machine/history-chart";
import { SnackbarComponent } from "@components/common/snackbar/snackbar-component";

const search = new SearchInventory(document.getElementById("search-mount")!);
const chart = new HistoryChart(document.getElementById("history-chart")!);

function setURLParams(item: SearchItem | null) {
    const params = new URLSearchParams();

    if (search.launcherInput.value.trim()) {
        params.set("q", search.launcherInput.value.trim());
    }

    if (item) {
        params.set("type", item.type);
        params.set("id", String(item.id));
    }
    history.pushState(null, "", `${window.location.pathname}?${params.toString()}`);

    // history.replaceState(
    //     null,
    //     "",
    //     `${window.location.pathname}?${params.toString()}`
    // );
}

async function restoreFromURL(items: SearchItem[]) {
    const params = new URLSearchParams(window.location.search);

    const q = params.get("q") ?? "";
    const type = params.get("type") as InventoryType | null;
    const id = params.get("id");

    // Restore input text
    if (q) {
        search.setSearchQuery(q);
    }

    // Nothing selected → stop here
    if (!type || !id) return;

    const match = items.find(
        i => i.type === type && String(i.id) === id
    );

    if (!match) {
        new SnackbarComponent({
            message: "URL item not found in inventory",
            type: "error",
            duration: 5000,
        });
        console.warn("URL item not found in inventory", { type, id });
        return;
    }

    const data = await chart.fetchHistory(match);
    chart.renderChart(data);
}

window.addEventListener("popstate", () => {
    restoreFromURL(search.items);
});

document.addEventListener("DOMContentLoaded", async () => {
    search.addEventListener("select", async (e: Event) => {
        const item = (e as CustomEvent<SearchItem>).detail;
        const data = await chart.fetchHistory(item);
        chart.renderChart(data);
        setURLParams(item);
    });
    await search.init();

    await restoreFromURL(search.items);
});

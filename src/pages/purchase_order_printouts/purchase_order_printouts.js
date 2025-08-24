import "beercss"
import "@utils/theme"
import {getMetadata} from "@utils/get-metadata";

document.addEventListener("DOMContentLoaded", async () => {
    const purchaseOrderTabs = Array.from(document.querySelectorAll('.tabs a'));

    purchaseOrderTabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            localStorage.setItem("saved-purchase-order-tab", tab.dataset.ui);
        });
    });

    const savedTab = localStorage.getItem("saved-purchase-order-tab");

    if (savedTab) {
        purchaseOrderTabs.forEach(tab => {
            tab.classList.remove("active");
            if (tab.dataset.ui === savedTab) {
                tab.classList.add("active");
            }
        });
    }

    const websiteElements = Array.from(document.querySelectorAll('[data-website]'));
    const websites = websiteElements.map(el => el.getAttribute("data-website"));

    // Fetch all metadata in parallel
    const names = await Promise.all(websites.map(getMetadata));

    // Update the DOM after all metadata is ready
    websiteElements.forEach((el, idx) => {
        el.innerHTML = names[idx];
    });
});

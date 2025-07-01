import "beercss"
import "@utils/theme"
// import { Effect } from "effect"

// document.addEventListener("DOMContentLoaded", function () {
//     document.body.classList.add("hidden");
//     const containers = {
//         components: document.getElementById("components-inventory-container"),
//         laser: document.getElementById("laser-cut-parts-inventory-container"),
//         sheets: document.getElementById("sheets-inventory-container"),
//         coatings: document.getElementById("coatings-inventory-container"),
//     }

//     const fetchFromServer = (url: string): Effect.Effect<string[], Error> =>
//         Effect.promise(() =>
//             fetch(url).then(async (res) => {
//                 if (!res.ok) {
//                     const errorText = await res.text()
//                     throw new Error(`Fetch failed: ${res.status} ${errorText}`)
//                 }
//                 return res.json()
//             })
//         )

//     const createButtons = (categories: string[], container: HTMLElement | null, baseUrl: string) => {
//         if (!container) return
//         container.innerHTML = "" // Clear existing

//         for (const category of categories) {
//             const btn = document.createElement("button")
//             btn.className = "chip fill tiny-margin"
//             btn.textContent = category
//             btn.onclick = () => {
//                 window.location.href = `${baseUrl}?category=${encodeURIComponent(category)}`
//             }
//             container.appendChild(btn)
//         }
//     }

//     const program = Effect.gen(function* () {
//         const components = yield* fetchFromServer("/components_inventory/get_categories")
//         const laserParts = yield* fetchFromServer("/laser_cut_parts_inventory/get_categories")
//         const sheets = yield* fetchFromServer("/sheets_inventory/get_categories")
//         const coatings = yield* fetchFromServer("/coatings_inventory/get_categories")

//         return { components, laserParts, sheets, coatings }
//     })

//     Effect.runPromise(program)
//         .then(({ components, laserParts, sheets, coatings }) => {
//             createButtons(components, containers.components, "/components_inventory/view")
//             createButtons(laserParts, containers.laser, "/laser_cut_part_inventory/view")
//             createButtons(sheets, containers.sheets, "/sheets_inventory/view")
//             createButtons(coatings, containers.coatings, "/coatings_inventory/view")
//         })
//         .catch((error) => {
//             console.error("Failed to load categories:", error)
//         }).finally(() => {
//             document.body.classList.remove("hidden");
//         });
// })

import "beercss"
import "@utils/theme"
import {Chart, registerables} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

function goToMainUrl() {
    window.location.href = "/";
}

async function loadData() {
    try {
        const response = await fetch('/way_back_machine_get_data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to load workspace:', error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    const searchInput = document.getElementById('searchInput');
    const fetchButton = document.getElementById('fetchButton');
    const autocompleteContainer = document.getElementById('autocomplete-container');
    const radioButtons = document.querySelectorAll('input[name="inventory"]');

    let myChart = null;

    const inventoryData = await loadData();

    searchInput.addEventListener('input', function () {
        const query = searchInput.value.toLowerCase();
        const selectedInventory = document.querySelector('input[name="inventory"]:checked').value;
        const suggestions = getSuggestions(query, inventoryData[selectedInventory]);
        displaySuggestions(suggestions);
    });

    fetchButton.addEventListener('click', function () {
        const selectedInventory = document.querySelector('input[name="inventory"]:checked').value;
        const selectedItem = searchInput.value;
        updateUrl(selectedInventory, selectedItem);
        fetchData(selectedInventory, selectedItem);
    });

    radioButtons.forEach(radio => {
        radio.addEventListener('change', function () {
            const selectedInventory = document.querySelector(
                'input[name="inventory"]:checked').value;
            searchInput.value = "";
            const selectedItem = searchInput.value;
            updateUrl(selectedInventory, selectedItem);
        });
    });

    function getSuggestions(query, inventory) {
        if (!query) {
            return [];
        }
        return inventory.filter(name => name.toLowerCase().includes(query));
    }

    function displaySuggestions(suggestions) {
        autocompleteContainer.innerHTML = '';
        suggestions.forEach(suggestion => {
            const divider = document.createElement('div');
            divider.className = 'divider';
            const div = document.createElement('a');
            div.className = 'row wave';
            div.textContent = suggestion;
            div.addEventListener('click', function () {
                searchInput.value = suggestion;
                autocompleteContainer.innerHTML = '';
                const selectedInventory = document.querySelector(
                    'input[name="inventory"]:checked').value;
                updateUrl(selectedInventory, suggestion);
                fetchData(selectedInventory, suggestion);
            });
            autocompleteContainer.appendChild(div);
            autocompleteContainer.appendChild(divider);
        });
    }

    function fetchData(inventory, item) {
        fetch(`/fetch_data?inventory=${inventory}&item=${item}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                drawChart(data);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                showErrorModal();
            });
    }

    function updateUrl(inventory, item) {
        const url = new URL(window.location);
        url.searchParams.set('inventory', inventory);
        if (item) {
            url.searchParams.set('item', item);
        } else {
            url.searchParams.delete('item');
        }
        window.history.pushState({}, '', url);
    }

    function drawChart(data) {
        const ctx = document.getElementById('myChart').getContext('2d');
        if (myChart) {
            myChart.destroy();
        }
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Quantity',
                    data: data.quantities,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }, {
                    label: 'Price',
                    data: data.prices,
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function showErrorModal() {
        ui("#snackbar-error");
    }


    // Check if there are query parameters in the URL on page load and fetch data if they exist
    window.addEventListener('load', function () {
        const urlParams = new URLSearchParams(window.location.search);
        const inventory = urlParams.get('inventory') || 'components_inventory';
        const item = urlParams.get('item');

        document.querySelector(`input[name="inventory"][value="${inventory}"]`).checked = true;

        if (item) {
            searchInput.value = item;
            fetchData(inventory, item);
        } else {
            updateUrl(inventory, '');
        }
    });
});

window.goToMainUrl = goToMainUrl;
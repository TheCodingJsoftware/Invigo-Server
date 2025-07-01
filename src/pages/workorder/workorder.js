import "beercss"
import '@static/css/style.css';
import '@static/css/theme.css';

var recut_laser_cut_part;
var recut_nest;
var recut_max_quantity;

function getWorkorderNameFromUrl() {
    const url = window.location.href;
    const parts = url.split('/');
    return parts[parts.length - 1]; // Assuming the workorder name is the last part of the URL
}
function parsePythonStyleJson(pythonStyleJson) {
    // Replace single quotes with double quotes for JSON compliance
    let validJson = pythonStyleJson
        .replace(/'/g, '"') // Convert single quotes to double quotes
        .replace(/True/g, 'true') // Convert Python's True to JSON's true
        .replace(/False/g, 'false') // Convert Python's False to JSON's false
        .replace(/None/g, 'null'); // Convert Python's None to JSON's null

    // Parse the corrected JSON string
    try {
        return JSON.parse(validJson);
    } catch (error) {
        console.error("Failed to parse JSON:", error);
        return null;
    }
}

async function markWorkorderAsDone(button) {
    const workorder_data = parsePythonStyleJson(button.getAttribute('data-workorder'));
    const workorder_name = getWorkorderNameFromUrl();
    try {
        const response = await fetch(`/mark_workorder_done/${workorder_name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(workorder_data),
        });

        if (response.ok) {
            const result = await response.json();
            window.location.reload();
            console.log('Success:', result);
        } else {
            console.error('Error:', response.statusText);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function markNestAsDone(button) {
    const nest_data = parsePythonStyleJson(button.getAttribute('data-nest'));
    const workorder_name = getWorkorderNameFromUrl();
    try {
        const response = await fetch(`/mark_nest_done/${workorder_name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(nest_data),
        });

        if (response.ok) {
            const result = await response.json();
            window.location.reload();
            console.log('Success:', result);
        } else {
            console.error('Error:', response.statusText);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function validateRecutQuantity() {
    var input = document.getElementById('recut-quantity-input');
    var parentDiv = input.parentElement;

    if (input.value > recut_max_quantity) {
        parentDiv.classList.add('invalid');
        document.getElementById('recut-quantity-input-error').classList.remove("hidden")
    } else {
        parentDiv.classList.remove('invalid');
        document.getElementById('recut-quantity-input-error').classList.add("hidden")
    }
}

function openRecutDialog(button){
    const laser_cut_part = parsePythonStyleJson(button.getAttribute('data-part'));
    const nest_data = parsePythonStyleJson(button.getAttribute('data-nest'));

    recut_laser_cut_part = laser_cut_part;
    recut_nest = nest_data;

    recut_max_quantity = nest_data.sheet_count * laser_cut_part.quantity_in_nest - laser_cut_part.recut_count;

    document.getElementById('recut-part-name').innerText = `${laser_cut_part.name}`;
    document.getElementById('recut-quantity-input').value = '1';
    document.getElementById('recut-quantity-input').max = recut_max_quantity;

    if (recut_max_quantity == 1){
        document.getElementById('recut-count-1').classList.remove("hidden");
        document.getElementById('recut-count-2').classList.add("hidden");
        document.getElementById('recut-count-3').classList.add("hidden");
        document.getElementById('recut-count-all').classList.add("hidden");
        document.getElementById('recut-quantity-div').classList.add("hidden");
    } else if (recut_max_quantity == 2){
        document.getElementById('recut-count-1').classList.remove("hidden");
        document.getElementById('recut-count-2').classList.remove("hidden");
        document.getElementById('recut-count-3').classList.add("hidden");
        document.getElementById('recut-count-all').classList.add("hidden");
        document.getElementById('recut-quantity-div').classList.add("hidden");
    } else if (recut_max_quantity == 3){
        document.getElementById('recut-count-1').classList.remove("hidden");
        document.getElementById('recut-count-2').classList.remove("hidden");
        document.getElementById('recut-count-3').classList.remove("hidden");
        document.getElementById('recut-count-all').classList.add("hidden");
        document.getElementById('recut-quantity-div').classList.add("hidden");
    } else if (recut_max_quantity > 3){
        document.getElementById('recut-count-1').classList.remove("hidden");
        document.getElementById('recut-count-2').classList.remove("hidden");
        document.getElementById('recut-count-3').classList.remove("hidden");
        document.getElementById('recut-count-all').classList.remove("hidden");
        document.getElementById('recut-quantity-div').classList.remove("hidden");
    }
    ui('#recut-dialog');
}
function recutPart(quantity){
    var recut_quantity = quantity
    if (quantity === "All"){
        recut_quantity = recut_nest.sheet_count * recut_laser_cut_part.quantity_in_nest;
    }
    document.getElementById('recut-quantity-input').value = recut_quantity;
    if (recut_quantity <= recut_max_quantity){
        submitRecutPart();
    }
}

async function submitRecutPart() {
    const workorder_name = getWorkorderNameFromUrl();
    const recut_quantity = document.getElementById('recut-quantity-input').value;

    const recut_data = {
        laser_cut_part: recut_laser_cut_part,
        nest: recut_nest,
        quantity: recut_quantity
    };

    try {
        const response = await fetch(`/recut_part/${workorder_name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(recut_data),
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Success:', result);
            window.location.reload(); // Refresh the page
        } else {
            console.error('Error:', response.statusText);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function goToMainUrl() {
    window.location.href = "/"
}

window.addEventListener('load', function () {
    setTimeout(function () {
        document.querySelectorAll('img').forEach(function (img) {
            img.onerror = function () {
                this.classList.add('hidden');
            };
            if (img.src.includes('404.jpeg')) {
                img.classList.add('hidden');
            }
            if (!img.complete || img.naturalWidth === 0) {
                img.onerror();
            }
        });
    }, 1000); // 1000 milliseconds = 1 second
});

window.goToMainUrl = goToMainUrl;
window.markWorkorderAsDone = markWorkorderAsDone;
window.markNestAsDone = markNestAsDone;
window.recutPart = recutPart;
window.validateRecutQuantity = validateRecutQuantity;
window.openRecutDialog = openRecutDialog;
window.getWorkorderNameFromUrl = getWorkorderNameFromUrl;
window.submitRecutPart = submitRecutPart;
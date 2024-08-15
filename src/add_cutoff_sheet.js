import "beercss"

function goToMainUrl() {
    window.location.href = "/";
}

function validateForm() {
    var length = document.getElementById("length").value;
    var width = document.getElementById("width").value;
    var material = document.getElementById("material").value;
    var thickness = document.getElementById("thickness").value;

    if (length && width && material && thickness) {
        document.getElementById("addButton").disabled = false;
    } else {
        document.getElementById("addButton").disabled = true;
    }
}

window.goToMainUrl = goToMainUrl;
window.validateForm = validateForm;
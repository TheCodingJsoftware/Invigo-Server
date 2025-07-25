import "beercss"
import "material-dynamic-colors";
import '@static/css/theme.css';
import '@static/css/printout.css';

const checkboxConfig = {
    "quote": {
        "picture": true,
        "part-#": true,
        "qty": true,
        "unit-qty": false,
        "material": true,
        "thickness": true,
        "part": true,
        "price": true,
        "unit-price": true,
        "shelf-#": false,
        "process": false,
        "paint": true,
        "show-total-cost": true,
        "show-assembly-process": true,
        "net-weight-layout": true,
        "recut-parts-summary-layout": true,
    },
    "workorder": {
        "picture": true,
        "part-#": true,
        "qty": true,
        "unit-qty": false,
        "material": true,
        "thickness": true,
        "part": true,
        "price": false,
        "unit-price": false,
        "shelf-#": false,
        "process": true,
        "paint": true,
        "show-total-cost": false,
        "show-assembly-process": true,
        "net-weight-layout": true,
        "recut-parts-summary-layout": true,
    },
    "packingslip": {
        "picture": true,
        "part-#": true,
        "qty": true,
        "unit-qty": false,
        "material": true,
        "thickness": true,
        "part": true,
        "price": false,
        "unit-price": false,
        "shelf-#": false,
        "process": false,
        "paint": true,
        "show-total-cost": false,
        "show-assembly-process": false,
        "net-weight-layout": true,
        "recut-parts-summary-layout": true,
    }
};

const baseUrl = "http://invi.go/";
const mediaQueryList = window.matchMedia('print');
const navCheckBoxLinks = document.querySelectorAll('nav.tabbed.primary-container a');
const checkboxes = document.querySelectorAll('#printout-controls .checkbox input[type="checkbox"]');
const pageBreakDivs = document.querySelectorAll('#page-break');
const usePageBreakcheckbox = document.getElementById('usePageBreaks');
const lastSegment = window.location.pathname.split('/').pop();
const getStorageKey = (key) => `${lastSegment}_${key}`;

window.addEventListener('beforeprint', hideUncheckedColumns);
window.addEventListener('afterprint', restoreAllColumns);


class Accordion {
    constructor(el) {
        this.el = el;
        this.summary = el.querySelector('summary');
        this.content = el.querySelector('.detail_contents');

        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.summary.addEventListener('click', (e) => this.onClick(e));
    }

    onClick(e) {
        e.preventDefault();
        this.el.style.overflow = 'hidden';
        if (this.isClosing || !this.el.open) {
            this.open();
        } else if (this.isExpanding || this.el.open) {
            this.shrink();
        }
    }

    shrink() {
        this.isClosing = true;

        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight + 15}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 400,
            easing: 'ease-out'
        });

        this.animation.onfinish = () => this.onAnimationFinish(false);
        this.animation.oncancel = () => this.isClosing = false;
    }

    open() {
        this.el.style.height = `${this.el.offsetHeight + 10}px`;
        this.el.open = true;
        window.requestAnimationFrame(() => this.expand());
    }

    expand() {
        this.isExpanding = true;
        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight + this.content.offsetHeight + 10}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 400,
            easing: 'ease-out'
        });
        this.animation.onfinish = () => this.onAnimationFinish(true);
        this.animation.oncancel = () => this.isExpanding = false;
    }

    onAnimationFinish(open) {
        this.el.open = open;
        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.el.style.height = this.el.style.overflow = '';
    }
}

document.querySelectorAll('details').forEach((el) => {
    new Accordion(el);
});


navCheckBoxLinks.forEach(link => {
    link.addEventListener('click', function (event) {
        event.preventDefault();
        const targetColumn = this.getAttribute('data-target');
        localStorage.setItem(getStorageKey('selectedTargetColumn'), targetColumn);
        toggleCheckboxes(targetColumn, navCheckBoxLinks);
        document.body.className = targetColumn;
        document.body.classList.add(localStorage.getItem("theme") || "light")
    });
});

checkboxes.forEach(checkbox => {
    const layoutId = checkbox.getAttribute('data-layout');
    const layoutDivs = document.querySelectorAll(`#${layoutId}`);
    const storedState = localStorage.getItem(getStorageKey(checkbox.id));

    if (storedState === 'true') {
        checkbox.checked = true;
        layoutDivs.forEach(layoutDiv => layoutDiv.classList.remove('hidden'));
    } else if (storedState === 'false') {
        checkbox.checked = false;
        layoutDivs.forEach(layoutDiv => layoutDiv.classList.add('hidden'));
    } else {
        checkbox.checked = true;
    }

    checkbox.addEventListener('change', function () {
        localStorage.setItem(getStorageKey(checkbox.id), this.checked);
        layoutDivs.forEach(layoutDiv => {
            if (this.checked) {
                layoutDiv.classList.remove('hidden');
            } else {
                layoutDiv.classList.add('hidden');
            }
        });
    });
});


const storedTargetColumn = localStorage.getItem(getStorageKey('selectedTargetColumn'));

if (storedTargetColumn) {
    toggleCheckboxes(storedTargetColumn, navCheckBoxLinks);
    document.body.className = storedTargetColumn;
} else {
    let defaultTarget = null;
    navCheckBoxLinks.forEach(link => {
        if (link.classList.contains('active') && link.classList.contains('primary')) {
            defaultTarget = link.getAttribute('data-target');
        }
    });
    if (!defaultTarget) {
        defaultTarget = navCheckBoxLinks[0].getAttribute('data-target');
    }
    toggleCheckboxes(defaultTarget, navCheckBoxLinks);
    document.body.className = defaultTarget;
}


document.querySelectorAll('details.assembly_details').forEach(function (detailsElement) {
    const summary = detailsElement.querySelector('summary');
    const summaryText = summary.textContent;

    const span = document.createElement('span');
    span.textContent = summaryText;

    // Clear the summary text and append the span
    summary.textContent = '';
    summary.appendChild(span);

    // Initially hide the summary text if the details element is open
    if (detailsElement.open) {
        span.style.display = 'none';
    }

    detailsElement.addEventListener('toggle', function () {
        if (detailsElement.open) {
            span.style.display = 'none';
        } else {
            span.style.display = 'inline';
        }
    });
});

mediaQueryList.addListener((mql) => {
    if (mql.matches) {
        hideUncheckedColumns();
    } else {
        restoreAllColumns();
    }
});

document.querySelectorAll('.qr-item').forEach(async item => {
    const name = item.getAttribute('data-name');
    let encodedUrl;
    let qrDiv = item.querySelector('.qr-code');
    const sheetsUrl = baseUrl + "sheets_in_inventory/";

    encodedUrl = encodeURI(sheetsUrl + name.replace(/ /g, "_"));
    new QRCode(qrDiv, {
        text: encodedUrl,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    qrDiv.style.cursor = 'pointer';
    qrDiv.addEventListener('click', function () {
        window.open(encodedUrl, '_blank');
    });

});


const workorderDiv = document.getElementById('workorder-id');

if (workorderDiv) {
    const workorderId = workorderDiv.getAttribute('data-workorder-id');
    const qrUrl = `http://invi.go/workorder/${workorderId}`;

    // Create a new div for the QR code
    const qrDiv = document.createElement('div');
    qrDiv.classList.add('qr-code');
    workorderDiv.appendChild(qrDiv);

    // Generate the QR code
    new QRCode(qrDiv, {
        text: qrUrl,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    var imgElement = qrDiv.querySelector('img');
    if (imgElement) {
        // Add the desired class to the img element
        imgElement.classList.add('workorder-qr-code');
    }
    // Set cursor to pointer and add click event to open the URL in a new tab
    qrDiv.addEventListener('click', function () {
        window.open(qrUrl);
    });
}

function toggleCheckboxes(targetColumn, navLinks) {
    navLinks.forEach(link => {
        if (link.getAttribute('data-target') === targetColumn) {
            link.classList.add('active');
            link.classList.add('primary');
        } else {
            link.classList.remove('active');
            link.classList.remove('primary');
        }
    });

    const config = checkboxConfig[targetColumn];
    if (config) {
        for (const [column, shouldCheck] of Object.entries(config)) {
            const checkboxes = document.querySelectorAll(`input[data-name="${column}"]`);
            checkboxes.forEach(checkbox => {
                if (checkbox) {
                    checkbox.checked = shouldCheck;
                    // This is for the nav selection show-total-cost checkbox
                    try {
                        const layoutId = checkbox.getAttribute('data-layout');
                        const layoutDivs = document.querySelectorAll(`#${layoutId}`);
                        layoutDivs.forEach(layoutDiv => {
                            if (shouldCheck) {
                                layoutDiv.classList.remove('hidden');
                            } else {
                                layoutDiv.classList.add('hidden');
                            }
                        });
                    } catch (error) { }
                }
            });
        }
    }
}

function setTheme(theme) {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
    localStorage.setItem("theme", theme);

    const themeIcon = document.getElementById("theme-icon");
    themeIcon.innerText = theme === "light" ? "dark_mode" : "light_mode";

    const icons = document.querySelectorAll('img');

    if (theme === 'dark') {
        icons.forEach(icon => {
            icon.style.filter = 'invert(0.9)';
        });
    } else {
        icons.forEach(icon => {
            icon.style.filter = 'invert(0)';
        });
    }
}

window.onbeforeprint = function () {
    document.body.classList.remove("light", "dark");
    document.body.classList.add("light");
};

window.onafterprint = function () {
    setTheme(localStorage.getItem("theme") || "light");
};

function hideUncheckedColumns() {
    const checkboxes = document.querySelectorAll('.column-toggle');
    checkboxes.forEach(checkbox => {
        if (!checkbox.checked) {
            const column = checkbox.getAttribute('data-column');
            const table = checkbox.closest('table');
            const thCells = table.querySelectorAll(`th:nth-child(${parseInt(column) + 1})`);
            const tdCells = table.querySelectorAll(`td[data-column="${column}"]`);

            thCells.forEach(cell => {
                cell.classList.add('hidden-column');
            });

            tdCells.forEach(cell => {
                cell.classList.add('hidden-column');
            });
        }
    });
}

function restoreAllColumns() {
    const tables = document.querySelectorAll('.dynamic-table');
    tables.forEach(table => {
        const hiddenCells = table.querySelectorAll('.hidden-column');
        hiddenCells.forEach(cell => {
            cell.classList.remove('hidden-column');
        });
    });
}

if (usePageBreakcheckbox.checked) {
    pageBreakDivs.forEach(div => div.classList.add('page-break'));
} else {
    pageBreakDivs.forEach(div => div.classList.remove('page-break'));
}

usePageBreakcheckbox.addEventListener('change', function () {
    if (usePageBreakcheckbox.checked) {
        pageBreakDivs.forEach(div => div.classList.add('page-break'));
    } else {
        pageBreakDivs.forEach(div => div.classList.remove('page-break'));
    }
});

function updateNestContainerClass() {
    const isMobile = window.innerWidth <= 600; // Adjust the width threshold for mobile screens
    const containers = document.querySelectorAll('#sheets-layout #nest-container');
    const coverPageContainers = document.querySelectorAll('#cover-page .grid article');
    containers.forEach(container => {
        if (isMobile) {
            if (container.classList.contains('s6')) {
                container.classList.remove('s6');
                container.classList.add('s12');
            }
        } else {
            if (container.classList.contains('s12')) {
                container.classList.remove('s12');
                container.classList.add('s6');
            }
        }
    });
    coverPageContainers.forEach(container => {
        if (isMobile) {
            if (container.classList.contains('s6')) {
                container.classList.remove('s6');
                container.classList.add('s12');
            }
        } else {
            if (container.classList.contains('s12')) {
                container.classList.remove('s12');
                container.classList.add('s6');
            }
        }
    });
}


function updateNavbarLocation(){
    const isMobile = window.innerWidth <= 600; // Adjust the width threshold for mobile screens
    const container = document.querySelector('#printout-controls');
    if (isMobile) {
        if (container.classList.contains('left')) {
            container.classList.remove('left');
            container.classList.remove('border');
        }
    } else {
        if (!container.classList.contains('left')) {
            container.classList.add('left');
            container.classList.add('border');
        }
    }
}

window.addEventListener('load', updateNestContainerClass);
window.addEventListener('resize', updateNavbarLocation);

window.addEventListener('load', updateNavbarLocation);
window.addEventListener('resize', updateNestContainerClass);

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

document.addEventListener('DOMContentLoaded', function () {
    const themeToggle = document.getElementById("theme-toggle");
    themeToggle.addEventListener("click", () => {
        const currentTheme = document.body.classList.contains("dark") ?
            "dark" :
            "light";
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        setTheme(newTheme);
    });

    themeToggle.checked = localStorage.getItem("theme") === "dark";

    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
});
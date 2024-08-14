function goToMainUrl() {
    window.location.href = "/";
}

function openPrintout(dir, name) {
    window.location.href = "/load_job/" + dir + '/' + name;
    console.log(dir, name);
}

document.addEventListener('DOMContentLoaded', function () {
    function activateTabFromHash() {
        const hash = window.location.hash;
        if (hash) {
            const activeTab = document.querySelector(`.tabs a[href="${hash}"]`);
            if (activeTab) {
                document.querySelectorAll('.tabs a').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

                activeTab.classList.add('active');
                document.querySelector(hash).classList.add('active');
            }
        }
    }
    activateTabFromHash();
    document.querySelectorAll('.tabs a').forEach(tab => {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            history.pushState(null, null, this.getAttribute('href'));
            activateTabFromHash();
        });
    });
    window.addEventListener('hashchange', activateTabFromHash);

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        document.querySelectorAll('.job-item').forEach(item => {
            const name = item.querySelector('h5').innerText.toLowerCase();
            const orderNumber = item.querySelector('p').innerText.toLowerCase();
            if (name.includes(query) || orderNumber.includes(query)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
});
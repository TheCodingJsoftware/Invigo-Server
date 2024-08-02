function goToMainUrl() {
    window.location.href = "/"
}
async function loadWorkspaceConfig() {
    try {
        const response = await fetch('/static/workspace.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        return config;
    } catch (error) {
        console.error('Failed to load workspace:', error);
        return null;
    }
}

function loadWorkspaceContents(workspace) {
    const container = document.getElementById('workspace-container');
    if (!container) return;

    workspace.jobs.forEach(job => {
        const jobElement = document.createElement('div');
        jobElement.className = 'card';
        jobElement.innerHTML = `
            <h3>${job.name}</h3>
            <p>${job.description}</p>
            <a href="${job.url}" class="button">Open</a>
        `;
        container.appendChild(jobElement);
    });
}

window.addEventListener('load', async function () {
    const workspace = await loadWorkspaceConfig();
    if (workspace) {
        console.log('Workspace loaded:', workspace);
        loadWorkspaceContents(workspace);
    }
    setTimeout(function () {
        document.querySelectorAll('img').forEach(function (img) {
            img.onerror = function () {
                this.classList.add('hidden');
            };
            if (!img.complete || img.naturalWidth === 0) {
                img.onerror();
            }
        });
    }, 1000); // 1000 milliseconds = 1 second
});
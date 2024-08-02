function goToMainUrl() {
    window.location.href = "/"
}

class WorkspaceDashboard {
    constructor() {
        this.workspace = null;
        this.workspace_settings = null;
    }

    async initialize() {
        this.workspace = await this.loadWorkspace();
        this.workspace_settings = await this.loadWorkspaceSettings();
        if (this.workspace && this.workspace_settings) {
            this.loadWorkspaceContents();
        }
    }

    loadWorkspaceContents() {
        const container = document.getElementById('workspace-container');
        if (!container || !this.workspace || !this.workspace.jobs) return;

        this.workspace.jobs.forEach(job => {
            const jobElement = document.createElement('article');
            jobElement.className = 'article';
            jobElement.innerHTML = `
                <h3>${job.job_data.name}</h3>
                <a href="${job.url}" class="button">Open</a>
            `;
            container.appendChild(jobElement);
        });
    }

    async loadWorkspace() {
        try {
            const response = await fetch('/data/workspace.json');
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

    async loadWorkspaceSettings() {
        try {
            const response = await fetch('/data/workspace_settings.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const config = await response.json();
            return config;
        } catch (error) {
            console.error('Failed to load workspace settings:', error);
            return null;
        }
    }
}
window.addEventListener('load', async function () {
    const workspace_dashboard = new WorkspaceDashboard();
    await workspace_dashboard.initialize(); // Wait for initialization to complete
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
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
            this.createBasicChart(); // Add this line to create a chart after loading workspace contents
        }
    }
    createBasicChart() {
        const container = document.getElementById('chart-container');
        if (!container) {
            console.error('Chart container not found');
            return;
        }

        // Clear the container
        container.innerHTML = '';

        // Create a canvas element
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
                datasets: [{
                    label: '# of Votes',
                    data: [12, 19, 3, 5, 2, 3],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
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
    const workspace_dashboard = new WorkspaceScheduler();
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
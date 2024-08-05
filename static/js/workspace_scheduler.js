import { getAssemblies, isAssemblyComplete, getAssemblyCompletionTime } from './utils.js';

function goToMainUrl() {
    window.location.href = "/";
}

class GanttProgressGraph {
    constructor(jobs) {
        this.jobs = jobs;
        this.today = new Date();
        this.oneWeekLater = new Date(this.today.getTime() + 7 * 24 * 60 * 60 * 1000);
        this.data = [];
    }

    addJob(job, index) {
        if (!job.job_data.starting_date) {
            job.job_data.starting_date = this.today.toISOString().split("T")[0];
        }
        if (!job.job_data.ending_date) {
            job.job_data.ending_date = this.oneWeekLater.toISOString().split("T")[0];
        }

        const startDate = new Date(job.job_data.starting_date);
        const endDate = new Date(job.job_data.ending_date);

        this.data.push({
            start: startDate,
            end: endDate,
            name: job.job_data.name,
            id: `${job.job_data.name}[${index}]`,
            progress: 0,  // You can calculate this based on the job's progress
            dependencies: null
        });

        this.addAssemblies(job.assemblies, `${job.job_data.name}[${index}]`, 0);
    }

    addAssemblies(assemblies, parentId, level) {
        assemblies.forEach((assembly, assemblyIndex) => {
            if (!assembly.assembly_data.starting_date) {
                assembly.assembly_data.starting_date = this.today.toISOString().split("T")[0];
            }
            const startDate = new Date(assembly.assembly_data.starting_date);
            const expectedDays = assembly.assembly_data.expected_time_to_complete || 0;
            const endDate = new Date(startDate.getTime() + expectedDays * 24 * 60 * 60 * 1000);
            const assemblyId = `${parentId}/${assembly.assembly_data.name}[${assemblyIndex}]`;

            this.data.push({
                start: startDate,
                end: endDate,
                name: assembly.assembly_data.name,
                id: assemblyId,
                progress: 50, // TODO: Implement progress
                dependencies: parentId
            });

            if (assembly.sub_assemblies && assembly.sub_assemblies.length > 0) {
                this.addAssemblies(assembly.sub_assemblies, assemblyId, level + 1);
            }
        });
    }

    getGanttWorkspaceData() {
        this.jobs.forEach((job, index) => {
            this.addJob(job, index);
        });
        return this.data;
    }

}

class WorkspaceScheduler {
    constructor() {
        this.workspace = null;
        this.workspaceSettings = null;
        this.ganttWorkspaceData = null;
        this.allAssemblies = null;
        this.ganttProgressGraph = null;
        this.socket = null;
    }

    async initialize() {
        this.workspace = await this.loadWorkspace();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        if (this.workspace && this.workspaceSettings) {
            this.allAssemblies = this.loadAllAssemblies();
            this.loadGantts();
            this.setupWebSocket();
        }
    }

    async reloadGanttGraph() {
        this.workspace = await this.loadWorkspace();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        if (this.workspace && this.workspaceSettings) {
            this.allAssemblies = this.loadAllAssemblies();
            this.loadGantts();
        }
    }

    loadAllAssemblies() {
        let allAssemblies = [];
        this.workspace.jobs.forEach(job => {
            allAssemblies = allAssemblies.concat(getAssemblies(job));
        });
        return allAssemblies;
    }

    loadGantts() {
        const chartsContainer = document.getElementById('charts');
        if (!chartsContainer) {
            console.error('Charts container not found');
            return;
        }

        const ganttJob = new GanttProgressGraph(this.workspace.jobs);
        const ganttData = ganttJob.getGanttWorkspaceData();

        this.ganttProgressGraph = new Gantt('.gantt-container', ganttData, {
            view_mode: 'Month',
            language: 'en',
            header_height: 50,
            column_width: 30,
            step: 24,
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            date_format: 'YYYY-MM-DD',
            popup_trigger: 'click',
            on_click: task => {
                // console.log(task);
            },
            on_date_change: (task, start, end) => {
                this.updateWorkspaceDates(task.id, start, end);
            },
        });
    }

    updateWorkspaceDates(id, start, end) {
        const parts = id.split('/').map(part => part.replace(/\[(\d+)\]/, (_, num) => `__${num}`));
        console.log(parts);

        function recursiveUpdate(parts, currentLevel) {
            const part = parts.shift();

            if (!part) return;

            const [name, index] = part.split('__');
            const match = currentLevel.find((item, idx) => item.assembly_data.name === name && idx === parseInt(index, 10));
            if (match) {
                console.log(parts);
                if (parts.length === 0) {
                    // Update the dates
                    match.assembly_data.starting_date = start.toISOString().split('T')[0];
                    match.assembly_data.ending_date = end.toISOString().split('T')[0];
                } else if (match.sub_assemblies) {
                    recursiveUpdate(parts, match.sub_assemblies);
                }
            }
        }
        const [jobName, jobIdx] = parts[0].split('__');
        this.workspace.jobs.forEach((job, jobIndex) => {
            if (job.job_data.name === jobName && jobIndex === parseInt(jobIdx, 10)) {
                if (parts.length === 1) {
                    // Update job dates
                    job.job_data.starting_date = start.toISOString().split('T')[0];
                    job.job_data.ending_date = end.toISOString().split('T')[0];
                } else if (parts.length === 2) {
                    // Update assembly dates
                    const [assemblyName, assemblyIdx] = parts[1].split('__');
                    const assembly = job.assemblies.find((item, idx) => item.assembly_data.name === assemblyName && idx === parseInt(assemblyIdx, 10));
                    if (assembly) {
                        assembly.assembly_data.starting_date = start.toISOString().split('T')[0];
                        assembly.assembly_data.ending_date = end.toISOString().split('T')[0];
                    }
                } else {
                    // Update sub-assembly dates
                    recursiveUpdate(parts.slice(1), job.assemblies);
                }
            }
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
    async uploadWorkspace() {
        const response = await fetch('/workspace_scheduler_upload', {
            method: 'POST',
            body: this.createFormData()
        });

        if (response.ok) {
            console.log('Workspace uploaded successfully.');
        } else {
            console.error('Failed to upload workspace.');
        }
    }

    createFormData() {
        const formData = new FormData();
        const workspaceBlob = new Blob([JSON.stringify(this.workspace)], { type: 'application/json' });
        formData.append('file', workspaceBlob, 'workspace.json');
        return formData;
    }

    setupWebSocket() {
        this.socket = new WebSocket(`ws://${window.location.host}/ws/web`);
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.action === 'download' && message.files.includes('workspace')) {
                console.log('Workspace update received. Reloading...');
                this.loadWorkspace().then(() => {
                    this.reloadGanttGraph();
                });
            }
        };
    }
}

window.addEventListener('load', async function () {
    const workspace_dashboard = new WorkspaceScheduler();
    try {
        await workspace_dashboard.initialize(); // Wait for initialization to complete
    } catch (error) {
        console.error('Error initializing workspace:', error);
        alert('Error loading workspace. Please try again later.');
    }

    document.getElementById('submit-button').onclick = function () {
        workspace_dashboard.uploadWorkspace();
    };

    function setActiveView(button, viewMode) {
        document.querySelectorAll('nav.tabbed.large a').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        // Update the URL with the selected view mode
        const url = new URL(window.location);
        url.searchParams.set('view', viewMode);
        window.history.pushState({}, '', url);
    }

    // Event listeners for view mode buttons
    document.getElementById('day-button').onclick = function () {
        if (workspace_dashboard.ganttProgressGraph) {
            workspace_dashboard.ganttProgressGraph.change_view_mode('Day');
            setActiveView(this, 'Day');
        }
    };

    document.getElementById('week-button').onclick = function () {
        if (workspace_dashboard.ganttProgressGraph) {
            workspace_dashboard.ganttProgressGraph.change_view_mode('Week');
            setActiveView(this, 'Week');
        }
    };

    document.getElementById('month-button').onclick = function () {
        if (workspace_dashboard.ganttProgressGraph) {
            workspace_dashboard.ganttProgressGraph.change_view_mode('Month');
            setActiveView(this, 'Month');
        }
    };

    document.getElementById('year-button').onclick = function () {
        if (workspace_dashboard.ganttProgressGraph) {
            workspace_dashboard.ganttProgressGraph.change_view_mode('Year');
            setActiveView(this, 'Year');
        }
    };
    const urlParams = new URLSearchParams(window.location.search);
    const viewMode = urlParams.get('view') || 'Month'; // Default to 'Month' if not specified

    // Set the active view button and change the view mode
    document.querySelectorAll('nav.tabbed.large a').forEach(button => {
        const spanText = button.querySelector('span').innerText;
        if (spanText === viewMode) {
            setActiveView(button, viewMode);
        }
    });

    if (workspace_dashboard.ganttProgressGraph) {
        workspace_dashboard.ganttProgressGraph.change_view_mode(viewMode);
    }

    setTimeout(function () {
        document.querySelectorAll('brandingLogo').forEach(function (img) {
            img.onerror = function () {
                this.classList.add('hidden');
            };
            if (!img.complete || img.naturalWidth === 0) {
                img.onerror();
            }
        });
    }, 1000); // 1000 milliseconds = 1 second

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
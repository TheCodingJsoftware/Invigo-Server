import {
    getAssemblies,
    isAssemblyComplete,
    isJobComplete,
    getAssemblyCompletionProgress,
    getJobCompletionProgress,
    getAssemblyCompletionTime,
    getPartProcessCountByTag,
    getAssemblyCount,
    getAssemblyProcessCountByTag,
    getPartProcessExpectedTimeToComplete,
    getAssemblyProcessExpectedTimeToComplete,
    getPartsCount,
} from './utils.js';


class HeatMap {
    constructor(productionPlan, workspaceSettings, container) {
        this.productionPlan = productionPlan;
        this.workspaceSettings = workspaceSettings;
        this.container = container;
        this.containerDiv = null;
        this.heatmapCanvas = null;
        this.currentProcess = null;
        this.chartInstance = null;
        this.minValue = null;
        this.maxValue = null;
    }

    initialize() {
        this.containerDiv = document.getElementById(this.container);
        this.heatmapCanvas = this.containerDiv.querySelector('canvas').id;
        this.processSelections = this.containerDiv.querySelector('select');
        this.populateProcessSelections();

        if (this.workspaceSettings.tags.length > 0 && !this.currentProcess) {
            this.processSelections.value = this.workspaceSettings.tags[0];
        }

        this.processSelections.addEventListener('change', () => {
            this.currentProcess = this.processSelections.value;
            this.loadHeatMap();
        });
        this.currentProcess = this.processSelections.value;
        this.loadHeatMap();
    }

    populateProcessSelections() {
        this.processSelections.innerHTML = '';
        Object.keys(this.workspaceSettings.tags).forEach(tagName => {
            const option = document.createElement('option');
            option.textContent = tagName;
            this.processSelections.appendChild(option);
        });
    }

    generateData() {
        const data = [];
        const startDate = new Date(new Date().getFullYear(), 0, 1); // Jan 1st of current year
        const endDate = new Date(new Date().getFullYear(), 11, 31); // Dec 31st of current year

        let currentDate = new Date(new Date().setDate(endDate.getDate() - 365));

        let minValue = Number.POSITIVE_INFINITY;
        let maxValue = Number.NEGATIVE_INFINITY;

        while (currentDate <= endDate) {
            let totalHourCount = 0;

            this.productionPlan.jobs.forEach(job => {
                const jobStartDate = new Date(job.job_data.starting_date);
                const jobEndDate = new Date(job.job_data.ending_date);

                // If the job is active on the current date
                if (jobStartDate <= currentDate && currentDate <= jobEndDate) {
                    const flowtag_timeline = job.job_data.flowtag_timeline;
                    if (flowtag_timeline.hasOwnProperty(this.currentProcess)) {
                        const tag = flowtag_timeline[this.currentProcess];
                        const tagStartDate = new Date(tag.starting_date);
                        const tagEndDate = new Date(tag.ending_date);
                        const durationDays = (tagEndDate - tagStartDate) / (1000 * 60 * 60 * 24);
                        const processExpectedTimeSeconds = (getPartProcessExpectedTimeToComplete(job, this.currentProcess) + getAssemblyProcessExpectedTimeToComplete(job, this.currentProcess)); // seconds
                        if (tagStartDate <= currentDate && currentDate <= tagEndDate) {
                            totalHourCount += processExpectedTimeSeconds / durationDays / 60;
                        }
                    }
                }
            });

            // Update min and max values
            if (totalHourCount < minValue) {
                minValue = totalHourCount;
            }
            if (totalHourCount > maxValue) {
                maxValue = totalHourCount;
            }

            const isoDate = currentDate.toISOString().substr(0, 10);
            data.push({
                x: isoDate,
                y: currentDate.getDay(),
                d: isoDate,
                v: totalHourCount
            });

            // Move to the next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        this.minValue = minValue;
        this.maxValue = maxValue;

        return data;
    }


    loadHeatMap() {
        const ctx = document.getElementById(this.heatmapCanvas).getContext('2d');
        const MAX = 255;

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const data = {
            datasets: [{
                label: 'Production Plan HeatMap',
                data: this.generateData(), backgroundColor(c) {
                    const value = c.dataset.data[c.dataIndex].v;

                    if (value === 0) {
                        return 'rgba(0, 0, 0, 0)';
                    }

                    const normalizedValue = Math.min(value, MAX);

                    let alpha = normalizedValue / 60;

                    const r = Math.floor(255 * (normalizedValue / 10));
                    const g = Math.floor(255 * (20 - normalizedValue / 10));
                    const b = 0;

                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                },
                borderColor(c) {
                    const value = c.dataset.data[c.dataIndex].v;

                    const normalizedValue = Math.min(value, MAX);

                    const alpha = (10 + normalizedValue) / 255;

                    const r = Math.floor(255 * (normalizedValue / 10));
                    const g = Math.floor(255 * (20 - normalizedValue / 10));
                    const b = 0;

                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                },
                borderWidth: 1,
                hoverBorderColor: 'yellowgreen',
                width(c) {
                    const a = c.chart.chartArea || {};
                    const numWeeks = 52;
                    return (a.right - a.left) / numWeeks - 4;
                },
                height(c) {
                    const a = c.chart.chartArea || {};
                    const numDays = 7;
                    return (a.bottom - a.top) / numDays;
                }
            }]
        };
        const scales = {
            y: {
                type: 'linear',
                min: 0,
                max: 6,
                offset: true,
                ticks: {
                    stepSize: 1,
                    callback: function (value) {
                        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                        return days[value];
                    },
                    font: {
                        size: 9
                    }
                },
                grid: {
                    display: false,
                    drawBorder: false,
                    tickLength: 0
                },
            },
            x: {
                type: 'time',
                position: 'bottom',
                offset: true,
                time: {
                    unit: 'week',
                    round: 'week',
                    isoWeekday: 0,
                    displayFormats: {
                        week: 'MMM dd'
                    }
                },
                ticks: {
                    maxRotation: 0,
                    autoSkip: true,
                    font: {
                        size: 9
                    },
                },
                grid: {
                    display: false,
                    drawBorder: false,
                    tickLength: 0,
                }
            }
        };

        const options = {
            aspectRatio: 0,
            plugins: {
                legend: false,
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title() {
                            return '';
                        },
                        label(context) {
                            const v = context.dataset.data[context.dataIndex];
                            return ['Date: ' + v.d, 'Jobs: ' + v.v.toFixed(2)];
                        }
                    }
                },
            },
            scales: scales,
            layout: {
                padding: {
                    top: 10,
                    left: 10,
                    right: 10,
                    bottom: 10
                },
            }
        };

        const config = {
            type: 'matrix',
            data: data,
            options: options
        };

        this.chartInstance = new Chart(ctx, config);

        this.containerDiv.querySelector('#min-value-display').textContent = `Min: ${this.minValue}h`;
        this.containerDiv.querySelector('#max-value-display').textContent = `Max: ${this.maxValue}h`;
    }
}

class WorkspaceDashboard {
    constructor() {
        this.workspace = null;
        this.workspaceSettings = null;
        this.productionPlan = null
        this.productionPlanHeatMap = null;
        this.workspaceHeatmap = null;
        this.socket = null;
    }

    async initialize() {
        this.workspace = await this.loadWorkspace();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        this.productionPlan = await this.loadProductionPlan();
        if (this.workspace && this.workspaceSettings && this.productionPlan) {
            this.loadWorkspaceContents();
            this.createBasicChart();
            this.loadProductionPlanHeatmap();
            this.loadWorkspaceHeatmap();
            this.setupWebSocket();
        }
    }

    async reloadView() {
        this.workspace = await this.loadWorkspace();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        this.productionPlan = await this.loadProductionPlan();
        if (this.workspace && this.workspaceSettings && this.productionPlan) {
            this.createBasicChart();
            this.loadProductionPlanHeatmap();
            this.loadWorkspaceHeatmap();
        }
    }

    loadProductionPlanHeatmap() {
        if (!this.productionPlanHeatMap) {
            this.productionPlanHeatMap = new HeatMap(this.productionPlan, this.workspaceSettings, 'production-plan-heatmap-container');
            this.productionPlanHeatMap.initialize();
        } else {
            this.productionPlanHeatMap.loadHeatMap();
        }
    }

    loadWorkspaceHeatmap() {
        if (!this.workspaceHeatmap) {
            this.workspaceHeatmap = new HeatMap(this.workspace, this.workspaceSettings, 'workspace-heatmap-container');
            this.workspaceHeatmap.initialize();
        } else {
            this.workspaceHeatmap.loadHeatMap();
        }
    }

    createBasicChart() {
        const container = document.getElementById('chart-container');
        if (!container) {
            console.error('Chart container not found');
            return;
        }

        container.innerHTML = '';

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

    async loadProductionPlan() {
        try {
            const response = await fetch('/data/production_plan.json');
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

    setupWebSocket() {
        this.socket = new WebSocket(`ws://${window.location.host}/ws/web`);
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.action === 'download') {
                console.log('Workspace update received. Reloading...');
                this.loadProductionPlan().then(() => {
                    this.reloadView();
                });
            }
        };
    }
}

window.addEventListener('load', async function () {
    const workspace_dashboard = new WorkspaceDashboard();
    await workspace_dashboard.initialize();
    setTimeout(function () {
        document.querySelectorAll('img').forEach(function (img) {
            img.onerror = function () {
                this.classList.add('hidden');
            };
            if (!img.complete || img.naturalWidth === 0) {
                img.onerror();
            }
        });
    }, 1000);
});
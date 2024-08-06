import {
    getAssemblies,
    isAssemblyComplete,
    isJobComplete,
    getAssemblyCompletionProgress,
    getJobCompletionProgress,
    getAssemblyCompletionTime
} from './utils.js';

function goToMainUrl() {
    window.location.href = "/";
}

class GanttGraph {
    constructor(workspace) {
        this.workspace = workspace;
        this.today = new Date();
        this.oneWeekLater = new Date(this.today.getTime() + 7 * 24 * 60 * 60 * 1000);
        this.data = null;
        this.links = null;
        this.idCounter = null;
        this.lastViewMode = "quarter"
    }

    initialize() {
        this.data = [];
        this.links = [];
        this.idCounter = 1;
        this.loadConfig();
    }

    generateId() {
        return this.idCounter++;
    }

    loadJobs() {
        this.workspace.jobs.forEach(job => {
            if (!job.job_data.starting_date) {
                job.job_data.starting_date = this.today.toISOString().split("T")[0];
            }
            if (!job.job_data.ending_date) {
                job.job_data.ending_date = this.oneWeekLater.toISOString().split("T")[0];
            }

            const startDate = new Date(job.job_data.starting_date);
            const endDate = new Date(job.job_data.ending_date);
            const jobId = this.generateId();

            this.data.push({
                id: jobId,
                text: job.job_data.name,
                start_date: startDate,
                duration: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
                progress: getJobCompletionProgress(job),
                open: false,
                parent: 0,
                color: job.job_data.color,
            });

            this.loadAssemblies(job.assemblies, jobId, false);
        });
    }

    loadAssemblies(assemblies, parentId, flip) {
        assemblies.forEach(assembly => {
            if (!assembly.assembly_data.starting_date) {
                assembly.assembly_data.starting_date = this.today.toISOString().split("T")[0];
            }
            const startDate = new Date(assembly.assembly_data.starting_date);
            const expectedDays = assembly.assembly_data.expected_time_to_complete || 0;
            const endDate = new Date(assembly.assembly_data.ending_date);
            const assemblyId = this.generateId();

            this.data.push({
                id: assemblyId,
                text: assembly.assembly_data.name,
                start_date: startDate,
                duration: expectedDays,
                progress: getAssemblyCompletionProgress(assembly),
                open: false,
                parent: parentId,
                color: assembly.assembly_data.color,
            });

            this.links.push({
                id: assemblyId,
                source: assemblyId,
                target: parentId,
                type: "1"
            });

            if (assembly.sub_assemblies && assembly.sub_assemblies.length > 0) {
                this.loadAssemblies(assembly.sub_assemblies, assemblyId, true);
            }
        });
    }

    loadConfig() {
        gantt.config.min_column_width = 50;
        gantt.config.scale_height = 90;

        var zoomConfig = {
            levels: [
                {
                    name: "day",
                    scale_height: 27,
                    min_column_width: 80,
                    scales: [
                        { unit: "day", step: 1, format: "%d %M" }
                    ]
                },
                {
                    name: "week",
                    scale_height: 50,
                    min_column_width: 50,
                    scales: [
                        {
                            unit: "week", step: 1, format: function (date) {
                                var dateToStr = gantt.date.date_to_str("%d %M");
                                var endDate = gantt.date.add(date, -6, "day");
                                var weekNum = gantt.date.date_to_str("%W")(date);
                                return "#" + weekNum + ", " + dateToStr(date) + " - " + dateToStr(endDate);
                            }
                        },
                        { unit: "day", step: 1, format: "%j %D" }
                    ]
                },
                {
                    name: "month",
                    scale_height: 50,
                    min_column_width: 120,
                    scales: [
                        { unit: "month", format: "%F, %Y" },
                        { unit: "week", format: "Week #%W" }
                    ]
                },
                {
                    name: "quarter",
                    height: 50,
                    min_column_width: 90,
                    scales: [
                        { unit: "month", step: 1, format: "%M" },
                        {
                            unit: "quarter", step: 1, format: function (date) {
                                var dateToStr = gantt.date.date_to_str("%M");
                                var endDate = gantt.date.add(gantt.date.add(date, 3, "month"), -1, "day");
                                return dateToStr(date) + " - " + dateToStr(endDate);
                            }
                        }
                    ]
                },
                {
                    name: "year",
                    scale_height: 50,
                    min_column_width: 30,
                    scales: [
                        { unit: "year", step: 1, format: "%Y" }
                    ]
                }
            ]
        };

        gantt.templates.scale_cell_class = function (date) {
            if (date.getDay() == 0 || date.getDay() == 6) {
                return "weekend";
            }
        };
        gantt.templates.timeline_cell_class = function (item, date) {
            if (date.getDay() == 0 || date.getDay() == 6) {
                return "weekend"
            }
        };

        gantt.ext.zoom.init(zoomConfig);
        gantt.ext.zoom.setLevel("month");
        gantt.ext.zoom.attachEvent("onAfterZoom", function (level, config) {
            document.querySelector(".gantt_radio[value='" + config.name + "']").checked = true;
        })
        var weekScaleTemplate = function (date) {
            var dateToStr = gantt.date.date_to_str("%d %M");
            var endDate = gantt.date.add(gantt.date.add(date, 1, "week"), -1, "day");
            return dateToStr(date) + " - " + dateToStr(endDate);
        };

        var daysStyle = function (date) {
            if (date.getDay() === 0 || date.getDay() === 6) {
                return "weekend";
            }
            return "";
        };

        gantt.config.scales = [
            { unit: "month", step: 1, format: "%F, %Y" },
            { unit: "week", step: 1, format: weekScaleTemplate },
            { unit: "day", step: 1, format: "%D", css: daysStyle }
        ];

        gantt.config.date_format = "%Y-%m-%d";
        gantt.config.columns = [
            { name: "text", label: "Job/Assembly name", tree: true, width: 180 },
            { name: "start_date", label: "Start date", align: "center", width: 100 },
            { name: "duration", label: "Days", align: "center" },
            { name: "end_date", label: "End date", align: "center", width: 100 },
        ];

        gantt.config.scale_height = 50;
        gantt.config.autoscroll = true;
        gantt.config.multiselect = false;
        gantt.config.show_links = true;

        gantt.templates.progress_text = function (start, end, task) {
            return "<span style='text-align:left;'>" + Math.round(task.progress * 100) + "% </span>";
        };
        gantt.plugins({
            multiselect: true,
            auto_scheduling: true,
            drag_timeline: true,
            click_drag: true,
        });

        gantt.attachEvent("onTaskDrag", (id, mode, item, original) => {
            this.updateJobs(item)
        });

        gantt.attachEvent("onAfterTaskUpdate", (id, item) => {
            this.updateJobs(item)
        });
    }

    render() {
        gantt.init("gantt_here");
        gantt.parse(this.loadData());
        gantt.ext.zoom.setLevel(this.lastViewMode)
    }

    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = ("0" + (d.getMonth() + 1)).slice(-2);
        const day = ("0" + d.getDate()).slice(-2);
        return `${year}-${month}-${day}`;
    }

    updateAssemblies(assemblies, itemToUpdate, counter) {
        assemblies.forEach(assembly => {
            counter.id++;
            if (counter.id === itemToUpdate.id && assembly.assembly_data.name === itemToUpdate.text) {
                assembly.assembly_data.starting_date = this.formatDate(itemToUpdate.start_date);
                assembly.assembly_data.ending_date = this.formatDate(itemToUpdate.end_date);
                assembly.assembly_data.expected_time_to_complete = itemToUpdate.duration;
                return;
            }
            if (assembly.sub_assemblies && assembly.sub_assemblies.length > 0) {
                this.updateAssemblies(assembly.sub_assemblies, itemToUpdate, counter);
            }
        });
    }

    updateJobs(itemToUpdate) {
        var counter = { id: 0 };
        this.workspace.jobs.forEach(job => {
            counter.id++;
            if (counter.id === itemToUpdate.id && job.job_data.name === itemToUpdate.text) {
                job.job_data.starting_date = this.formatDate(itemToUpdate.start_date);
                job.job_data.ending_date = this.formatDate(itemToUpdate.end_date);
                return;
            }
            if (job.assemblies && job.assemblies.length > 0) {
                this.updateAssemblies(job.assemblies, itemToUpdate, counter);
            }
        });
    }


    getData() {
        return this.workspace
    }

    loadData() {
        this.data = [];
        this.links = [];
        this.idCounter = 1;
        this.loadJobs();
        return {
            data: this.data,
            links: this.links
        };
    }
}


class WorkspaceScheduler {
    constructor() {
        this.workspace = null;
        this.workspaceSettings = null;
        this.allAssemblies = null;
        this.socket = null;
        this.gnattGraph = null;
    }

    async initialize() {
        this.workspace = await this.loadWorkspace();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        if (this.workspace && this.workspaceSettings) {
            this.loadGanttGraph();
            this.setupWebSocket();
        }
    }

    async reloadView() {
        this.workspace = await this.loadWorkspace();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        if (this.workspace && this.workspaceSettings) {
            this.allAssemblies = this.loadAllAssemblies();
            this.ganttGraph.jobs = this.workspace.jobs
            this.loadGanttGraph();
        }
    }

    loadAllAssemblies() {
        let allAssemblies = [];
        this.workspace.jobs.forEach(job => {
            allAssemblies = allAssemblies.concat(getAssemblies(job));
        });
        return allAssemblies;
    }

    loadGanttGraph() {
        if (!this.gnattGraph) {
            this.ganttGraph = new GanttGraph(this.workspace);
            this.ganttGraph.initialize();
        }
        this.ganttGraph.render();
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
        const response = await fetch('/production_planner_upload', {
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
        const workspaceBlob = new Blob([JSON.stringify(this.ganttGraph.getData())], { type: 'application/json' });
        formData.append('file', workspaceBlob, 'workspace.json');
        return formData;
    }

    setupWebSocket() {
        this.socket = new WebSocket(`ws://${window.location.host}/ws/web`);
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.action === 'download' && message.files.includes('workspace.json')) {
                console.log('Workspace update received. Reloading...');
                this.loadWorkspace().then(() => {
                    this.reloadView();
                });
            }
        };
    }
}

window.addEventListener('load', async function () {
    const workspaceScheduler = new WorkspaceScheduler();
    try {
        await workspaceScheduler.initialize(); // Wait for initialization to complete
    } catch (error) {
        console.error('Error initializing workspace:', error);
        alert('Error loading workspace. Please try again later.');
    }

    document.getElementById('submit-button').onclick = function (event) {
        event.preventDefault(); // Prevent the default form submission behavior
        workspaceScheduler.uploadWorkspace();
    };

    var radios = document.getElementsByName("scale");
    for (var i = 0; i < radios.length; i++) {
        radios[i].onclick = function (event) {
            gantt.ext.zoom.setLevel(event.target.value);
            workspaceScheduler.ganttGraph.lastViewMode = event.target.value;
        };
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

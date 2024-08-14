import {
    getAssemblies,
    isAssemblyComplete,
    isAssemblyPartsComplete,
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
    getColorForProcessTag,
    calculateAssemblyProgress,
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
        this.containerDiv = document.querySelector(this.container);
        this.heatmapCanvas = this.containerDiv.querySelector('#heatmap');
        this.processSelections = this.containerDiv.querySelector('#process-tags');

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
        const ctx = this.heatmapCanvas.getContext('2d');
        const MAX = 255;

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

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, config);

        this.containerDiv.querySelector('#min-value-display').textContent = ``;
        this.containerDiv.querySelector('#max-value-display').textContent = `Max: ${this.maxValue}m`;
    }
}

class AssembliesInProcessChart {
    constructor(workspace, workspaceArchives, workspaceSettings, container) {
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;
        this.container = container;

        this.containerDiv = null;

        this.barChartCanvas = null;
        this.dateRangePicker = null;
        this.useWorkspaceArchivesCheckbox = null;
        this.thisWeekButton = null;
        this.thisMonthButton = null;
        this.thisYearButton = null;

        this.currentProcess = null;
        this.chartInstance = null;

        this.useWorkspaceArchiveData = false;
        this.startDate = null;
        this.endDate = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);

        this.barChartCanvas = this.containerDiv.querySelector('#bar-chart');
        this.dateRangePicker = this.containerDiv.querySelector('#date-range-picker');
        this.processSelections = this.containerDiv.querySelector('#process-tags');
        this.useWorkspaceCheckbox = this.containerDiv.querySelector('#use-workspace-archives')
        this.thisWeekButton = this.containerDiv.querySelector("#this-week");
        this.thisMonthButton = this.containerDiv.querySelector("#this-month");
        this.thisYearButton = this.containerDiv.querySelector("#this-year");

        this.populateProcessSelections();
        this.setupDateRangePicker();

        this.currentProcess = this.processSelections.value;

        this.useWorkspaceCheckbox.addEventListener('click', () => {
            this.useWorkspaceArchiveData = this.useWorkspaceCheckbox.checked;
            this.loadChart()
        });

        this.thisWeekButton.addEventListener('click', () => {
            this.setThisWeek();
        });

        this.thisMonthButton.addEventListener('click', () => {
            this.setThisMonth();
        });

        this.thisYearButton.addEventListener('click', () => {
            this.setThisYear();
        });

        this.processSelections.addEventListener('change', () => {
            this.currentProcess = this.processSelections.value;
            this.loadChart();
        });
        this.setThisYear();
    }

    setDateRange(startDate, endDate) {
        this.dateRangePicker._flatpickr.setDate([startDate, endDate], true);
        this.startDate = startDate;
        this.endDate = endDate;
        this.loadChart()
    }

    setThisWeek() {
        const today = new Date();
        const dayOfWeek = today.getDay();

        const diffToStartOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - diffToStartOfWeek);

        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6);

        this.setDateRange(firstDay, lastDay);
    }

    setThisMonth() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.setDateRange(firstDay, lastDay);
    }

    setThisYear() {
        const thisYear = new Date().getFullYear();
        const firstDay = new Date(thisYear, 0, 1);
        const lastDay = new Date(thisYear, 11, 31);
        this.setDateRange(firstDay, lastDay);
    }

    setupDateRangePicker() {
        flatpickr(this.dateRangePicker, {
            mode: "range",
            theme: 'dark',
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
            locale: {
                firstDayOfWeek: 1
            },
            onClose: (selectedDates, dateStr, instance) => {
                const [startDate, endDate] = selectedDates;
                if (startDate && endDate) {
                    this.startDate = startDate;
                    this.endDate = endDate;
                    this.loadChart();
                }
            }
        });
    }

    populateProcessSelections() {
        this.processSelections.innerHTML = '';

        const everythingOption = document.createElement('option');
        everythingOption.textContent = 'Everything';
        this.processSelections.appendChild(everythingOption);

        const finishedOption = document.createElement('option');
        finishedOption.textContent = 'Finished';
        this.processSelections.appendChild(finishedOption);

        const uniqueTags = new Set();
        this.workspace.jobs.forEach(job => {
            getAssemblies(job).forEach(assembly => {
                assembly.assembly_data.flow_tag.tags.forEach(tag => {
                    uniqueTags.add(tag);
                });
            });
        });

        uniqueTags.forEach(tag => {
            const option = document.createElement('option');
            option.textContent = tag;
            this.processSelections.appendChild(option);
        });

        // Set the first option as selected if nothing else is selected
        if (this.workspaceSettings.tags.length > 0 && !this.currentProcess) {
            this.processSelections.value = 'Everything';
        }
    }

    getAllJobs() {
        let allJobs = [];
        if (this.workspace && this.workspace.jobs) {
            allJobs = [...this.workspace.jobs];
        }
        if (this.useWorkspaceArchiveData && this.workspaceArchives) {
            allJobs = [...allJobs, ...this.workspaceArchives];
        }
        return allJobs;
    }

    countAssembliesAtProcess(process) {
        const processCounts = {};
        const allJobs = this.getAllJobs();

        allJobs.forEach(job => {
            const jobStartDate = new Date(job.job_data.starting_date);
            const jobEndDate = new Date(job.job_data.ending_date);

            if ((jobStartDate >= this.startDate && jobStartDate <= this.endDate) ||
                (jobEndDate >= this.startDate && jobEndDate <= this.endDate) ||
                (jobStartDate <= this.startDate && jobEndDate >= this.endDate)) {

                getAssemblies(job).forEach(assembly => {
                    if (isAssemblyPartsComplete(assembly)) {
                        const currentIndex = assembly.assembly_data.current_flow_tag_index;
                        var currentProcess = assembly.assembly_data.flow_tag.tags[currentIndex];

                        if (currentProcess === undefined) {
                            currentProcess = "Finished";
                        }

                        if (process === 'Everything' || currentProcess === process) {
                            if (!processCounts[currentProcess]) {
                                processCounts[currentProcess] = 0;
                            }
                            processCounts[currentProcess]++;
                        }
                    }
                });
            }
        });

        return processCounts;
    }

    loadChart() {
        const ctx = this.barChartCanvas.getContext('2d');
        const processCounts = this.countAssembliesAtProcess(this.currentProcess);

        const labels = Object.keys(processCounts);
        const data = Object.values(processCounts);

        const backgroundColors = labels.map(label => getColorForProcessTag(label, Object.keys(this.workspaceSettings.tags)).backgroundColor);
        const borderColors = labels.map(label => getColorForProcessTag(label, Object.keys(this.workspaceSettings.tags)).borderColor);

        const chartData = {
            labels: labels,
            datasets: [{
                label: '# of Assemblies',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        };

        const config = {
            type: 'bar',
            data: chartData,
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, config);
    }
}

class SelectAssemblyChart {
    constructor(workspace, workspaceArchives, workspaceSettings, container) {
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;
        this.container = container;

        this.containerDiv = null;

        this.barChartCanvas = null;
        this.dateRangePicker = null;
        this.useWorkspaceArchivesCheckbox = null;
        this.thisWeekButton = null;
        this.thisMonthButton = null;
        this.thisYearButton = null;

        this.currentProcess = null;
        this.chartInstance = null;

        this.useWorkspaceArchiveData = false;
        this.startDate = null;
        this.endDate = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);

        this.barChartCanvas = this.containerDiv.querySelector('#bar-chart');
        this.dateRangePicker = this.containerDiv.querySelector('#date-range-picker');
        this.processSelections = this.containerDiv.querySelector('#process-tags');
        this.useWorkspaceCheckbox = this.containerDiv.querySelector('#use-workspace-archives')
        this.thisWeekButton = this.containerDiv.querySelector("#this-week");
        this.thisMonthButton = this.containerDiv.querySelector("#this-month");
        this.thisYearButton = this.containerDiv.querySelector("#this-year");

        this.populateProcessSelections();
        this.setupDateRangePicker();

        this.currentProcess = this.processSelections.value;

        this.useWorkspaceCheckbox.addEventListener('click', () => {
            this.useWorkspaceArchiveData = this.useWorkspaceCheckbox.checked;
            this.loadChart()
        });

        this.thisWeekButton.addEventListener('click', () => {
            this.setThisWeek();
        });

        this.thisMonthButton.addEventListener('click', () => {
            this.setThisMonth();
        });

        this.thisYearButton.addEventListener('click', () => {
            this.setThisYear();
        });

        this.processSelections.addEventListener('change', () => {
            this.currentProcess = this.processSelections.value;
            this.loadChart();
        });
        this.setThisYear();
    }

    setDateRange(startDate, endDate) {
        this.dateRangePicker._flatpickr.setDate([startDate, endDate], true);
        this.startDate = startDate;
        this.endDate = endDate;
        this.loadChart()
    }

    setThisWeek() {
        const today = new Date();
        const dayOfWeek = today.getDay();

        const diffToStartOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - diffToStartOfWeek);

        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6);

        this.setDateRange(firstDay, lastDay);
    }

    setThisMonth() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.setDateRange(firstDay, lastDay);
    }

    setThisYear() {
        const thisYear = new Date().getFullYear();
        const firstDay = new Date(thisYear, 0, 1);
        const lastDay = new Date(thisYear, 11, 31);
        this.setDateRange(firstDay, lastDay);
    }

    setupDateRangePicker() {
        flatpickr(this.dateRangePicker, {
            mode: "range",
            theme: 'dark',
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
            locale: {
                firstDayOfWeek: 1
            },
            onClose: (selectedDates, dateStr, instance) => {
                const [startDate, endDate] = selectedDates;
                if (startDate && endDate) {
                    this.startDate = startDate;
                    this.endDate = endDate;
                    this.loadChart();
                }
            }
        });
    }

    populateProcessSelections() {
        this.processSelections.innerHTML = '';

        const uniqueAssemblies = new Set();
        this.getAllJobs().forEach(job => {
            getAssemblies(job).forEach(assembly => {
                uniqueAssemblies.add(assembly.assembly_data.name);
            });
        });

        uniqueAssemblies.forEach(assemblyName => {
            const option = document.createElement('option');
            option.textContent = assemblyName;
            this.processSelections.appendChild(option);
        });

    }

    getAllJobs() {
        let allJobs = [];
        if (this.workspace && this.workspace.jobs) {
            allJobs = [...this.workspace.jobs];
        }
        if (this.useWorkspaceArchiveData && this.workspaceArchives) {
            allJobs = [...allJobs, ...this.workspaceArchives];
        }
        return allJobs;
    }

    countAssembliesAtProcess(assemblyName) {
        const processCounts = {};
        const allJobs = this.getAllJobs();

        allJobs.forEach(job => {
            const jobStartDate = new Date(job.job_data.starting_date);
            const jobEndDate = new Date(job.job_data.ending_date);

            if ((jobStartDate >= this.startDate && jobStartDate <= this.endDate) ||
                (jobEndDate >= this.startDate && jobEndDate <= this.endDate) ||
                (jobStartDate <= this.startDate && jobEndDate >= this.endDate)) {

                getAssemblies(job).forEach(assembly => {
                    if (assembly.assembly_data.name === assemblyName && isAssemblyPartsComplete(assembly)) {
                        const currentIndex = assembly.assembly_data.current_flow_tag_index;
                        var currentProcess = assembly.assembly_data.flow_tag.tags[currentIndex];

                        if (currentProcess === undefined) {
                            currentProcess = "Finished";
                        }

                        if (!processCounts[currentProcess]) {
                            processCounts[currentProcess] = 0;
                        }
                        processCounts[currentProcess]++;
                    }
                });
            }
        });

        return processCounts;
    }

    loadChart() {
        const ctx = this.barChartCanvas.getContext('2d');
        const processCounts = this.countAssembliesAtProcess(this.currentProcess);

        const labels = Object.keys(processCounts);
        const data = Object.values(processCounts);

        const backgroundColors = labels.map(label => getColorForProcessTag(label, Object.keys(this.workspaceSettings.tags)).backgroundColor);
        const borderColors = labels.map(label => getColorForProcessTag(label, Object.keys(this.workspaceSettings.tags)).borderColor);

        const chartData = {
            labels: labels,
            datasets: [{
                label: '# of Assemblies',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        };

        const config = {
            type: 'bar',
            data: chartData,
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, config);
    }

}

class AllAssembliesChart {
    constructor(workspace, workspaceArchives, workspaceSettings, container) {
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;
        this.container = container;

        this.containerDiv = null;

        this.barChartCanvas = null;
        this.dateRangePicker = null;
        this.useWorkspaceArchivesCheckbox = null;
        this.thisWeekButton = null;
        this.thisMonthButton = null;
        this.thisYearButton = null;

        this.currentProcess = null;
        this.chartInstance = null;

        this.useWorkspaceArchiveData = false;
        this.startDate = null;
        this.endDate = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);

        this.barChartCanvas = this.containerDiv.querySelector('#bar-chart');
        this.dateRangePicker = this.containerDiv.querySelector('#date-range-picker');
        this.useWorkspaceCheckbox = this.containerDiv.querySelector('#use-workspace-archives')
        this.thisWeekButton = this.containerDiv.querySelector("#this-week");
        this.thisMonthButton = this.containerDiv.querySelector("#this-month");
        this.thisYearButton = this.containerDiv.querySelector("#this-year");

        this.setupDateRangePicker();

        this.useWorkspaceCheckbox.addEventListener('click', () => {
            this.useWorkspaceArchiveData = this.useWorkspaceCheckbox.checked;
            this.loadChart()
        });

        this.thisWeekButton.addEventListener('click', () => {
            this.setThisWeek();
        });

        this.thisMonthButton.addEventListener('click', () => {
            this.setThisMonth();
        });

        this.thisYearButton.addEventListener('click', () => {
            this.setThisYear();
        });

        this.setThisYear();
    }

    setDateRange(startDate, endDate) {
        this.dateRangePicker._flatpickr.setDate([startDate, endDate], true);
        this.startDate = startDate;
        this.endDate = endDate;
        this.loadChart()
    }

    setThisWeek() {
        const today = new Date();
        const dayOfWeek = today.getDay();

        const diffToStartOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - diffToStartOfWeek);

        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6);

        this.setDateRange(firstDay, lastDay);
    }

    setThisMonth() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.setDateRange(firstDay, lastDay);
    }

    setThisYear() {
        const thisYear = new Date().getFullYear();
        const firstDay = new Date(thisYear, 0, 1);
        const lastDay = new Date(thisYear, 11, 31);
        this.setDateRange(firstDay, lastDay);
    }

    setupDateRangePicker() {
        flatpickr(this.dateRangePicker, {
            mode: "range",
            theme: 'dark',
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
            locale: {
                firstDayOfWeek: 1
            },
            onClose: (selectedDates, dateStr, instance) => {
                const [startDate, endDate] = selectedDates;
                if (startDate && endDate) {
                    this.startDate = startDate;
                    this.endDate = endDate;
                    this.loadChart();
                }
            }
        });
    }

    getAllJobs() {
        let allJobs = [];
        if (this.workspace && this.workspace.jobs) {
            allJobs = [...this.workspace.jobs];
        }
        if (this.useWorkspaceArchiveData && this.workspaceArchives) {
            allJobs = [...allJobs, ...this.workspaceArchives];
        }
        return allJobs;
    }

    countAssembliesByProcess() {
        const assemblyProcessCounts = {};
        const allJobs = this.getAllJobs();

        allJobs.forEach(job => {
            const jobStartDate = new Date(job.job_data.starting_date);
            const jobEndDate = new Date(job.job_data.ending_date);

            if ((jobStartDate >= this.startDate && jobStartDate <= this.endDate) ||
                (jobEndDate >= this.startDate && jobEndDate <= this.endDate) ||
                (jobStartDate <= this.startDate && jobEndDate >= this.endDate)) {

                getAssemblies(job).forEach(assembly => {
                    if (isAssemblyPartsComplete(assembly)) {
                        const assemblyName = assembly.assembly_data.name;
                        const currentIndex = assembly.assembly_data.current_flow_tag_index;
                        var currentProcess = assembly.assembly_data.flow_tag.tags[currentIndex];

                        if (currentProcess === undefined) {
                            currentProcess = "Finished";
                        }

                        if (!assemblyProcessCounts[assemblyName]) {
                            assemblyProcessCounts[assemblyName] = {};
                        }

                        if (!assemblyProcessCounts[assemblyName][currentProcess]) {
                            assemblyProcessCounts[assemblyName][currentProcess] = 0;
                        }

                        assemblyProcessCounts[assemblyName][currentProcess]++;
                    }
                });
            }
        });

        return assemblyProcessCounts;
    }

    loadChart() {
        const ctx = this.barChartCanvas.getContext('2d');
        const assemblyProcessCounts = this.countAssembliesByProcess();

        const labels = [];
        const datasetsMap = {};

        Object.keys(assemblyProcessCounts).forEach(assemblyName => {
            labels.push(assemblyName);

            Object.keys(assemblyProcessCounts[assemblyName]).forEach(processName => {
                const processColor = getColorForProcessTag(processName, Object.keys(this.workspaceSettings.tags));

                if (!datasetsMap[processName]) {
                    datasetsMap[processName] = {
                        label: processName,
                        data: [],
                        backgroundColor: processColor.backgroundColor,
                        borderColor: processColor.borderColor,
                        borderWidth: 1
                    };
                }

                datasetsMap[processName].data.push(assemblyProcessCounts[assemblyName][processName] || 0);
            });

            // Ensure that all other processes get a 0 value for this assembly
            Object.keys(datasetsMap).forEach(processName => {
                if (!assemblyProcessCounts[assemblyName][processName]) {
                    datasetsMap[processName].data.push(0);
                }
            });
        });

        // Convert the datasets map to an array
        const datasets = Object.values(datasetsMap);

        const chartData = {
            labels: labels,
            datasets: datasets
        };

        const config = {
            type: 'bar',
            data: chartData,
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    },
                    x: {
                        stacked: false
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => {
                                return tooltipItems[0].label;
                            },
                            label: (tooltipItem) => {
                                return `${tooltipItem.dataset.label}: ${tooltipItem.raw}`;
                            }
                        }
                    }
                }
            }
        };

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, config);
    }
}

class LaserCutPartsInProcessChart {
    constructor(workspace, workspaceArchives, workspaceSettings, container) {
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;
        this.container = container;

        this.containerDiv = null;
        this.barChartCanvas = null;

        this.dateRangePicker = null;
        this.useWorkspaceArchivesCheckbox = null;
        this.thisWeekButton = null;
        this.thisMonthButton = null;
        this.thisYearButton = null;

        this.currentProcess = null;
        this.chartInstance = null;

        this.useWorkspaceArchiveData = false;
        this.startDate = null;
        this.endDate = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);

        this.barChartCanvas = this.containerDiv.querySelector('#bar-chart');
        this.dateRangePicker = this.containerDiv.querySelector('#date-range-picker');
        this.processSelections = this.containerDiv.querySelector('#process-tags');
        this.useWorkspaceCheckbox = this.containerDiv.querySelector('#use-workspace-archives')
        this.thisWeekButton = this.containerDiv.querySelector("#this-week");
        this.thisMonthButton = this.containerDiv.querySelector("#this-month");
        this.thisYearButton = this.containerDiv.querySelector("#this-year");

        this.populateProcessSelections();
        this.setupDateRangePicker();

        this.currentProcess = this.processSelections.value;

        this.useWorkspaceCheckbox.addEventListener('click', () => {
            this.useWorkspaceArchiveData = this.useWorkspaceCheckbox.checked;
            this.loadChart()
        });

        this.thisWeekButton.addEventListener('click', () => {
            this.setThisWeek();
        });

        this.thisMonthButton.addEventListener('click', () => {
            this.setThisMonth();
        });

        this.thisYearButton.addEventListener('click', () => {
            this.setThisYear();
        });

        this.processSelections.addEventListener('change', () => {
            this.currentProcess = this.processSelections.value;
            this.loadChart();
        });
        this.setThisYear();
    }

    setDateRange(startDate, endDate) {
        this.dateRangePicker._flatpickr.setDate([startDate, endDate], true);
        this.startDate = startDate;
        this.endDate = endDate;
        this.loadChart()
    }

    setThisWeek() {
        const today = new Date();
        const dayOfWeek = today.getDay();

        const diffToStartOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - diffToStartOfWeek);

        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6);

        this.setDateRange(firstDay, lastDay);
    }

    setThisMonth() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.setDateRange(firstDay, lastDay);
    }

    setThisYear() {
        const thisYear = new Date().getFullYear();
        const firstDay = new Date(thisYear, 0, 1);
        const lastDay = new Date(thisYear, 11, 31);
        this.setDateRange(firstDay, lastDay);
    }

    setupDateRangePicker() {
        flatpickr(this.dateRangePicker, {
            mode: "range",
            theme: 'dark',
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
            locale: {
                firstDayOfWeek: 1
            },
            onClose: (selectedDates, dateStr, instance) => {
                const [startDate, endDate] = selectedDates;
                if (startDate && endDate) {
                    this.startDate = startDate;
                    this.endDate = endDate;
                    this.loadChart();
                }
            }
        });
    }

    populateProcessSelections() {
        this.processSelections.innerHTML = '';

        const everythingOption = document.createElement('option');
        everythingOption.textContent = 'Everything';
        this.processSelections.appendChild(everythingOption);

        const finishedOption = document.createElement('option');
        finishedOption.textContent = 'Finished';
        this.processSelections.appendChild(finishedOption);

        const uniqueTags = new Set();
        this.workspace.jobs.forEach(job => {
            getAssemblies(job).forEach(assembly => {
                assembly.laser_cut_parts.forEach(part => {
                    part.flow_tag.tags.forEach(tag => {
                        uniqueTags.add(tag);
                    });
                })
            });
        });

        uniqueTags.forEach(tag => {
            const option = document.createElement('option');
            option.textContent = tag;
            this.processSelections.appendChild(option);
        });

        // Set the first option as selected if nothing else is selected
        if (this.workspaceSettings.tags.length > 0 && !this.currentProcess) {
            this.processSelections.value = 'Everything';
        }
    }

    getAllJobs() {
        let allJobs = [];
        if (this.workspace && this.workspace.jobs) {
            allJobs = [...this.workspace.jobs];
        }
        if (this.useWorkspaceArchiveData && this.workspaceArchives) {
            allJobs = [...allJobs, ...this.workspaceArchives];
        }
        return allJobs;
    }

    countLaserCutPartsProcess(process) {
        const processCounts = {};
        const allJobs = this.getAllJobs();

        allJobs.forEach(job => {
            const jobStartDate = new Date(job.job_data.starting_date);
            const jobEndDate = new Date(job.job_data.ending_date);

            if ((jobStartDate >= this.startDate && jobStartDate <= this.endDate) ||
                (jobEndDate >= this.startDate && jobEndDate <= this.endDate) ||
                (jobStartDate <= this.startDate && jobEndDate >= this.endDate)) {

                getAssemblies(job).forEach(assembly => {
                    assembly.laser_cut_parts.forEach(part => {
                        const currentIndex = part.current_flow_tag_index;
                        var currentProcess = part.flow_tag.tags[currentIndex];

                        if (currentProcess === undefined) {
                            currentProcess = "Finished";
                        }

                        if (process === 'Everything' || currentProcess === process) {
                            if (!processCounts[currentProcess]) {
                                processCounts[currentProcess] = 0;
                            }
                            processCounts[currentProcess]++;
                        }
                    });
                });
            }
        });

        return processCounts;
    }

    loadChart() {
        const ctx = this.barChartCanvas.getContext('2d');
        const processCounts = this.countLaserCutPartsProcess(this.currentProcess);

        const labels = Object.keys(processCounts);
        const data = Object.values(processCounts);

        const backgroundColors = labels.map(label => getColorForProcessTag(label, Object.keys(this.workspaceSettings.tags)).backgroundColor);
        const borderColors = labels.map(label => getColorForProcessTag(label, Object.keys(this.workspaceSettings.tags)).borderColor);

        const chartData = {
            labels: labels,
            datasets: [{
                label: '# of Laser Cut Parts',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        };

        const config = {
            type: 'bar',
            data: chartData,
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, config);
    }
}

class AssemblyProgressionLayout{
    constructor(workspace, workspaceArchives, workspaceSettings, container) {
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;
        this.container = container;

        this.containerDiv = null;
        this.jobsList = null;

    }

    initialize(){
        this.containerDiv = document.querySelector(this.container);
        this.jobsList = this.containerDiv.querySelector('#jobs-list');
        this.loadView();
    }loadView() {
        this.jobsList.innerHTML = '';  // Clear the current content

        this.workspace.jobs.forEach(job => {
            const jobDetails = document.createElement('details');
            jobDetails.className = "bottom-margin"

            const jobSummary = document.createElement('summary');
            jobSummary.className = 'none';

            const jobArticle = document.createElement('article');
            jobArticle.className = 'small-round primary small-padding job-article';

            const jobNav = document.createElement('nav');
            const jobMaxDiv = document.createElement('div');
            jobMaxDiv.className = 'max';
            jobMaxDiv.textContent = `${job.job_data.name} #${job.job_data.order_number} - ${getJobCompletionProgress(job).toFixed(2) * 100}% complete`;

            const jobIcon = document.createElement('i');
            jobIcon.textContent = 'expand_more';

            jobNav.appendChild(jobMaxDiv);
            jobNav.appendChild(jobIcon);
            jobArticle.appendChild(jobNav);
            jobSummary.appendChild(jobArticle);
            jobDetails.appendChild(jobSummary);

            const assembliesContainer = document.createElement('article');
            assembliesContainer.className = 'grid padding no-margin assembly-container';

            getAssemblies(job).forEach(assembly => {
                const assemblyArticle = document.createElement('article');
                assemblyArticle.className = 's12 no-padding assembly-article';

                const assemblyGrid = document.createElement('div');
                assemblyGrid.className = '';

                const imageContainer = document.createElement('div');

                const assemblyImage = document.createElement('img');
                assemblyImage.className = 's6 responsive';
                assemblyImage.src = assembly.assembly_data.assembly_image;  // Replace with actual path
                imageContainer.appendChild(assemblyImage);

                assemblyGrid.appendChild(imageContainer);

                const textContainer = document.createElement('div');
                textContainer.className = 's6';

                const textPadding = document.createElement('div');
                textPadding.className = 'padding';

                const assemblyTitle = document.createElement('h5');
                assemblyTitle.textContent = assembly.assembly_data.name;
                textPadding.appendChild(assemblyTitle);

                const assemblyDescription = document.createElement('p');

                if (isAssemblyPartsComplete(assembly)) {
                    if (isAssemblyComplete(assembly)) {
                        assemblyDescription.textContent = "Assembly is finished";
                    } else {
                        assemblyDescription.textContent = `Current process: ${assembly.assembly_data.flow_tag.tags[assembly.assembly_data.current_flow_tag_index]}`;
                    }
                } else {
                    assemblyDescription.textContent = "Parts still pending";
                }

                textPadding.appendChild(assemblyDescription);

                const nav = document.createElement('nav');
                nav.className = 'scroll';

                assembly.assembly_data.flow_tag.tags.forEach((tag, index) => {
                    const processContainer = document.createElement('div');
                    processContainer.className = 'center-align';

                    const processButton = document.createElement('button');
                    processButton.className = 'circle small';

                    if (index < assembly.assembly_data.current_flow_tag_index) {
                        processButton.innerHTML = '<i>done</i>';
                        processContainer.appendChild(processButton);

                        const processLabel = document.createElement('div');
                        processLabel.className = 'small-margin';
                        processLabel.textContent = tag; // Replace with 'Previous' or tag name
                        processContainer.appendChild(processLabel);
                    } else if (index === assembly.assembly_data.current_flow_tag_index) {
                        processButton.textContent = (index + 1).toString();
                        processContainer.appendChild(processButton);

                        const processLabel = document.createElement('div');
                        processLabel.className = 'small-margin';
                        if (isAssemblyPartsComplete(assembly)){
                            processLabel.textContent = 'Current'; // Replace with 'Current' or tag name
                        }else{
                            processLabel.textContent = tag;
                            processButton.disabled = true;
                        }
                        processContainer.appendChild(processLabel);
                    } else {
                        processButton.textContent = (index + 1).toString();
                        processButton.disabled = true;
                        processContainer.appendChild(processButton);

                        const processLabel = document.createElement('div');
                        processLabel.className = 'small-margin';
                        processLabel.textContent = tag; // Replace with 'Next' or tag name
                        processContainer.appendChild(processLabel);
                    }

                    nav.appendChild(processContainer);

                    if (index < assembly.assembly_data.flow_tag.tags.length - 1) {
                        const hr = document.createElement('hr');
                        hr.className = 'max';
                        nav.appendChild(hr);
                    }
                });

                textPadding.appendChild(nav);

                const progressContainer = document.createElement("div")
                progressContainer.className = "padding row";

                const progress = document.createElement('progress');
                progress.value = getAssemblyCompletionProgress(assembly).toFixed(2) * 100;
                progress.max = 100;
                progressContainer.appendChild(progress);

                const assemblySteps = calculateAssemblyProgress(assembly);
                const assemblyStepsText = document.createElement('p');
                assemblyStepsText.textContent = `${assemblySteps.currentSteps}/${assemblySteps.totalSteps}`;
                progressContainer.appendChild(assemblyStepsText);

                textContainer.appendChild(textPadding);
                textContainer.appendChild(progressContainer);
                assemblyGrid.appendChild(textContainer);

                assemblyArticle.appendChild(assemblyGrid);
                assembliesContainer.appendChild(assemblyArticle);
            });

            jobDetails.appendChild(assembliesContainer);
            this.jobsList.appendChild(jobDetails);
        });
    }

}

class WorkspaceDashboard {
    constructor() {
        // Data
        this.workspace = null;
        this.workspaceArchives = null;
        this.workspaceSettings = null;
        this.productionPlan = null

        // Graphs
        this.productionPlanHeatMap = null;
        this.workspaceHeatmap = null;

        this.assemblyInProcessChart1 = null;
        this.assemblyInProcessChart2 = null;
        this.assemblyInProcessChart3 = null;

        this.selectAssemblyChart1 = null;
        this.selectAssemblyChart2 = null;

        this.allAssembliesChart1 = null;

        this.laserCutPartsChart1 = null;
        this.laserCutPartsChart2 = null;

        // Dialogs
        this.assemblyProgressionLayout = null;

        // Web socket
        this.socket = null;
    }

    async initialize() {
        this.workspace = await this.loadWorkspace();
        this.workspaceArchives = await this.loadWorkspaceArchives();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        this.productionPlan = await this.loadProductionPlan();
        if (this.workspace && this.workspaceArchives && this.workspaceSettings && this.productionPlan) {
            // this.loadWorkspaceContents();
            this.loadLaserCutPartsInProcessCharts();
            this.loadAssembliesInProcessCharts();
            this.loadAssemblyCharts();
            this.loadProductionPlanHeatmap();
            this.loadWorkspaceHeatmap();
            this.loadLayouts();
            this.setupWebSocket();
        }
    }

    async reloadView() {
        this.workspace = await this.loadWorkspace();
        this.workspaceArchives = await this.loadWorkspaceArchives();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        this.productionPlan = await this.loadProductionPlan();
        if (this.workspace && this.workspaceArchives && this.workspaceSettings && this.productionPlan) {
            this.loadLaserCutPartsInProcessCharts();
            this.loadAssembliesInProcessCharts();
            this.loadAssemblyCharts();
            this.loadProductionPlanHeatmap();
            this.loadWorkspaceHeatmap();
            this.loadLayouts();
        }
    }

    loadLayouts(){
        if (!this.assemblyProgressionLayout) {
            this.assemblyProgressionLayout = new AssemblyProgressionLayout(this.workspace, this.workspaceArchives, this.workspaceSettings, '#assembly-progression-container');
            this.assemblyProgressionLayout.initialize();
        } else {
            this.assemblyProgressionLayout.loadView();
        }
    }

    loadProductionPlanHeatmap() {
        if (!this.productionPlanHeatMap) {
            this.productionPlanHeatMap = new HeatMap(this.productionPlan, this.workspaceSettings, '#production-plan-heatmap-container');
            this.productionPlanHeatMap.initialize();
        } else {
            this.productionPlanHeatMap.loadHeatMap();
        }
    }

    loadWorkspaceHeatmap() {
        if (!this.workspaceHeatmap) {
            this.workspaceHeatmap = new HeatMap(this.workspace, this.workspaceSettings, '#workspace-heatmap-container');
            this.workspaceHeatmap.initialize();
        } else {
            this.workspaceHeatmap.loadChart();
        }
    }

    loadAssemblyCharts() {
        if (!this.selectAssemblyChart1) {
            this.selectAssemblyChart1 = new SelectAssemblyChart(this.workspace, this.workspaceArchives, this.workspaceSettings, '#select-assembly-chart-container-1');
            this.selectAssemblyChart1.initialize();
        } else {
            this.selectAssemblyChart1.loadChart();
        }
        if (!this.selectAssemblyChart2) {
            this.selectAssemblyChart2 = new SelectAssemblyChart(this.workspace, this.workspaceArchives, this.workspaceSettings, '#select-assembly-chart-container-2');
            this.selectAssemblyChart2.initialize();
        } else {
            this.selectAssemblyChart2.loadChart();
        }
        if (!this.allAssembliesChart1) {
            this.allAssembliesChart1 = new AllAssembliesChart(this.workspace, this.workspaceArchives, this.workspaceSettings, '#all-assemblies-chart-container-1');
            this.allAssembliesChart1.initialize();
        } else {
            this.allAssembliesChart1.loadChart();
        }
    }

    loadAssembliesInProcessCharts() {
        if (!this.assemblyInProcessChart1) {
            this.assemblyInProcessChart1 = new AssembliesInProcessChart(this.workspace, this.workspaceArchives, this.workspaceSettings, '#assemblies-in-process-chart-container-1');
            this.assemblyInProcessChart1.initialize();
        } else {
            this.assemblyInProcessChart1.loadChart();
        }
        if (!this.assemblyInProcessChar2) {
            this.assemblyInProcessChart2 = new AssembliesInProcessChart(this.workspace, this.workspaceArchives, this.workspaceSettings, '#assemblies-in-process-chart-container-2');
            this.assemblyInProcessChart2.initialize();
        } else {
            this.assemblyInProcessChart2.loadChart();
        }
        if (!this.assemblyInProcessChar3) {
            this.assemblyInProcessChart3 = new AssembliesInProcessChart(this.workspace, this.workspaceArchives, this.workspaceSettings, '#assemblies-in-process-chart-container-3');
            this.assemblyInProcessChart3.initialize();
        } else {
            this.assemblyInProcessChart3.loadChart();
        }
    }

    loadLaserCutPartsInProcessCharts() {
        if (!this.laserCutPartsChart1) {
            this.laserCutPartsChart1 = new LaserCutPartsInProcessChart(this.workspace, this.workspaceArchives, this.workspaceSettings, '#laser-cut-parts-in-process-chart-container-1');
            this.laserCutPartsChart1.initialize();
        } else {
            this.laserCutPartsChart1.loadChart();
        }
        if (!this.laserCutPartsChart2) {
            this.laserCutPartsChart2 = new LaserCutPartsInProcessChart(this.workspace, this.workspaceArchives, this.workspaceSettings, '#laser-cut-parts-in-process-chart-container-2');
            this.laserCutPartsChart2.initialize();
        } else {
            this.laserCutPartsChart2.loadChart();
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

    async loadWorkspaceArchives() {
        try {
            const response = await fetch('/data/workspace_archives');
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
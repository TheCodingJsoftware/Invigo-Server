import "beercss";
import flatpickr from 'flatpickr';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
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
    savePreference,
    getPreference,
} from './utils.js';
Chart.register(...registerables);
Chart.register(MatrixController, MatrixElement);

class Accordion {
    constructor(delailElement) {
        this.detailElement = delailElement;

        this.summary = this.detailElement.querySelector("summary");
        this.content = this.detailElement.querySelector(".assembly-container");
        this.jobArticle = this.detailElement.querySelector('.job-article');

        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;

        this.summary.addEventListener("click", (e) => this.onClick(e));
    }

    onClick(e) {
        e.preventDefault();
        this.detailElement.style.overflow = "hidden";
        if (this.isClosing || !this.detailElement.open) {
            this.open();
        } else if (this.isExpanding || this.detailElement.open) {
            this.shrink();
        }
    }

    shrink() {
        this.isClosing = true;
        this.jobArticle.classList.remove("primary");

        const startHeight = `${this.detailElement.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.detailElement.animate(
            {
                height: [startHeight, endHeight],
            },
            {
                duration: 300,
                easing: "ease-in-out",
            }
        );

        this.animation.onfinish = () => this.onAnimationFinish(false);
        this.animation.oncancel = () => (this.isClosing = false);
    }

    open() {
        this.detailElement.style.height = `${this.detailElement.offsetHeight}px`;
        this.detailElement.open = true;
        window.requestAnimationFrame(() => this.expand());
    }

    expand() {
        this.jobArticle.classList.add("primary");
        this.isExpanding = true;
        const startHeight = `${this.detailElement.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight + this.content.offsetHeight
            }px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.detailElement.animate(
            {
                height: [startHeight, endHeight],
            },
            {
                duration: 300,
                easing: "ease-in-out",
            }
        );
        this.animation.onfinish = () => this.onAnimationFinish(true);
        this.animation.oncancel = () => (this.isExpanding = false);
    }

    onAnimationFinish(open) {
        this.detailElement.open = open;
        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.detailElement.style.height = this.detailElement.style.overflow = "";
    }
}

class HeatMap {
    constructor(container, productionPlan, workspaceSettings) {
        this.container = container;
        this.productionPlan = productionPlan;
        this.workspaceSettings = workspaceSettings;
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

        this.processSelections.value = getPreference(this.container, 'lastSelectedProcess', { 'value': 'Everything' }).value;

        this.processSelections.addEventListener('change', () => {
            this.currentProcess = this.processSelections.value;
            savePreference(this.container, 'lastSelectedProcess', this.currentProcess);
            this.loadHeatMap();
        });

        this.currentProcess = this.processSelections.value;
        this.loadHeatMap();
    }

    populateProcessSelections() {
        this.processSelections.innerHTML = '';
        const everythingOption = document.createElement('option');
        everythingOption.textContent = "Everything";
        this.processSelections.appendChild(everythingOption);

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
                    if (this.currentProcess === "Everything") {
                        Object.keys(flowtag_timeline).forEach(tagName => {
                            const tag = flowtag_timeline[tagName]
                            const tagStartDate = new Date(tag.starting_date);
                            const tagEndDate = new Date(tag.ending_date);
                            const durationDays = (tagEndDate - tagStartDate) / (1000 * 60 * 60 * 24);
                            const processExpectedTimeSeconds = (getPartProcessExpectedTimeToComplete(job, tagName) + getAssemblyProcessExpectedTimeToComplete(job, tagName)); // seconds
                            if (tagStartDate <= currentDate && currentDate <= tagEndDate) {
                                totalHourCount += processExpectedTimeSeconds / durationDays / 60;
                            }
                        });
                    } else if (flowtag_timeline.hasOwnProperty(this.currentProcess)) {
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
    constructor(container, workspace, workspaceArchives, workspaceSettings) {
        this.container = container;
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;

        this.containerDiv = null;

        this.barChartCanvas = null;
        this.dateRangePicker = null;
        this.useWorkspaceArchivesCheckbox = null;
        this.thisWeekButton = null;
        this.thisMonthButton = null;
        this.thisYearButton = null;

        this.currentProcess = null;
        this.chartInstance = null;

        this.useWorkspaceArchiveData = null;
        this.startDate = null;
        this.endDate = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);

        this.barChartCanvas = this.containerDiv.querySelector('#bar-chart');
        this.dateRangePicker = this.containerDiv.querySelector('#date-range-picker');
        this.processSelections = this.containerDiv.querySelector('#process-tags');
        this.useWorkspaceArchivesCheckbox = this.containerDiv.querySelector('#use-workspace-archives')
        this.thisWeekButton = this.containerDiv.querySelector("#this-week");
        this.thisMonthButton = this.containerDiv.querySelector("#this-month");
        this.thisYearButton = this.containerDiv.querySelector("#this-year");

        const uniqueName = `radio-group-${this.container}`;
        const radioButtons = this.containerDiv.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.name = uniqueName;
        });

        this.populateProcessSelections();

        this.useWorkspaceArchivesCheckbox.checked = getPreference(this.container, 'useWorkspaceArchives', { 'value': false }).value;
        this.processSelections.value = getPreference(this.container, 'lastSelectedProcess', { 'value': 'Everything' }).value;

        this.setupDateRangePicker();

        this.currentProcess = this.processSelections.value;
        this.useWorkspaceArchiveData = this.useWorkspaceArchivesCheckbox.checked;

        const rangeSelection = getPreference(this.container, "rangeSelection", {
            'thisWeek': false,
            'thisMonth': false,
            'thisYear': true
        });

        if (rangeSelection.value) {
            if (rangeSelection.value.thisWeek !== undefined) {
                this.thisWeekButton.checked = rangeSelection.value.thisWeek;
            }
            if (rangeSelection.value.thisMonth !== undefined) {
                this.thisMonthButton.checked = rangeSelection.value.thisMonth;
            }
            if (rangeSelection.value.thisYear !== undefined) {
                this.thisYearButton.checked = rangeSelection.value.thisYear;
            }
        } else {
            this.thisYearButton.checked = true; // Default
        }

        this.useWorkspaceArchivesCheckbox.addEventListener('click', () => {
            this.useWorkspaceArchiveData = this.useWorkspaceArchivesCheckbox.checked;
            savePreference(this.container, 'useWorkspaceArchives', this.useWorkspaceArchiveData);
            this.loadChart();
        });

        this.thisWeekButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisWeek();
        });

        this.thisMonthButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisMonth();
        });

        this.thisYearButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisYear();
        });

        this.processSelections.addEventListener('change', () => {
            this.currentProcess = this.processSelections.value;
            savePreference(this.container, 'lastSelectedProcess', this.currentProcess);
            this.loadChart();
        });

        try {
            this.startDate = new Date(getPreference(this.container, "startDate", null).value);
            this.endDate = new Date(getPreference(this.container, "endDate", null).value);
            if (this.startDate && this.endDate) {
                this.setDateRange(this.startDate, this.endDate)
            } else {
                this.loadRange();
            }
        } catch (error) {
            this.loadRange();
        }
    }

    loadRange() {
        if (this.thisWeekButton.checked) {
            this.setThisWeek();
        } else if (this.thisMonthButton.checked) {
            this.setThisMonth();
        } else {
            this.setThisYear();
        }
    }

    setDateRange(startDate, endDate) {
        this.dateRangePicker._flatpickr.setDate([startDate, endDate], true);
        this.startDate = startDate;
        this.endDate = endDate;
        savePreference(this.container, 'startDate', this.startDate)
        savePreference(this.container, 'endDate', this.endDate)
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
                    savePreference(this.container, 'startDate', this.startDate)
                    savePreference(this.container, 'endDate', this.endDate)
                    savePreference(this.container, "rangeSelection", {
                        'thisWeek': false,
                        'thisMonth': false,
                        'thisYear': false,
                    });
                    this.thisWeekButton.checked = false;
                    this.thisMonthButton.checked = false;
                    this.thisYearButton.checked = false;
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
    constructor(container, workspace, workspaceArchives, workspaceSettings) {
        this.container = container;
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;

        this.containerDiv = null;

        this.barChartCanvas = null;
        this.dateRangePicker = null;
        this.useWorkspaceArchivesCheckbox = null;
        this.thisWeekButton = null;
        this.thisMonthButton = null;
        this.thisYearButton = null;

        this.currentAssembly = null;
        this.chartInstance = null;

        this.useWorkspaceArchiveData = null;
        this.startDate = null;
        this.endDate = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);

        this.barChartCanvas = this.containerDiv.querySelector('#bar-chart');
        this.dateRangePicker = this.containerDiv.querySelector('#date-range-picker');
        this.assemblySelections = this.containerDiv.querySelector('#assembly-selection');
        this.useWorkspaceArchivesCheckbox = this.containerDiv.querySelector('#use-workspace-archives')
        this.thisWeekButton = this.containerDiv.querySelector("#this-week");
        this.thisMonthButton = this.containerDiv.querySelector("#this-month");
        this.thisYearButton = this.containerDiv.querySelector("#this-year");

        const uniqueName = `radio-group-${this.container}`;
        const radioButtons = this.containerDiv.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.name = uniqueName;
        });

        this.populateAssemblySelections();

        this.useWorkspaceArchivesCheckbox.checked = getPreference(this.container, 'useWorkspaceArchives', { 'value': false }).value;
        const lastSelectedAssembly = getPreference(this.container, 'lastSelectedAssembly', { 'value': null }).value
        if (lastSelectedAssembly) {
            this.assemblySelections.value = lastSelectedAssembly;
        }
        this.setupDateRangePicker();

        this.currentAssembly = this.assemblySelections.value;
        this.useWorkspaceArchiveData = this.useWorkspaceArchivesCheckbox.checked;

        const rangeSelection = getPreference(this.container, "rangeSelection", {
            'thisWeek': false,
            'thisMonth': false,
            'thisYear': true
        });

        if (rangeSelection.value) {
            if (rangeSelection.value.thisWeek !== undefined) {
                this.thisWeekButton.checked = rangeSelection.value.thisWeek;
            }
            if (rangeSelection.value.thisMonth !== undefined) {
                this.thisMonthButton.checked = rangeSelection.value.thisMonth;
            }
            if (rangeSelection.value.thisYear !== undefined) {
                this.thisYearButton.checked = rangeSelection.value.thisYear;
            }
        } else {
            this.thisYearButton.checked = true; // Default
        }

        this.useWorkspaceArchivesCheckbox.addEventListener('click', () => {
            this.useWorkspaceArchiveData = this.useWorkspaceArchivesCheckbox.checked;
            savePreference(this.container, 'useWorkspaceArchives', this.useWorkspaceArchiveData);
            this.loadChart();
        });

        this.thisWeekButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisWeek();
        });

        this.thisMonthButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisMonth();
        });

        this.thisYearButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisYear();
        });

        this.assemblySelections.addEventListener('change', () => {
            this.currentAssembly = this.assemblySelections.value;
            savePreference(this.container, "lastSelectedAssembly", this.currentAssembly)
            this.loadChart();
        });

        try {
            this.startDate = new Date(getPreference(this.container, "startDate", null).value);
            this.endDate = new Date(getPreference(this.container, "endDate", null).value);
            if (this.startDate && this.endDate) {
                this.setDateRange(this.startDate, this.endDate)
            } else {
                this.loadRange();
            }
        } catch (error) {
            this.loadRange()
        }
    }

    loadRange() {
        if (this.thisWeekButton.checked) {
            this.setThisWeek();
        } else if (this.thisMonthButton.checked) {
            this.setThisMonth();
        } else {
            this.setThisYear();
        }
    }

    setDateRange(startDate, endDate) {
        this.dateRangePicker._flatpickr.setDate([startDate, endDate], true);
        this.startDate = startDate;
        this.endDate = endDate;
        savePreference(this.container, 'startDate', this.startDate)
        savePreference(this.container, 'endDate', this.endDate)
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
                    savePreference(this.container, 'startDate', this.startDate)
                    savePreference(this.container, 'endDate', this.endDate)
                    savePreference(this.container, "rangeSelection", {
                        'thisWeek': false,
                        'thisMonth': false,
                        'thisYear': false,
                    });
                    this.thisWeekButton.checked = false;
                    this.thisMonthButton.checked = false;
                    this.thisYearButton.checked = false;
                    this.loadChart();
                }
            }
        });
    }

    populateAssemblySelections() {
        this.assemblySelections.innerHTML = '';

        const uniqueAssemblies = new Set();
        this.getAllJobs().forEach(job => {
            getAssemblies(job).forEach(assembly => {
                uniqueAssemblies.add(assembly.assembly_data.name);
            });
        });

        uniqueAssemblies.forEach(assemblyName => {
            const option = document.createElement('option');
            option.textContent = assemblyName;
            this.assemblySelections.appendChild(option);
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
        const processCounts = this.countAssembliesAtProcess(this.currentAssembly);

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
    constructor(container, workspace, workspaceArchives, workspaceSettings) {
        this.container = container;
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;

        this.containerDiv = null;

        this.barChartCanvas = null;
        this.dateRangePicker = null;
        this.useWorkspaceArchivesCheckbox = null;
        this.thisWeekButton = null;
        this.thisMonthButton = null;
        this.thisYearButton = null;

        this.currentProcess = null;
        this.chartInstance = null;

        this.useWorkspaceArchiveData = null;
        this.startDate = null;
        this.endDate = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);

        this.barChartCanvas = this.containerDiv.querySelector('#bar-chart');
        this.dateRangePicker = this.containerDiv.querySelector('#date-range-picker');
        this.useWorkspaceArchivesCheckbox = this.containerDiv.querySelector('#use-workspace-archives')
        this.thisWeekButton = this.containerDiv.querySelector("#this-week");
        this.thisMonthButton = this.containerDiv.querySelector("#this-month");
        this.thisYearButton = this.containerDiv.querySelector("#this-year");

        this.useWorkspaceArchivesCheckbox.checked = getPreference(this.container, 'useWorkspaceArchives', { 'value': false }).value;

        const uniqueName = `radio-group-${this.container}`;
        const radioButtons = this.containerDiv.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.name = uniqueName;
        });

        this.setupDateRangePicker();

        this.useWorkspaceArchiveData = this.useWorkspaceArchivesCheckbox.checked;

        const rangeSelection = getPreference(this.container, "rangeSelection", {
            'thisWeek': false,
            'thisMonth': false,
            'thisYear': true
        });

        if (rangeSelection.value) {
            if (rangeSelection.value.thisWeek !== undefined) {
                this.thisWeekButton.checked = rangeSelection.value.thisWeek;
            }
            if (rangeSelection.value.thisMonth !== undefined) {
                this.thisMonthButton.checked = rangeSelection.value.thisMonth;
            }
            if (rangeSelection.value.thisYear !== undefined) {
                this.thisYearButton.checked = rangeSelection.value.thisYear;
            }
        } else {
            this.thisYearButton.checked = true; // Default
        }

        this.useWorkspaceArchivesCheckbox.addEventListener('click', () => {
            this.useWorkspaceArchiveData = this.useWorkspaceArchivesCheckbox.checked;
            savePreference(this.container, 'useWorkspaceArchives', this.useWorkspaceArchiveData);
            this.loadChart();
        });

        this.thisWeekButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisWeek();
        });

        this.thisMonthButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisMonth();
        });

        this.thisYearButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisYear();
        });

        try {
            this.startDate = new Date(getPreference(this.container, "startDate", null).value);
            this.endDate = new Date(getPreference(this.container, "endDate", null).value);
            if (this.startDate && this.endDate) {
                this.setDateRange(this.startDate, this.endDate)
            } else {
                this.loadRange();
            }
        } catch (error) {
            this.loadRange()
        }
    }

    loadRange() {
        if (this.thisWeekButton.checked) {
            this.setThisWeek();
        } else if (this.thisMonthButton.checked) {
            this.setThisMonth();
        } else {
            this.setThisYear();
        }
    }

    setDateRange(startDate, endDate) {
        this.dateRangePicker._flatpickr.setDate([startDate, endDate], true);
        this.startDate = startDate;
        this.endDate = endDate;
        savePreference(this.container, 'startDate', this.startDate)
        savePreference(this.container, 'endDate', this.endDate)
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
                    savePreference(this.container, 'startDate', this.startDate)
                    savePreference(this.container, 'endDate', this.endDate)
                    savePreference(this.container, "rangeSelection", {
                        'thisWeek': false,
                        'thisMonth': false,
                        'thisYear': false,
                    });
                    this.thisWeekButton.checked = false;
                    this.thisMonthButton.checked = false;
                    this.thisYearButton.checked = false;
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
    constructor(container, workspace, workspaceArchives, workspaceSettings) {
        this.container = container;
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;

        this.containerDiv = null;
        this.barChartCanvas = null;

        this.dateRangePicker = null;
        this.useWorkspaceArchivesCheckbox = null;
        this.thisWeekButton = null;
        this.thisMonthButton = null;
        this.thisYearButton = null;

        this.currentProcess = null;
        this.chartInstance = null;

        this.useWorkspaceArchiveData = null;
        this.startDate = null;
        this.endDate = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);

        this.barChartCanvas = this.containerDiv.querySelector('#bar-chart');
        this.dateRangePicker = this.containerDiv.querySelector('#date-range-picker');
        this.processSelections = this.containerDiv.querySelector('#process-tags');
        this.useWorkspaceArchivesCheckbox = this.containerDiv.querySelector('#use-workspace-archives')
        this.thisWeekButton = this.containerDiv.querySelector("#this-week");
        this.thisMonthButton = this.containerDiv.querySelector("#this-month");
        this.thisYearButton = this.containerDiv.querySelector("#this-year");

        const uniqueName = `radio-group-${this.container}`;
        const radioButtons = this.containerDiv.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.name = uniqueName;
        });

        this.populateProcessSelections();

        this.useWorkspaceArchivesCheckbox.checked = getPreference(this.container, 'useWorkspaceArchives', { 'value': false }).value;
        this.processSelections.value = getPreference(this.container, 'lastSelectedProcess', { 'value': 'Everything' }).value;

        this.setupDateRangePicker();

        this.currentProcess = this.processSelections.value;
        this.useWorkspaceArchiveData = this.useWorkspaceArchivesCheckbox.checked;

        const rangeSelection = getPreference(this.container, "rangeSelection", {
            'thisWeek': false,
            'thisMonth': false,
            'thisYear': true
        });

        if (rangeSelection.value) {
            if (rangeSelection.value.thisWeek !== undefined) {
                this.thisWeekButton.checked = rangeSelection.value.thisWeek;
            }
            if (rangeSelection.value.thisMonth !== undefined) {
                this.thisMonthButton.checked = rangeSelection.value.thisMonth;
            }
            if (rangeSelection.value.thisYear !== undefined) {
                this.thisYearButton.checked = rangeSelection.value.thisYear;
            }
        } else {
            this.thisYearButton.checked = true; // Default
        }

        this.useWorkspaceArchivesCheckbox.addEventListener('click', () => {
            this.useWorkspaceArchiveData = this.useWorkspaceArchivesCheckbox.checked;
            savePreference(this.container, 'useWorkspaceArchives', this.useWorkspaceArchiveData);
            this.loadChart();
        });

        this.thisWeekButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisWeek();
        });

        this.thisMonthButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisMonth();
        });

        this.thisYearButton.addEventListener('click', () => {
            savePreference(this.container, "rangeSelection", {
                'thisWeek': this.thisWeekButton.checked,
                'thisMonth': this.thisMonthButton.checked,
                'thisYear': this.thisYearButton.checked,
            });
            this.setThisYear();
        });

        this.processSelections.addEventListener('change', () => {
            this.currentProcess = this.processSelections.value;
            savePreference(this.container, "lastSelectedProcess", this.currentProcess);
            this.loadChart();
        });

        try {
            this.startDate = new Date(getPreference(this.container, "startDate", null).value);
            this.endDate = new Date(getPreference(this.container, "endDate", null).value);
            if (this.startDate && this.endDate) {
                this.setDateRange(this.startDate, this.endDate)
            } else {
                this.loadRange();
            }
        } catch (error) {
            this.loadRange()
        }
    }

    loadRange() {
        if (this.thisWeekButton.checked) {
            this.setThisWeek();
        } else if (this.thisMonthButton.checked) {
            this.setThisMonth();
        } else {
            this.setThisYear();
        }
    }
    setDateRange(startDate, endDate) {
        this.dateRangePicker._flatpickr.setDate([startDate, endDate], true);
        this.startDate = startDate;
        this.endDate = endDate;
        savePreference(this.container, 'startDate', this.startDate)
        savePreference(this.container, 'endDate', this.endDate)
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
                    savePreference(this.container, 'startDate', this.startDate)
                    savePreference(this.container, 'endDate', this.endDate)
                    savePreference(this.container, "rangeSelection", {
                        'thisWeek': false,
                        'thisMonth': false,
                        'thisYear': false,
                    });
                    this.thisWeekButton.checked = false;
                    this.thisMonthButton.checked = false;
                    this.thisYearButton.checked = false;
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

class ActivityPage{
    constructor(container, workspace, workspaceArchives, workspaceSettings) {
        this.container = container;
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;

        this.containerDiv = null;
        this.jobsList = null;
    }

    initialize() {
        this.containerDiv = document.querySelector(this.container);
        this.jobsList = this.containerDiv.querySelector('#jobs-list');
        this.loadView();
    }

    loadView() {
        this.jobsList.innerHTML = '';  // Clear the current content

        this.workspace.jobs.forEach(job => {
            const jobDetails = document.createElement('details');
            jobDetails.className = "bottom-margin job-details"

            const jobSummary = document.createElement('summary');
            jobSummary.className = 'none';

            const jobArticle = document.createElement('article');
            jobArticle.className = 'small-round small-padding job-article';

            const jobCompletionProgress = getJobCompletionProgress(job).toFixed(2) * 100;
            const jobProgress = document.createElement('progress');
            jobProgress.className = "max";
            jobProgress.max = 100;
            jobProgress.value = jobCompletionProgress;
            jobArticle.appendChild(jobProgress)

            const jobNav = document.createElement('nav');
            jobNav.className = "no-margin";
            const jobMaxDiv = document.createElement('div');
            jobMaxDiv.className = 'max';
            jobMaxDiv.textContent = `${job.job_data.name} #${job.job_data.order_number} - ${jobCompletionProgress}% complete`;

            const jobIcon = document.createElement('i');
            jobIcon.textContent = 'expand_more';

            jobNav.appendChild(jobMaxDiv);
            jobNav.appendChild(jobIcon);
            jobArticle.appendChild(jobNav);
            jobSummary.appendChild(jobArticle);
            jobDetails.appendChild(jobSummary);

            const assembliesContainer = document.createElement('article');
            assembliesContainer.className = 'padding no-margin assembly-container no-shadow';

            getAssemblies(job).forEach(assembly => {
                const assemblyArticle = document.createElement('article');
                assemblyArticle.className = 'no-padding assembly-article';

                const assemblyGrid = document.createElement('div');
                assemblyGrid.className = 'row';

                const imageContainer = document.createElement('div');

                const assemblyImage = document.createElement('img');
                assemblyImage.className = 'responsive small-round';
                assemblyImage.style = "max-height: 12rem;"
                assemblyImage.src = assembly.assembly_data.assembly_image;  // Replace with actual path
                imageContainer.appendChild(assemblyImage);

                assemblyGrid.appendChild(imageContainer);

                const textContainer = document.createElement('div');
                textContainer.className = 'max';

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
                        if (isAssemblyPartsComplete(assembly)) {
                            processLabel.textContent = 'Current'; // Replace with 'Current' or tag name
                        } else {
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

                // const progressContainer = document.createElement("div")
                // progressContainer.className = "padding row";

                // const progress = document.createElement('progress');
                // progress.value = getAssemblyCompletionProgress(assembly).toFixed(2) * 100;
                // progress.max = 100;
                // progressContainer.appendChild(progress);

                // const assemblySteps = calculateAssemblyProgress(assembly);
                // const assemblyStepsText = document.createElement('p');
                // assemblyStepsText.textContent = `${assemblySteps.currentSteps}/${assemblySteps.totalSteps}`;
                // progressContainer.appendChild(assemblyStepsText);
                // textPadding.appendChild(progressContainer);

                textContainer.appendChild(textPadding);
                assemblyGrid.appendChild(textContainer);

                assemblyArticle.appendChild(assemblyGrid);
                assembliesContainer.appendChild(assemblyArticle);
            });

            jobDetails.appendChild(assembliesContainer);
            this.jobsList.appendChild(jobDetails);
        });


        this.containerDiv.querySelectorAll("details").forEach((detailElement) => {
            new Accordion(detailElement);
        });
    }
}

class HeatmapsPage{
    constructor(container, productionPlan, workspace, workspaceSettings){
        this.container = container;
        this.productionPlan = productionPlan;
        this.workspace = workspace;
        this.workspaceSettings = workspaceSettings;

        this.productionPlanHeatMap = null;
        this.workspaceHeatmap = null;
    }

    initialize(){
        this.loadHeatmaps();
    }

    loadHeatmaps() {
        if (!this.productionPlanHeatMap) {
            this.productionPlanHeatMap = new HeatMap('#production-plan-heatmap-container', this.productionPlan, this.workspaceSettings);
            this.productionPlanHeatMap.initialize();
        } else {
            this.productionPlanHeatMap.loadHeatMap();
        }
        if (!this.workspaceHeatmap) {
            this.workspaceHeatmap = new HeatMap('#workspace-heatmap-container', this.workspace, this.workspaceSettings);
            this.workspaceHeatmap.initialize();
        } else {
            this.workspaceHeatmap.loadChart();
        }
    }
}

class AssemblyGraphsPage{
    constructor(container, workspace, workspaceArchives, workspaceSettings){
        this.container = container;
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;

        this.assemblyInProcessChart1 = null;
        this.assemblyInProcessChart2 = null;
        this.assemblyInProcessChart3 = null;

        this.selectAssemblyChart1 = null;
        this.selectAssemblyChart2 = null;

        this.allAssembliesChart1 = null;
    }
 
    initialize(){
        this.assemblyInProcessChart1 = new AssembliesInProcessChart('#assemblies-in-process-chart-container-1', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.assemblyInProcessChart1.initialize();
        this.assemblyInProcessChart2 = new AssembliesInProcessChart('#assemblies-in-process-chart-container-2', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.assemblyInProcessChart2.initialize();
        this.assemblyInProcessChart3 = new AssembliesInProcessChart('#assemblies-in-process-chart-container-3', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.assemblyInProcessChart3.initialize();
        this.selectAssemblyChart1 = new SelectAssemblyChart('#select-assembly-chart-container-1', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.selectAssemblyChart1.initialize();
        this.selectAssemblyChart2 = new SelectAssemblyChart('#select-assembly-chart-container-2', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.selectAssemblyChart2.initialize();
        this.allAssembliesChart1 = new AllAssembliesChart('#all-assemblies-chart-container-1', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.allAssembliesChart1.initialize();
    }

    loadGraphs() {
        this.assemblyInProcessChart1.loadChart();
        this.assemblyInProcessChart2.loadChart();
        this.assemblyInProcessChart3.loadChart();

        this.selectAssemblyChart1.loadChart();
        this.selectAssemblyChart2.loadChart();

        this.allAssembliesChart1.loadChart();
    }
}

class PartGraphsPage{
    constructor(container, workspace, workspaceArchives, workspaceSettings){
        this.container = container;
        this.workspace = workspace;
        this.workspaceArchives = workspaceArchives;
        this.workspaceSettings = workspaceSettings;

        this.laserCutPartsChart1 = null;
        this.laserCutPartsChart2 = null;
        this.laserCutPartsChart3 = null;
    }
 
    initialize(){
        this.laserCutPartsChart1 = new LaserCutPartsInProcessChart('#laser-cut-parts-in-process-chart-container-1', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.laserCutPartsChart1.initialize();
        this.laserCutPartsChart2 = new LaserCutPartsInProcessChart('#laser-cut-parts-in-process-chart-container-2', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.laserCutPartsChart2.initialize();
        this.laserCutPartsChart3 = new LaserCutPartsInProcessChart('#laser-cut-parts-in-process-chart-container-3', this.workspace, this.workspaceArchives, this.workspaceSettings);
        this.laserCutPartsChart3.initialize();
    }

    loadGraphs() {
        this.laserCutPartsChart1.loadChart();
        this.laserCutPartsChart2.loadChart();
        this.laserCutPartsChart3.loadChart();
    }
}

class WorkspaceDashboard {
    constructor() {
        // Data
        this.workspace = null;
        this.workspaceArchives = null;
        this.workspaceSettings = null;
        this.productionPlan = null

        this.heatMapsPage = null;
        this.assemblyGraphsPage = null;
        this.partGraphsPage = null;
        this.jobActivityPage = null;

        this.socket = null;
    }

    async initialize() {
        this.workspace = await this.loadWorkspace();
        this.workspaceArchives = await this.loadWorkspaceArchives();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        this.productionPlan = await this.loadProductionPlan();
        if (this.workspace && this.workspaceArchives && this.workspaceSettings && this.productionPlan) {
            this.assemblyGraphsPage = new AssemblyGraphsPage('#assembly-graphs', this.workspace, this.workspaceArchives, this.workspaceSettings);
            this.assemblyGraphsPage.initialize();
            
            this.partGraphsPage = new PartGraphsPage('#parts-graphs', this.workspace, this.workspaceArchives, this.workspaceSettings);
            this.partGraphsPage.initialize();
            
            this.heatMapsPage = new HeatmapsPage('#heatmaps', this.workspace, this.productionPlan, this.workspaceSettings);
            this.heatMapsPage.initialize();

            this.jobActivityPage = new ActivityPage('#activity', this.workspace, this.workspaceArchives, this.workspaceSettings);
            this.jobActivityPage.initialize();

            this.setupWebSocket();
        }
    }

    loadPages(){
        this.heatMapsPage.loadHeatmaps();
        this.assemblyGraphsPage.loadGraphs();
        this.partGraphsPage.loadGraphs();
        this.jobActivityPage.loadView();
    }

    async reloadView() {
        this.workspace = await this.loadWorkspace();
        this.workspaceArchives = await this.loadWorkspaceArchives();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        this.productionPlan = await this.loadProductionPlan();
        if (this.workspace && this.workspaceArchives && this.workspaceSettings && this.productionPlan) {
            this.loadPages();
        }
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
            if (message.action === 'download' && (message.files.includes('workspace.json') || message.files.includes('workspace'))) {
                console.log('Workspace update received. Reloading...');
                this.reloadView();
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

document.addEventListener('DOMContentLoaded', () => {
    function activateTabFromHash() {
        const hash = window.location.hash;
        if (hash) {
            const activeTab = document.querySelector(`.tabs a[data-ui="${hash}"]`);
            const activePage = document.querySelector(hash);

            if (activeTab && activePage) {
                document.querySelectorAll('.tabs a').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

                activeTab.classList.add('active');
                activePage.classList.add('active');

                window.scrollTo(0, 0);
            }
        }
    }

    document.querySelectorAll('.tabs a').forEach(tab => {
        tab.addEventListener('click', function (event) {
            event.preventDefault();

            document.querySelectorAll('.tabs a').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

            this.classList.add('active');
            const pageId = this.getAttribute('data-ui');
            document.querySelector(pageId).classList.add('active');

            window.location.hash = pageId;
        });
    });

    activateTabFromHash();

    window.addEventListener('hashchange', activateTabFromHash);
});
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
} from './utils.js';

function goToMainUrl() {
    window.location.href = "/";
}

class GanttGraph {
    constructor(productionPlan, workspaceSettings) {
        this.productionPlan = productionPlan;
        this.workspaceSettings = workspaceSettings;
        this.today = new Date();
        this.oneWeekLater = new Date(this.today.getTime() + 7 * 24 * 60 * 60 * 1000);
        this.data = null;
        this.links = null;
        this.idCounter = null;
        this.lastViewMode = "week"
        this.saveTimer = null;
        this.saveDelay = 2000; // 2 seconds delay
    }

    initialize() {
        this.data = [];
        this.links = [];
        this.idCounter = 1;
    }

    generateId() {
        return this.idCounter++;
    }

    loadJobs() {
        this.productionPlan.jobs.forEach(job => {
            const startDate = new Date(job.job_data.starting_date);
            const endDate = new Date(job.job_data.ending_date);

            const jobId = this.generateId();
            var job_color = 'gray';

            if (job.job_data.moved_job_to_workspace) {
                job_color = 'gray';
            } else {
                job_color = job.job_data.color
            }

            this.data.push({
                id: jobId,
                text: job.job_data.name,
                start_date: startDate,
                duration: (endDate - startDate) / (1000 * 60 * 60 * 24), // Add 1 to account for inclusive end date
                open: false,
                parent: 0,
                progress: 1, // Otherwise the assembly count doesn't show
                assembly_count: getAssemblyCount(job),
                color: job_color,
                type: "project",
            });
            this.loadProcessTimeline(job, jobId, job.job_data.flowtag_timeline, jobId, job_color);
        });
    }

    getIndexOfProcessTag(processTag) {
        let index = 0;
        for (const tagName in this.workspaceSettings.tags) {
            index++;
            if (tagName === processTag) {
                return index;
            }
        }
        return index;
    }

    loadProcessTimeline(job, jobId, flowtag_timeline, parentId, color) {
        let lastTagId = parentId;
        let first = true;
        let lastTag = null;

        for (const tagName in flowtag_timeline) {
            if (flowtag_timeline.hasOwnProperty(tagName)) {
                const tag = flowtag_timeline[tagName];

                const startDate = new Date(tag.starting_date);
                const endDate = new Date(tag.ending_date);

                const tagId = this.generateId();

                const duration_days = (endDate - startDate) / (1000 * 60 * 60 * 24)

                this.data.push({
                    id: tagId,
                    text: tagName,
                    start_date: startDate,
                    duration: duration_days, // Add 1 to account for inclusive end date
                    parent: parentId,
                    part_count: getPartProcessCountByTag(job, tagName),
                    assembly_count: getAssemblyProcessCountByTag(job, tagName),
                    user: this.getIndexOfProcessTag(tagName),
                    color: color,
                    progress: 1, // Otherwise the parts count doesn't show
                    type: gantt.config.types.task,
                    part_expected_time_to_complete: getPartProcessExpectedTimeToComplete(job, tagName),
                    assembly_expected_time_to_complete: getAssemblyProcessExpectedTimeToComplete(job, tagName),
                });

                if (first) {
                    this.links.push({
                        id: tagId,
                        source: lastTagId,
                        target: tagId,
                        type: "1" // Finish to start. Going to the next process
                    });
                    first = false;
                } else {
                    this.links.push({
                        id: tagId,
                        source: lastTagId,
                        target: tagId,
                        type: "0" // Start to start. Starting the first process
                    });
                }

                lastTagId = tagId;
                lastTag = {
                    id: tagId,
                    endDate: endDate
                };
            }
        }

        // Create link from the finish of the last tag to the finish of the job
        if (lastTag) {
            this.links.push({
                id: parentId,
                source: lastTag.id,
                target: jobId,
                type: "2", // Finish to finish. Finish the last process
            });
        }
    }

    loadConfig() {
        gantt.plugins({
            marker: true,
            tooltip: true,
            multiselect: true,
            drag_timeline: true,
            click_drag: true,
        });

        gantt.config.keep_grid_width = false;
        gantt.config.grid_resize = true;
        gantt.config.min_column_width = 50;
        gantt.config.row_height = 30;
        gantt.config.scale_height = 60;
        gantt.config.fit_tasks = true;
        gantt.config.reorder_grid_columns = true;
        gantt.config.autoscroll = true;
        gantt.config.multiselect = true;
        gantt.config.show_links = true;
        gantt.config.drag_project = true;
        gantt.config.date_format = "%Y-%m-%d %h:%i %A";

        gantt.templates.progress_text = function (start, end, task) {
            console.log(task.type);

            if (task.assembly_count > 0 && task.part_count > 0) {
                return "<span style='text-align:left;'>" + Math.round(task.part_count) + (Math.round(task.part_count) === 1 ? " part" : " parts") + Math.round(task.assembly_count) + (Math.round(task.assembly_count) === 1 ? " assembly" : " assemblies") + "</span>";
            } else if (task.assembly_count > 0) {
                return "<span style='text-align:left;'>" + Math.round(task.assembly_count) + (Math.round(task.assembly_count) === 1 ? " assembly" : " assemblies") + "</span>";
            } else if (task.part_count > 0) {
                return "<span style='text-align:left;'>" + Math.round(task.part_count) + (Math.round(task.part_count) === 1 ? " part" : " parts") + "</span>";
            }
        };

        gantt.templates.link_class = function (link) {
            var types = gantt.config.links;
            switch (link.type) {
                case types.finish_to_start:
                    return "finish_to_start";
                    break;
                case types.start_to_start:
                    return "start_to_start";
                    break;
                case types.finish_to_finish:
                    return "finish_to_finish";
                    break;
            }
        };

        function linkTypeToString(linkType) {
            switch (linkType) {
                case gantt.config.links.start_to_start:
                    return "Start to start";
                case gantt.config.links.start_to_finish:
                    return "Start to finish";
                case gantt.config.links.finish_to_start:
                    return "Finish to start";
                case gantt.config.links.finish_to_finish:
                    return "Finish to finish";
                default:
                    return ""
            }
        }

        gantt.attachEvent("onGanttReady", function () {
            var tooltips = gantt.ext.tooltips;

            gantt.templates.tooltip_text = function (start, end, task) {
                var store = gantt.getDatastore("resource");
                var assignments = task[gantt.config.resource_property] || [];

                var owners = [];
                assignments.forEach(function (assignment) {
                    var owner = store.getItem(assignment.resource_id)
                    owners.push(owner.text);
                });
                if (task.assembly_count > 0 && task.part_count > 0) {
                    return "<b>Process:</b> " + task.text + "<br/>" +
                        "<b>Assembly count:</b> " + task.assembly_count + "<br/>" +
                        "<b>Part count:</b> " + task.part_count + "<br/>" +
                        "<b>Start date:</b> " + gantt.templates.tooltip_date_format(start) +
                        "<br/><b>End date:</b> " + gantt.templates.tooltip_date_format(end);
                }
                else if (task.assembly_count > 0) {
                    return "<b>Job:</b> " + task.text + "<br/>" +
                        "<b>Assembly count:</b> " + task.assembly_count + "<br/>" +
                        "<b>Start date:</b> " + gantt.templates.tooltip_date_format(start) +
                        "<br/><b>End date:</b> " + gantt.templates.tooltip_date_format(end);
                } else if (task.part_count > 0) {
                    return "<b>Process:</b> " + task.text + "<br/>" +
                        "<b>Part count:</b> " + task.part_count + "<br/>" +
                        "<b>Start date:</b> " + gantt.templates.tooltip_date_format(start) +
                        "<br/><b>End date:</b> " + gantt.templates.tooltip_date_format(end);
                }
            };

            tooltips.tooltipFor({
                selector: ".gantt_task_link",
                html: function (event, node) {

                    var linkId = node.getAttribute(gantt.config.link_attribute);
                    if (linkId) {
                        var link = gantt.getLink(linkId);
                        var from = gantt.getTask(link.source);
                        var to = gantt.getTask(link.target);

                        return [
                            "<b>Link:</b> " + linkTypeToString(link.type),
                            "<b>From: </b> " + from.text,
                            "<b>To: </b> " + to.text
                        ].join("<br>");
                    }
                }
            });

            tooltips.tooltipFor({
                selector: ".gantt_row[resource_id]",
                html: function (event, node) {

                    var resourceId = node.getAttribute("resource_id");
                    var store = gantt.getDatastore(gantt.config.resource_store);
                    var resource = store.getItem(resourceId);
                    var assignments = getResourceAssignments(resource, store)

                    var totalDuration = 0;
                    for (var i = 0; i < assignments.length; i++) {
                        var task = gantt.getTask(assignments[i].task_id);
                        totalDuration += task.duration * assignments[i].value;
                    }

                    return [
                        "<b>Resource:</b> " + resource.text,
                        "<b>Tasks assigned:</b> " + assignments.length,
                        "<b>Total load: </b>" + (totalDuration || 0) + "h"
                    ].join("<br>");

                }
            });


            tooltips.tooltipFor({
                selector: ".gantt_scale_cell",
                html: function (event, node) {
                    var relativePosition = gantt.utils.dom.getRelativeEventPosition(event, gantt.$task_scale);
                    return gantt.templates.tooltip_date_format(gantt.dateFromPos(relativePosition.x));
                }
            });

            tooltips.tooltipFor({
                selector: ".gantt_resource_marker",
                html: function (event, node) {
                    var dataElement = node.querySelector("[data-recource-tasks]");
                    var ids = JSON.parse(dataElement.getAttribute("data-recource-tasks"));

                    var date = gantt.templates.parse_date(dataElement.getAttribute("data-cell-date"));
                    var resourceId = dataElement.getAttribute("data-resource-id");

                    var relativePosition = gantt.utils.dom.getRelativeEventPosition(event, gantt.$task_scale);

                    var store = gantt.getDatastore("resource");

                    var html = [
                        "<b>" + store.getItem(resourceId).text + "</b>" + ", " + gantt.templates.tooltip_date_format(date),
                        "",
                        ids.map(function (id, index) {
                            var task = gantt.getTask(id);
                            var assignenment = gantt.getResourceAssignments(resourceId, task.id);
                            var amount = "";
                            var taskIndex = (index + 1);
                            if (assignenment[0]) {
                                amount = " (" + assignenment[0].value + "h) ";
                            }
                            return "Task #" + taskIndex + ": " + amount + task.text;
                        }).join("<br>")
                    ].join("<br>");

                    return html;
                }
            });
        });

        function getResourceAssignments(resource, store) {
            var assignments = [];
            if (store.hasChild(resource.id)) {
                store.eachItem(function (res) {
                    assignments = assignments.concat(gantt.getResourceAssignments(res.id));
                }, resource.id)
            } else {
                assignments = gantt.getResourceAssignments(resource.id)
            }
            return assignments;
        }

        gantt.templates.leftside_text = function (start, end, task) {
            var state = gantt.getState(),
                modes = gantt.config.drag_mode;

            if (state.drag_id == task.id) {
                if (state.drag_mode == modes.move || (state.drag_mode == modes.resize && state.drag_from_start)) {
                    return dateToStr(gantt.roundDate(start));
                }
            } else {
                return task.duration + " days";
            }

            return "";
        };

        gantt.templates.rightside_text = function (start, end, task) {
            var state = gantt.getState(), modes = gantt.config.drag_mode;

            if (state.drag_id == task.id) {
                if (state.drag_mode == modes.move || (state.drag_mode == modes.resize && !state.drag_from_start)) {
                    return dateToStr(gantt.roundDate(end));
                }
            }
            return "";
        };

        function roundToTwo(num) {
            return +(Math.round(num + "e+2") + "e-2");
        }

        function calculateResourceLoad(tasks, scale) {
            var step = scale.unit;
            var timegrid = {};
            var currentScale = gantt.ext.zoom.getCurrentLevel().name;

            for (var i = 0; i < tasks.length; i++) {
                var task = tasks[i];

                var currDate = gantt.date[step + "_start"](new Date(task.start_date));

                while (currDate < task.end_date) {

                    var date = currDate;
                    currDate = gantt.date.add(currDate, 1, step);

                    if (currentScale === "day" || currentScale === "week") {
                        if (date.getDay() == 0) {
                            continue;
                        }
                    }

                    var timestamp = date.valueOf();
                    if (!timegrid[timestamp])
                        timegrid[timestamp] = 0;

                    const hoursToComplete = ((task.part_expected_time_to_complete + task.assembly_expected_time_to_complete) / 3600); // Convert seconds to hours
                    const durationInHours = task.duration; // Convert days to hours

                    if (durationInHours <= 0) {
                        durationInHours = 1;
                    }

                    timegrid[timestamp] += roundToTwo((hoursToComplete / durationInHours)); // Calculate and round to 1 decimal

                }
            }

            var timetable = [];
            var start, end;
            for (var i in timegrid) {
                start = new Date(i * 1);
                end = gantt.date.add(start, 1, step);
                timetable.push({
                    start_date: start,
                    end_date: end,
                    value: timegrid[i]
                });
            }

            return timetable;
        }

        function unselectTasks() {
            gantt.eachSelectedTask(function (item) {
                gantt.unselectTask(item.id);
            });
        };

        var renderResourceLine = function (resource, timeline) {
            var tasks = gantt.getTaskBy("user", resource.id);
            var timetable = calculateResourceLoad(tasks, timeline.getScale());

            var row = document.createElement("div");
            var totalValue = timetable.reduce((sum, day) => sum + day.value, 0); // Calculate the total value in the row

            function getColor(value, total) {
                // Calculate the relative position between green and red
                var ratio = value / 4;
                var red = Math.min(255, Math.floor(255 * ratio));
                var green = Math.min(255, Math.floor(255 * (1 - ratio)));

                var redShade = Math.floor(128 + red / 2); // Lighter red
                var greenShade = Math.floor(128 + green / 2); // Lighter green

                return `rgba(${redShade}, ${greenShade}, 0, 0.2)`;
            }

            for (var i = 0; i < timetable.length; i++) {
                var day = timetable[i];
                var color = getColor(day.value, totalValue);

                var sizes = timeline.getItemPosition(resource, day.start_date, day.end_date);
                var el = document.createElement('div');

                var totalMinutes = day.value * 60;
                var days = Math.floor(totalMinutes / (60 * 24));
                var hours = Math.floor((totalMinutes % (60 * 24)) / 60);
                var minutes = Math.floor(totalMinutes % 60);

                // Build the time string conditionally
                var timeString = '';
                if (days > 0) {
                    timeString += days + 'd ';
                }
                if (hours > 0) {
                    timeString += hours + 'h ';
                }
                if (minutes > 0 || timeString === '') {
                    timeString += minutes + 'm';
                }

                var fontSize;
                if (timeString.length <= 3) { // E.g., "1d", "2h", "3m"
                    fontSize = "12pt";
                } else if (timeString.length <= 6) { // E.g., "1d 2h"
                    fontSize = "10pt";
                } else if (timeString.length <= 9) { // E.g., "1d 2h 3m"
                    fontSize = "8pt";
                } else { // For even longer strings, reduce font size further
                    fontSize = "6pt";
                }

                el.style.cssText = [
                    'left:' + sizes.left + 'px',
                    'width:' + sizes.width + 'px',
                    'position:absolute',
                    'height:' + (gantt.config.row_height - 1) + 'px',
                    'line-height:' + sizes.height + 'px',
                    'top:' + sizes.top + 'px',
                    'background-color:' + color,
                    'color: white',
                    'font-weight: normal',
                    'text-align: center',
                    'font-size:' + fontSize,
                ].join(";");

                el.innerHTML = timeString.trim();
                row.appendChild(el);
            }
            return row;
        };

        function onDragEnd(startPoint, endPoint, startDate, endDate, tasksBetweenDates, tasksInRows) {
            var mode = document.querySelector("input[name=selectMode]:checked");
            if (!mode) {
                return
            }
            switch (mode.value) {
                case "1":
                    unselectTasks();
                    tasksBetweenDates.forEach(function (item) {
                        gantt.selectTask(item.id);
                    });
                    break;
                case "2":
                    unselectTasks();
                    tasksInRows.forEach(function (item) {
                        gantt.selectTask(item.id);
                    });
                    break;
                case "3":
                    unselectTasks();
                    for (var i = 0; i < tasksBetweenDates.length; i++) {
                        for (var j = 0; j < tasksInRows.length; j++) {
                            if (tasksBetweenDates[i] === tasksInRows[j]) {
                                gantt.selectTask(tasksBetweenDates[i].id);
                            }
                        }
                    }
                    break;
                    return;
            }
        }
        var resourceLayers = [
            renderResourceLine,
            "taskBg"
        ];

        var mainGridConfig = {
            columns: [{
                name: "text",
                label: "Job/Process Name",
                tree: true,
                width: 200,
                resize: true
            },
            {
                name: "start_date",
                label: "Start",
                align: "center",
                width: 80,
                resize: true
            },
            {
                name: "duration",
                label: "Days",
                width: 50,
                align: "center",
                resize: true
            },
            {
                name: "end_date",
                label: "End",
                align: "center",
                width: 80,
                resize: true
            },
            ]
        };
        var resourcePanelConfig = {
            columns: [
                {
                    name: "name",
                    label: "Process",
                    resize: true,
                    align: "left",
                    width: 200,
                    template: function (resource) {
                        return resource.label;
                    }
                },
                {
                    name: "workload",
                    label: "Parts",
                    width: 50,
                    align: "center",
                    template: function (resource) {
                        var tasks = gantt.getTaskBy("user", resource.id);

                        var totalPartCount = 0;
                        var visibleTasks = tasks.filter(task => {
                            const taskStart = new Date(task.start_date);
                            const taskEnd = new Date(task.end_date);
                            const visibleStart = gantt.getState().min_date;
                            const visibleEnd = gantt.getState().max_date;
                            return taskEnd >= visibleStart && taskStart <= visibleEnd;
                        });

                        for (var i = 0; i < visibleTasks.length; i++) {
                            totalPartCount += visibleTasks[i].part_count;
                        }

                        return (totalPartCount || 0) + "";
                    }
                },
                {
                    name: "workload",
                    label: "Assemblies",
                    width: 150,
                    align: "center",
                    template: function (resource) {
                        var tasks = gantt.getTaskBy("user", resource.id);

                        var totalAssemblyCount = 0;
                        var visibleTasks = tasks.filter(task => {
                            const taskStart = new Date(task.start_date);
                            const taskEnd = new Date(task.end_date);
                            const visibleStart = gantt.getState().min_date;
                            const visibleEnd = gantt.getState().max_date;
                            return taskEnd >= visibleStart && taskStart <= visibleEnd;
                        });

                        for (var i = 0; i < visibleTasks.length; i++) {
                            totalAssemblyCount += visibleTasks[i].assembly_count;
                        }

                        return (totalAssemblyCount || 0) + "";
                    }
                },
                {
                    name: "workload",
                    label: "Workload",
                    width: 100,
                    resize: true,
                    align: "left",
                    template: function (resource) {
                        var tasks = gantt.getTaskBy("user", resource.id);

                        var totalDurationInSeconds = 0;
                        var visibleTasks = tasks.filter(task => {
                            const taskStart = new Date(task.start_date);
                            const taskEnd = new Date(task.end_date);
                            const visibleStart = gantt.getState().min_date;
                            const visibleEnd = gantt.getState().max_date;
                            return taskEnd >= visibleStart && taskStart <= visibleEnd;
                        });

                        for (var i = 0; i < visibleTasks.length; i++) {
                            totalDurationInSeconds += visibleTasks[i].part_expected_time_to_complete + visibleTasks[i].assembly_expected_time_to_complete;
                        }

                        const days = Math.floor(totalDurationInSeconds / (3600 * 24));
                        const hours = Math.floor((totalDurationInSeconds % (3600 * 24)) / 3600);
                        const minutes = Math.floor((totalDurationInSeconds % 3600) / 60);
                        const seconds = Math.floor(totalDurationInSeconds % 60);

                        let durationString = '';
                        if (days > 0) {
                            durationString += `${days}d `;
                        }
                        if (hours > 0) {
                            durationString += `${hours}h `;
                        }
                        if (minutes > 0) {
                            durationString += `${minutes}m `;
                        }
                        if (seconds > 0 || durationString === '') { // Show seconds if they are non-zero or if everything else is zero
                            durationString += `${seconds}s`;
                        }

                        return durationString.trim();
                    }
                },
                {
                    view: "scrollbar",
                    id: "scrollVer"
                },
            ]
        };

        gantt.config.layout = {
            css: "gantt_container",
            rows: [{
                config: mainGridConfig,
                cols: [{
                    width: 400,
                    min_width: 300,
                    rows: [{
                        view: "grid",
                        scrollX: "gridScroll",
                        scrollable: true,
                        scrollY: "scrollVer"
                    },
                    {
                        view: "scrollbar",
                        id: "gridScroll",
                        group: "horizontal"
                    }
                    ]
                },
                {
                    resizer: true,
                    width: 1,
                    group: "vertical"
                },
                {
                    rows: [{
                        view: "timeline",
                        scrollX: "scrollHor",
                        scrollY: "scrollVer"
                    },
                    {
                        view: "scrollbar",
                        id: "scrollHor",
                        group: "horizontal"
                    }
                    ]
                },
                {
                    view: "scrollbar",
                    id: "scrollVer"
                }
                ]
            },
            {
                resizer: true,
                width: 1
            },
            {
                config: resourcePanelConfig,
                height: 400, // Adjust the height of the resource panel as needed
                cols: [{
                    width: 400,
                    min_width: 200,
                    view: "grid",
                    id: "resourceGrid",
                    group: "grids",
                    bind: "resources",
                    scrollY: "resourceVScroll"
                },
                {
                    resizer: true,
                    width: 1,
                    group: "vertical"
                },
                {
                    view: "timeline",
                    id: "resourceTimeline",
                    bind: "resources",
                    bindLinks: null,
                    layers: resourceLayers,
                    scrollX: "scrollHor",
                    scrollY: "resourceVScroll"
                },
                {
                    view: "scrollbar",
                    id: "resourceVScroll",
                    group: "vertical"
                }
                ]
            },
            ]
        };

        var resourcesStore = gantt.createDatastore({
            name: "resources",
            initItem: function (item) {
                item.id = item.key || gantt.uid();
                return item;
            }
        });

        var tasksStore = gantt.getDatastore("task");
        tasksStore.attachEvent("onStoreUpdated", function (id, item, mode) {
            resourcesStore.refresh();
        });

        var zoomConfig = {
            levels: [{
                name: "day",
                scale_height: 27,
                min_column_width: 80,
                scales: [{
                    unit: "day",
                    step: 1,
                    format: "%d %M"
                }]
            },
            {
                name: "week",
                scale_height: 50,
                min_column_width: 50,
                scales: [{
                    unit: "week",
                    step: 1,
                    format: function (date) {
                        var dateToStr = gantt.date.date_to_str("%d %M");
                        var endDate = gantt.date.add(date, -6, "day");
                        var weekNum = gantt.date.date_to_str("%W")(date);
                        return "#" + weekNum + ", " + dateToStr(date) + " - " + dateToStr(endDate);
                    }
                },
                {
                    unit: "day",
                    step: 1,
                    format: "%j %D"
                }
                ]
            },
            {
                name: "month",
                scale_height: 50,
                min_column_width: 120,
                scales: [{
                    unit: "month",
                    format: "%F, %Y"
                },
                {
                    unit: "week",
                    format: "Week #%W"
                }
                ]
            },
            {
                name: "quarter",
                height: 50,
                min_column_width: 90,
                scales: [{
                    unit: "month",
                    step: 1,
                    format: "%M"
                },
                {
                    unit: "quarter",
                    step: 1,
                    format: function (date) {
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
                scales: [{
                    unit: "year",
                    step: 1,
                    format: "%Y"
                }]
            }
            ]
        };
        gantt.templates.scale_cell_class = function (date) {
            const scale = gantt.ext.zoom.getCurrentLevel().name;
            if (scale === "day" || scale === "week") {
                if (date.getDay() == 0) {
                    return "weekend";
                }
            }
            return "";
        };

        gantt.templates.timeline_cell_class = function (item, date) {
            const scale = gantt.ext.zoom.getCurrentLevel().name;
            if (scale === "day" || scale === "week") {
                if (date.getDay() == 0) {
                    return "weekend";
                }
            }
            return "";
        };
        gantt.config.click_drag = {
            callback: onDragEnd
        };
        gantt.ext.zoom.init(zoomConfig);
        gantt.ext.zoom.setLevel(this.lastViewMode);
        gantt.ext.zoom.attachEvent("onAfterZoom", function (level, config) {
            document.querySelector(".gantt_radio[value='" + config.name + "']").checked = true;
        })
        var weekScaleTemplate = function (date) {
            var dateToStr = gantt.date.date_to_str("%d %M");
            var endDate = gantt.date.add(gantt.date.add(date, 1, "week"), -1, "day");
            return dateToStr(date) + " - " + dateToStr(endDate);
        };

        var daysStyle = function (date) {
            if (date.getDay() === 0) {
                return "weekend";
            }
            return "";
        };

        gantt.config.scales = [{
            unit: "month",
            step: 1,
            format: "%F, %Y"
        },
        {
            unit: "week",
            step: 1,
            format: weekScaleTemplate
        },
        {
            unit: "day",
            step: 1,
            format: "%D",
            css: daysStyle
        }
        ];

        var dateToStr = gantt.date.date_to_str(gantt.config.task_date);
        var today = new Date();
        gantt.addMarker({
            start_date: today,
            css: "today",
            text: "Today",
            title: "Today: " + dateToStr(today)
        });
        const tagsDict = this.workspaceSettings.tags;
        let index = 0;
        const resources = [];

        for (const tagName in tagsDict) {
            if (tagsDict.hasOwnProperty(tagName)) {
                index++;
                resources.push({
                    key: index.toString(),
                    label: tagName
                });
            }
        }

        resourcesStore.parse(resources);

        gantt.attachEvent("onTaskDrag", (id, mode, item, original) => {
            this.handleUpdate(item);
        });

        gantt.attachEvent("onAfterTaskUpdate", (id, item) => {
            this.handleUpdate(item);
        });

        gantt.attachEvent("onColumnResizeStart", function (index, column) {
            return true;
        });

        gantt.attachEvent("onColumnResize", function (index, column, new_width) {
            document.getElementById("width_placeholder").innerText = new_width
        });

        gantt.attachEvent("onColumnResizeEnd", function (index, column, new_width) {
            return true;
        });

        gantt.attachEvent("onGridResizeStart", function (old_width) {
            return true;
        });

        gantt.attachEvent("onGridResize", function (old_width, new_width) {
            document.getElementById("width_placeholder").innerText = new_width;
        });

        gantt.attachEvent("onGridResizeEnd", function (old_width, new_width) {
            return true;
        });
    }

    generateAssemblySummary() {
        const startDate = new Date(gantt.config.start_date);
        const endDate = new Date(gantt.config.end_date);

        const assemblyMap = new Map();

        this.productionPlan.jobs.forEach(job => {
            const jobStartDate = new Date(job.job_data.starting_date);
            const jobEndDate = new Date(job.job_data.ending_date);

            // Check if the job is within the date range
            if ((jobStartDate >= startDate && jobStartDate <= endDate) || (jobEndDate >= startDate && jobEndDate <= endDate) || (jobStartDate <= startDate && jobEndDate >= endDate)) {
                job.assemblies.forEach(assembly => {
                    this.addAssemblyToMap(assembly, assemblyMap);
                });
            }
        });

        this.updateAssemblySummaryTable(assemblyMap);
    }

    addAssemblyToMap(assembly, assemblyMap) {
        const assemblyName = assembly.assembly_data.name;
        const assemblyQuantity = assembly.assembly_data.quantity || 1; // Default to 1 if quantity is not defined

        if (assemblyMap.has(assemblyName)) {
            assemblyMap.set(assemblyName, assemblyMap.get(assemblyName) + assemblyQuantity);
        } else {
            assemblyMap.set(assemblyName, assemblyQuantity);
        }

        // Recursively add sub-assemblies
        if (assembly.sub_assemblies) {
            assembly.sub_assemblies.forEach(subAssembly => {
                this.addAssemblyToMap(subAssembly, assemblyMap);
            });
        }
    }

    updateAssemblySummaryTable(assemblyMap) {
        const ganttInfoDiv = document.getElementById('gantt_info');
        ganttInfoDiv.innerHTML = ''; // Clear existing content

        const table = document.createElement('table');
        table.classList.add('sortable');

        const headerRow = document.createElement('tr');
        const headerName = document.createElement('th');
        headerName.textContent = 'Assembly Name';
        const headerQuantity = document.createElement('th');
        headerQuantity.textContent = 'Quantity';
        headerRow.appendChild(headerName);
        headerRow.appendChild(headerQuantity);
        table.appendChild(headerRow);

        assemblyMap.forEach((quantity, name) => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.textContent = name;
            const quantityCell = document.createElement('td');
            quantityCell.textContent = quantity;
            row.appendChild(nameCell);
            row.appendChild(quantityCell);
            table.appendChild(row);
        });

        ganttInfoDiv.appendChild(table);
    }

    render() {
        this.loadConfig()
        this.data.length = 0;
        this.links.length = 0;

        gantt.init("gantt_here");
        gantt.parse(this.loadData());
        gantt.ext.zoom.setLevel(this.lastViewMode)

        var menu = new dhtmlXMenuObject();
        menu.setSkin("dhx_terrace");
        menu.renderAsContextMenu();
        menu.loadStruct("/static/common/dhxmenu.xml");

        gantt.attachEvent("onContextMenu", function (taskId, linkId, event) {
            event.preventDefault();
            var x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
                y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop;
            if (!taskId) {
                return false;
            }
            var task = gantt.getTask(taskId);
            if (taskId && task.type === "project") {
                gantt.contextID = taskId; // Assuming this is set correctly
                menu.showContextMenu(x, y);
            }

            return true;
        });

        menu.attachEvent("onClick", function (id) {
            switch (id) {
                case "open_printout":
                    var task = gantt.getTask(gantt.contextID); // Assuming gantt.contextID is set correctly in onContextMenu

                    const findMatchingJob = (task) => {
                        var counter = { id: 1 };
                        for (let job of this.productionPlan.jobs) {
                            console.log(counter.id);
                            if (counter.id === task.id && job.job_data.name === task.text) {
                                return job;
                            }
                            counter.id++;
                            for (const _ in job.job_data.flowtag_timeline) {
                                counter.id++;
                            }
                        }
                        return null; // If no matching job is found
                    }

                    var matchingJob = findMatchingJob(task);

                    if (matchingJob) {
                        fetch('/production_planner_job_printout', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(matchingJob)
                        })
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response was not ok');
                                }
                                return response.text();
                            })
                            .then(html => {
                                var newWindow = window.open();
                                newWindow.document.write(html);
                                newWindow.document.close();
                            })
                            .catch(error => {
                                console.error('Error:', error);
                            });
                    } else {
                        console.error('No matching job found');
                    }
                    break;
                default:
                    break;
            }
        }.bind(this)); // Cannot access this.productionPlanner otheriwse
        this.generateAssemblySummary();
    }

    changeDateRange() {
        gantt.render();
        gantt.ext.zoom.setLevel(this.lastViewMode)
        this.generateAssemblySummary()
    }

    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = ("0" + (d.getMonth() + 1)).slice(-2);
        const day = ("0" + d.getDate()).slice(-2);

        let hours = d.getHours();
        const minutes = ("0" + d.getMinutes()).slice(-2);
        const period = hours >= 12 ? 'PM' : 'AM';

        // Convert hours to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // If hours is 0, set it to 12

        return `${year}-${month}-${day} ${hours}:${minutes} ${period}`;
    }

    updateJobTimelineBasedOnTags(job) {
        let earliestDate = null;
        let latestDate = null;

        for (const tagName in job.job_data.flowtag_timeline) {
            const tag = job.job_data.flowtag_timeline[tagName];

            const tagStartDate = new Date(tag.starting_date);
            const tagEndDate = new Date(tag.ending_date);

            if (!earliestDate || tagStartDate < earliestDate) {
                earliestDate = tagStartDate;
            }

            if (!latestDate || tagEndDate > latestDate) {
                latestDate = tagEndDate;
            }
        }

        job.job_data.starting_date = this.formatDate(earliestDate);
        job.job_data.ending_date = this.formatDate(latestDate);
    }

    updateFlowtagTimeline(job, flowtag_timeline, itemToUpdate, counter) {
        for (const tagName in flowtag_timeline) {
            const tag = flowtag_timeline[tagName];
            counter.id++;
            if (counter.id === itemToUpdate.id && tagName === itemToUpdate.text) {
                tag.starting_date = this.formatDate(itemToUpdate.start_date);
                tag.ending_date = this.formatDate(itemToUpdate.end_date);
                this.updateJobTimelineBasedOnTags(job);
                return;
            }
        }
    }

    updateJobs(itemToUpdate) {
        var counter = {
            id: 0
        };
        this.productionPlan.jobs.forEach(job => {
            counter.id++;
            if (counter.id === itemToUpdate.id && job.job_data.name === itemToUpdate.text) {
                job.job_data.starting_date = this.formatDate(itemToUpdate.start_date);
                job.job_data.ending_date = this.formatDate(itemToUpdate.end_date);
                return;
            }
            this.updateFlowtagTimeline(job, job.job_data.flowtag_timeline, itemToUpdate, counter);
        });
    }

    handleUpdate(item) {
        this.updateJobs(item);
        this.scheduleSave();
    }

    scheduleSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this.uploadProductionPlan();
        }, this.saveDelay);
    }

    async uploadProductionPlan() {

        var showSuccessMessage = function () {
            var text = "Production plan saved successfully";
            gantt.message({ type: "info", text: text, expire: 3000 });
        }
        var showErrorMessage = function () {
            var text = "Failed to save production plan. Please panic, but calmly.";
            gantt.message({ type: "error", text: text, expire: 10000 });
        }
        const response = await fetch('/production_planner_upload', {
            method: 'POST',
            body: this.createFormData()
        });

        if (response.ok) {
            showSuccessMessage();
        } else {
            showErrorMessage();
        }
    }

    createFormData() {
        const formData = new FormData();
        const workspaceBlob = new Blob([JSON.stringify(this.getData())], {
            type: 'application/json'
        });
        formData.append('file', workspaceBlob, 'production_plan.json');
        return formData;
    }

    getData() {
        return this.productionPlan
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
        this.productionPlan = null;
        this.workspaceSettings = null;
        this.allAssemblies = null;
        this.socket = null;
        this.gnattGraph = null;
    }

    async initialize() {
        this.productionPlan = await this.loadProductionPlan();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        if (this.productionPlan && this.workspaceSettings) {
            this.loadGanttGraph();
            this.setupWebSocket();
        }
    }

    async reloadView() {
        this.productionPlan = await this.loadProductionPlan();
        this.workspaceSettings = await this.loadWorkspaceSettings();
        if (this.productionPlan && this.workspaceSettings) {
            this.allAssemblies = this.loadAllAssemblies();
            this.ganttGraph.jobs = this.productionPlan.jobs
            this.loadGanttGraph();
        }
    }

    loadAllAssemblies() {
        let allAssemblies = [];
        this.productionPlan.jobs.forEach(job => {
            allAssemblies = allAssemblies.concat(getAssemblies(job));
        });
        return allAssemblies;
    }

    loadGanttGraph() {
        if (!this.gnattGraph) {
            this.ganttGraph = new GanttGraph(this.productionPlan, this.workspaceSettings);
        }
        this.ganttGraph.initialize();
        this.ganttGraph.render();
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
            alert('Produciton plan saved successfully.');
        } else {
            console.error('Failed to saved production plan. Panic.');
        }
    }

    createFormData() {
        const formData = new FormData();
        const workspaceBlob = new Blob([JSON.stringify(this.ganttGraph.getData())], {
            type: 'application/json'
        });
        formData.append('file', workspaceBlob, 'production_plan.json');
        return formData;
    }

    setupWebSocket() {
        this.socket = new WebSocket(`ws://${window.location.host}/ws/web`);
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.action === 'download' && message.files.includes('production_plan.json')) {
                console.log('Workspace update received. Reloading...');
                this.loadProductionPlan().then(() => {
                    this.reloadView();
                });
            }
        };
    }
}
window.addEventListener('load', async function () {
    const workspaceScheduler = new WorkspaceScheduler();
    var radios = document.getElementsByName("scale");
    for (var i = 0; i < radios.length; i++) {
        radios[i].onclick = function (event) {
            gantt.ext.zoom.setLevel(event.target.value);
            workspaceScheduler.ganttGraph.lastViewMode = event.target.value;
        };
    }

    // document.getElementById('applyDates').onclick = function (event) {
    //     event.preventDefault();
    //     workspaceScheduler.ganttGraph.changeDateRange();
    // };// Initialize flatpickr with a date range picker

    flatpickr("#date-range-picker", {
        mode: "range",
        theme: 'dark',
        altInput: true,
        altFormat: "F j, Y",
        dateFormat: "Y-m-d",
        onClose: function (selectedDates, dateStr, instance) {
            const [startDate, endDate] = selectedDates;
            if (startDate && endDate) {
                gantt.config.start_date = startDate;
                gantt.config.end_date = endDate;
                workspaceScheduler.ganttGraph.changeDateRange();
            }
        }
    });

    // Utility functions for setting the date range
    function setDateRange(startDate, endDate) {
        document.querySelector("#date-range-picker")._flatpickr.setDate([startDate, endDate], true);
        gantt.config.start_date = startDate;
        gantt.config.end_date = endDate;
        workspaceScheduler.ganttGraph.changeDateRange();
    }

    function setThisMonth() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setDateRange(firstDay, lastDay);
    }

    function setThisYear() {
        const thisYear = new Date().getFullYear();
        const firstDay = new Date(thisYear, 0, 1);
        const lastDay = new Date(thisYear, 11, 31);
        setDateRange(firstDay, lastDay);
    }

    function setNextMonth() {
        const flatpickrInstance = document.querySelector("#date-range-picker")._flatpickr;
        const [currentStart, currentEnd] = flatpickrInstance.selectedDates;
        const nextMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1);
        const nextMonthEnd = new Date(currentEnd.getFullYear(), currentEnd.getMonth() + 2, 0);
        setDateRange(nextMonthStart, nextMonthEnd);
    }

    function setPrevMonth() {
        const flatpickrInstance = document.querySelector("#date-range-picker")._flatpickr;
        const [currentStart, currentEnd] = flatpickrInstance.selectedDates;
        const prevMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
        const prevMonthEnd = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), 0);
        setDateRange(prevMonthStart, prevMonthEnd);
    }

    // Event listeners for custom date range buttons
    document.getElementById('thisMonth').onclick = function (event) {
        event.preventDefault();
        setThisMonth();
    };

    document.getElementById('thisYear').onclick = function (event) {
        event.preventDefault();
        setThisYear();
    };

    document.getElementById('nextMonth').onclick = function (event) {
        event.preventDefault();
        setNextMonth();
    };

    document.getElementById('prevMonth').onclick = function (event) {
        event.preventDefault();
        setPrevMonth();
    };

    // Initialize with the current month's date range

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

    try {
        await workspaceScheduler.initialize(); // Wait for initialization to complete
        setThisMonth();
        workspaceScheduler.ganttGraph.changeDateRange();
    } catch (error) {
        console.error('Error initializing workspace:', error);
        alert('Error loading workspace. Please panic, but calmly.');
    }
});
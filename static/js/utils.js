/**
 * Given a job, gets all assemblies and their sub-assemblies recursively.
 * @param {Object} job - The job object containing assemblies.
 * @returns {Array} - A list of all assemblies and sub-assemblies.
 */
function getAssemblies(job) {
    if (!job || !job.assemblies) {
        console.error("Invalid job object provided");
        return [];
    }
    return collectAssemblies(job.assemblies);
}

/**
 * Recursively collects all assemblies and sub-assemblies.
 * @param {Array} assemblies - The list of assemblies.
 * @returns {Array} - A list of all assemblies and sub-assemblies.
 */
function collectAssemblies(assemblies) {
    let allAssemblies = [];

    assemblies.forEach(assembly => {
        allAssemblies.push(assembly);

        if (assembly.sub_assemblies && assembly.sub_assemblies.length > 0) {
            allAssemblies = allAssemblies.concat(collectAssemblies(assembly.sub_assemblies));
        }
    });

    return allAssemblies;
}

/**
 * Checks if an assembly is complete.
 * @param {Object} assembly - The assembly object to check.
 * @returns {boolean} - True if the assembly is complete, false otherwise.
 */
function isAssemblyComplete(assembly) {
    if (!assembly || !assembly.assembly_data) {
        console.error("Invalid assembly object provided");
        return false;
    }
    const { current_flow_tag_index, flow_tag } = assembly.assembly_data;
    return current_flow_tag_index === flow_tag.tags.length;
}

/**
 * Calculates the total time (in days) it took to complete an assembly.
 * @param {Object} assembly - The assembly object to calculate the time for.
 * @returns {number} - The total time in days.
 */
function getAssemblyCompletionTime(assembly) {
    if (!assembly || !assembly.assembly_data || !assembly.assembly_data.timer) {
        console.error("Invalid assembly object provided");
        return 0;
    }

    const timerData = assembly.assembly_data.timer;
    let totalTime = 0;

    // Iterate over each tag in the timerData object
    for (const tag in timerData) {
        if (Object.hasOwnProperty.call(timerData, tag)) {
            timerData[tag].forEach(timerEntry => {
                const { started, finished } = timerEntry;
                if (started && finished) {
                    const startTime = new Date(started);
                    const endTime = new Date(finished);
                    const timeDifference = endTime - startTime;
                    totalTime += timeDifference;
                }
            });
        }
    }

    // Convert total time from milliseconds to days
    return totalTime / (1000 * 60 * 60 * 24);
}
export { getAssemblies, isAssemblyComplete, getAssemblyCompletionTime };
function getAssemblies(job) {
    if (!job || !job.assemblies) {
        console.error("Invalid job object provided");
        return [];
    }
    return collectAssemblies(job.assemblies);
}

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

function isJobComplete(job) {
    return getJobCompletionProgress(job) >= 1;
}

function isAssemblyComplete(assembly) {
    return getAssemblyCompletionProgress(assembly) >= 1.0;
}

function calculateAssemblyProgress(assembly) {
    let totalSteps = assembly.assembly_data.flow_tag.tags.length;
    let currentSteps = assembly.assembly_data.current_flow_tag_index;

    assembly.laser_cut_parts.forEach(part => {
        totalSteps += part.flow_tag.tags.length;
        currentSteps += part.current_flow_tag_index;
    });

    if (assembly.sub_assemblies && assembly.sub_assemblies.length > 0) {
        assembly.sub_assemblies.forEach(subAssembly => {
            const subAssemblyProgress = calculateAssemblyProgress(subAssembly);
            totalSteps += subAssemblyProgress.totalSteps;
            currentSteps += subAssemblyProgress.currentSteps;
        });
    }

    return {
        totalSteps: totalSteps,
        currentSteps: currentSteps
    };
}

function getAssemblyCompletionProgress(assembly) {
    const progress = calculateAssemblyProgress(assembly);
    return progress.totalSteps > 0 ? progress.currentSteps / progress.totalSteps : 0;
}

function calculateJobProgress(job) {
    let totalSteps = 0;
    let currentSteps = 0;

    job.assemblies.forEach(assembly => {
        const assemblyProgress = calculateAssemblyProgress(assembly);
        const assemblyTotalSteps = assemblyProgress.totalSteps;
        const assemblyCurrentSteps = assemblyProgress.currentSteps;

        totalSteps += assemblyTotalSteps;
        currentSteps += assemblyCurrentSteps;
    });

    return {
        totalSteps: totalSteps,
        currentSteps: currentSteps
    };
}

function getJobCompletionProgress(job) {
    const progress = calculateJobProgress(job);
    return progress.totalSteps > 0 ? progress.currentSteps / progress.totalSteps : 0;
}

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

function getProcessCount(job, tagName) {
    let processCount = 0;

    function countLaserCutParts(parts) {
        for (const part of parts) {

            if (part.flow_tag && part.flow_tag.tags.includes(tagName)) {
                processCount++;
            }
        }
    }

    function countAssemblies(assemblies) {
        console.log(assemblies);

        for (const asm of assemblies) {
            if (asm.laser_cut_parts) {
                countLaserCutParts(asm.laser_cut_parts);
            }
            if (asm.sub_assemblies && asm.sub_assemblies.length > 0) {
                countAssemblies(asm.sub_assemblies);
            }
        }
    }

    if (job.assemblies) {
        countAssemblies(job.assemblies);
    }

    return processCount;
}

function getPartsCount(job){
    let partsCount = 0;

    function countAssemblies(assemblies) {
        for (const asm of assemblies) {
            if (asm.laser_cut_parts) {
                partsCount += asm.laser_cut_parts.length
            }
            if (asm.sub_assemblies && asm.sub_assemblies.length > 0) {
                countAssemblies(asm.sub_assemblies);
            }
        }
    }

    if (job.assemblies) {
        countAssemblies(job.assemblies);
    }

    return partsCount;
}

function getAssemblyCount(job) {
    let assemblyCount = 0;

    function countAssemblies(assemblies) {
        for (const assembly of assemblies) {
            assemblyCount++;
            if (assembly.sub_assemblies && assembly.sub_assemblies.length > 0) {
                countAssemblies(assembly.sub_assemblies);
            }
        }
    }

    if (job.assemblies && job.assemblies.length > 0) {
        countAssemblies(job.assemblies);
    }

    return assemblyCount;
}

export {
    getAssemblies,
    isAssemblyComplete,
    isJobComplete,
    getAssemblyCompletionProgress,
    getJobCompletionProgress,
    getAssemblyCompletionTime,
    getProcessCount,
    getAssemblyCount,
    getPartsCount,
};
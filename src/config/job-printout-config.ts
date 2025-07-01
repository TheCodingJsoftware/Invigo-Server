export enum JobType {
    Quote = "quote",
    WorkOrder = "workorder",
    PackingSlip = "packingslip",
}

export const JOB_COLORS: Record<JobType, string> = {
    [JobType.Quote]: "#78dc77",
    [JobType.WorkOrder]: "#9ecaff",
    [JobType.PackingSlip]: "#d3bbff",
};

import { WorkorderData } from "@interfaces/workorder";
import { Nest } from "@models/nest";


export class Workorder {
    public nests: Nest[];

    constructor(workorder_data: WorkorderData) {
        console.log("Creating Workorder with data:", workorder_data);

        this.nests = [];

        for (const nest_data of workorder_data.nests) {
            this.nests.push(new Nest(nest_data));
        }
    }
}
import { AssemblyData } from "@interfaces/assembly";
import { NestData } from "@interfaces/nest";
import { ContactInfoDict } from "./contact-info";
import { BusinessInfoDict } from "./business-info";
import { FlowtagTimeline } from "../pages/production_planner/production_planner";

export interface JobData {
    job_data: JobMetaData;
    nests: NestData[];
    assemblies: AssemblyData[];
}

export interface JobMetaData {
    id: number;
    name: string;
    type: number; // maps to JobStatus enum
    order_number: number;
    PO_number: number;
    ship_to: string;
    starting_date: string;
    ending_date: string;
    color: string;
    price_settings: JobPriceSettings;
    flowtag_timeline: FlowtagTimeline;
    moved_job_to_workspace: boolean;
    contact_info: ContactInfoDict;
    business_info: BusinessInfoDict
}

export interface JobPriceSettings {
    components_use_overhead: boolean;
    components_use_profit_margin: boolean;
    cost_for_laser: number;
    item_overhead: number;
    item_profit_margin: number;
    match_item_cogs_to_sheet: boolean;
    mil_thickness: number;
    sheet_overhead: number;
    sheet_profit_margin: number;
}

export enum JobStatus {
    PLANNING = 1,
    QUOTING,
    QUOTED,
    QUOTE_CONFIRMED,
    TEMPLATE,
    WORKSPACE,
    ARCHIVE
}

// Optional: color enum keys could match CSS variable names
enum JobColorClass {
    PLANNING = "planning",
    QUOTING = "quoting",
    QUOTED = "quoted",
    QUOTE_CONFIRMED = "quote-confirmed",
    TEMPLATE = "template",
    WORKSPACE = "workspace",
    ARCHIVE = "archive"
}

export { };

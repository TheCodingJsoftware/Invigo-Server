import {AssemblyData} from "@interfaces/assembly";
import {NestData} from "@interfaces/nest";
import {ContactInfoDict} from "./contact-info";
import {BusinessInfoDict} from "./business-info";

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
    flowtag_timeline: JobFlowtagTimelineData;
    moved_job_to_workspace: boolean;
    contact_info: ContactInfoDict;
    business_info: BusinessInfoDict
}

interface JobPriceSettings {
    [key: string]: any;
}

interface JobFlowtagTimelineData {
    [key: string]: any;
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

export {};

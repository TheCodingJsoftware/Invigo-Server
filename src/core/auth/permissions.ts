import { AssemblyViewMode } from "@config/assembly-view-mode";
import { DataTypeSwitcherMode } from "@config/data-type-mode";
import { JobViewMode } from "@config/job-view-mode";
import { NestViewMode } from "@config/nest-view-mode";
import { PartViewMode } from "@config/part-view-mode";
import {WorkspaceSettings} from "@core/settings/workspace-settings";

export type PermissionEntry = {
    value: string;
    label: string;
    description: string;
};

export const PermissionTree = {
    Action: {
        ViewJobs: {
            value: "view_jobs",
            label: "View Jobs",
            description: "Allows viewing of all jobs in the system.",
        },
        EditJobs: {
            value: "edit_jobs",
            label: "Edit Jobs",
            description: "Allows editing job details and configuration.",
        },
        DeleteJobs: {
            value: "delete_jobs",
            label: "Delete Jobs",
            description: "Allows deletion of jobs.",
        },
        AdvanceFlow: {
            value: "advance_flow",
            label: "Advance Flow",
            description: "Allows progressing parts or assemblies along the workflow.",
        },
        EditUsers: {
            value: "edit_users",
            label: "Edit Users",
            description: "Allows editing user information and permissions.",
        },
        AssignRoles: {
            value: "assign_roles",
            label: "Assign Roles",
            description: "Allows assigning roles to other users.",
        },
        EditRoles: {
            value: "edit_roles",
            label: "Edit Roles",
            description: "Allows editing role permissions and configurations.",
        },
        PlanProduction: {
            value: "plan_production",
            label: "Plan Production",
            description: "Allows access to production planning interfaces.",
        },
    },

    DataType: {
        SwitchDataTypes: {
            value: "switch_data_types",
            label: "Switch Data Type",
            description: "Allows switching between assemblies, parts, and nests.",
        },
        [DataTypeSwitcherMode.Assembly]: {
            value: "assembly_view",
            label: "Assembly View",
            description: "Allows access to assembly data.",
        },
        [DataTypeSwitcherMode.Part]: {
            value: "part_view",
            label: "Part View",
            description: "Allows access to part data.",
        },
        [DataTypeSwitcherMode.Nest]: {
            value: "nest_view",
            label: "Nest View",
            description: "Allows access to nest data.",
        },
    },

    AssemblyView: {
        SwitchPartView: {
            value: "switch_assembly_view",
            label: "Switch Assembly View",
            description: "Allows switching between different assembly view modes.",
        },
        [AssemblyViewMode.Global]: {
            value: "assembly_global_view",
            label: "Global Assembly View",
            description: "Allows viewing assemblies across all jobs.",
        },
        [AssemblyViewMode.Job]: {
            value: "assembly_job_view",
            label: "Job Assembly View",
            description: "Allows viewing assemblies grouped by job.",
        },
    },

    PartView: {
        SwitchAssemblyView: {
            value: "switch_part_view",
            label: "Switch Part View",
            description: "Allows switching between different part view modes.",
        },
        [PartViewMode.Global]: {
            value: "part_global_view",
            label: "Global Part View",
            description: "Allows viewing parts across all jobs.",
        },
        [PartViewMode.Job]: {
            value: "part_job_view",
            label: "Job Part View",
            description: "Allows viewing parts grouped by job.",
        }
    },

    NestView: {
        SwitchNestView: {
            value: "switch_nest_view",
            label: "Switch Nest View",
            description: "Allows switching between different nest view modes.",
        },
        [NestViewMode.Global]: {
            value: "nest_global_view",
            label: "Global Nest View",
            description: "Allows viewing all nests across jobs.",
        },
        [NestViewMode.Job]: {
            value: "nest_job_view",
            label: "Job Nest View",
            description: "Allows viewing nests grouped by job.",
        },
        [NestViewMode.Nest]: {
            value: "nest_nest_view",
            label: "Nest Details View",
            description: "Allows viewing and editing individual nest details.",
        },
    },
    JobView: {
        SwitchJobView: {
            value: "switch_job_view",
            label: "Switch Job View",
            description: "Allows switching between different job view modes.",
        },
        [JobViewMode.Global]: {
            value: "job_global_view",
            label: "Global Job View",
            description: "Allows viewing jobs across all jobs.",
        },
    },
} as const;

export const Permissions = {
    ...PermissionTree.Action,
    ...PermissionTree.DataType,
    ...PermissionTree.AssemblyView,
    ...PermissionTree.PartView,
    ...PermissionTree.NestView,
    ...PermissionTree.JobView,
};

export type FlatPermissionKey = keyof typeof Permissions;
export type FlatPermissionEntry = PermissionEntry;

const AllPermissionEntries = Object.values(Permissions) as FlatPermissionEntry[];

export const PermissionMap: Record<string, FlatPermissionEntry> = Object.fromEntries(
  (Object.values(Permissions) as FlatPermissionEntry[]).map(entry => [entry.value, entry])
);


export function extendPermissionMapWithTags() {
    const tags = WorkspaceSettings.tags;

    for (const tagName of Object.keys(tags)) {
        // const base = tagName.toLowerCase().replace(/\s+/g, "_");

        const viewKey = `view_tag:${tagName}`;
        const applyKey = `apply_tag:${tagName}`;

        PermissionMap[viewKey] = {
            value: viewKey,
            label: `View Tag: ${tagName}`,
            description: `Allows viewing items that are currently have the "${tagName}" tag.`
        };

        PermissionMap[applyKey] = {
            value: applyKey,
            label: `Apply Tag: ${tagName}`,
            description: `Allows applying actions to items with the "${tagName}" tag.`
        };
    }
}
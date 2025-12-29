import { PermissionMap, PermissionEntry, FlatPermissionEntry } from "@core/auth/workspace-permissions";

export class User {
    id: number;
    name: string;
    roles: string[];
    permissions: FlatPermissionEntry[];

    constructor(data: { id: number; name: string; roles: string[]; permissions: string[] }) {
        this.id = data.id;
        this.name = data.name;
        this.roles = data.roles;
        this.permissions = data.permissions.map((value) => {
            // First try from static PermissionMap
            const staticPerm = PermissionMap[value];
            if (staticPerm) return staticPerm;

            // Fallback: if it's a dynamic tag permission
            const match = value.match(/^(view_tag|apply_tag):(.+)$/);
            if (match) {
                const [, type, raw] = match;
                const tag = raw.replace(/_/g, " ");
                return {
                    value,
                    label: `${type === "view_tag" ? "View Tag" : "Apply Tag"}: ${tag}`,
                    description: `${type === "view_tag" ? "Allows viewing" : "Allows applying actions"} to the "${tag}" tag.`
                };
            }

            return null;
        }).filter((p): p is FlatPermissionEntry => !!p);
    }

    getPermission(value: string): PermissionEntry | null {
        return PermissionMap[value] ?? null;
    }

    can(permission: FlatPermissionEntry): boolean {
        return this.permissions.some(p => p.value === permission.value);
    }

    canViewTag(tag: string): boolean {
        const key = `view_tag:${tag}`;
        return this.permissions.some(p => p.value === key);
    }

    canApplyTag(tag: string): boolean {
        const key = `apply_tag:${tag}`;
        return this.permissions.some(p => p.value === key);
    }

    require(permission: FlatPermissionEntry, onAllow: () => void, onDeny?: () => void) {
        this.can(permission) ? onAllow() : onDeny?.();
    }

    static async fetchCurrent(): Promise<User> {
        const res = await fetch("/api/protected", { credentials: "include" });
        if (!res.ok) {
            return new User({
                id: 0,
                name: "Guest",
                roles: ["Guest"],
                permissions: []
            });
        }
        const data = await res.json();
        return new User(data);
    }

    static async fetchAll(): Promise<User[]> {
        const res = await fetch("/api/users");
        const list = await res.json();
        return list.map((data: any) => new User(data));
    }

    static async fetchById(id: number): Promise<User> {
        const res = await fetch(`/api/users/${id}`);
        const data = await res.json();
        return new User(data);
    }

    async delete(): Promise<void> {
        await fetch(`/api/users/${this.id}`, { method: "DELETE" });
    }
}

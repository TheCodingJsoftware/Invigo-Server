import { PermissionMap, PermissionEntry, FlatPermissionEntry } from "@auth/permissions";

export class User {
    id: number;
    name: string;
    roles: string[];
    permissions: FlatPermissionEntry[];

    constructor(data: { id: number; name: string; roles: string[]; permissions: string[] }) {
        this.id = data.id;
        this.name = data.name;
        this.roles = data.roles;
        this.permissions = data.permissions
            .map(p => {
                return PermissionMap[p];
            })
            .filter((p): p is FlatPermissionEntry => !!p);
    }

    getPermission(value: string): PermissionEntry | null {
        return PermissionMap[value] ?? null;
    }

    can(permission: FlatPermissionEntry): boolean {
        return this.permissions.some(p => p.value === permission.value);
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
                permissions: [PermissionMap.ViewJobs.value]
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

import { Permission } from "@auth/permissions";

export class User {
    id: number;
    name: string;
    role: string;
    permissions: Permission[];

    constructor(data: { id: number; name: string; role: string; permissions: string[] }) {
        this.id = data.id;
        this.name = data.name;
        this.role = data.role;
        this.permissions = data.permissions.map(p => p as Permission);
    }

    can(permission: Permission): boolean {
        return this.permissions.includes(permission);
    }

    require(permission: Permission, onAllow: () => void, onDeny?: () => void) {
        this.can(permission) ? onAllow() : onDeny?.();
    }

    static async fetchCurrent(): Promise<User> {
        const res = await fetch("/api/protected", { credentials: "include" });
        if (!res.ok) {
            return new User({
                id: 0,
                name: "Guest",
                role: "Guest",
                permissions: [Permission.ViewJobs]
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

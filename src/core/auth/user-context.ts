// core/auth/user-context.ts
import { User } from "@core/auth/user";

export class UserContext {
    private static instance: UserContext;
    private _user!: User;

    private constructor() {}

    static getInstance(): UserContext {
        if (!UserContext.instance) {
            UserContext.instance = new UserContext();
        }
        return UserContext.instance;
    }

    get user(): User {
        return this._user;
    }

    set user(value: User) {
        this._user = value;
    }

    static async initialize(): Promise<void> {
        const context = UserContext.getInstance();
        context.user = await User.fetchCurrent();
    }
}
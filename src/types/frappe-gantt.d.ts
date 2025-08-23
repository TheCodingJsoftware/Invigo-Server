declare module "frappe-gantt" {
    export type ViewMode = "Day" | "Week" | "Month" | "Year";

    export interface HolidayDef {
        name: string;
        date: string | Date;
    }

    export interface GanttTask {
        id: string;
        name: string;
        start: string | Date;
        end?: string | Date;
        duration?: string; // e.g. "4d"
        progress?: number;
        dependencies?: string | string[];
        important?: boolean;
        custom_class?: string;
        description?: string;
        // internal/derived props the library adds
        actual_duration?: number;
        _start?: Date;
        _end?: Date;
    }

    export interface PopupContext {
        task: GanttTask;
        chart: Gantt;
        set_title(text: string): void;
        get_title(): HTMLElement;
        set_subtitle(text: string): void;
        get_subtitle(): HTMLElement;
        set_details(html: string): void;
        get_details(): HTMLElement;
        add_action(label: string, cb: (task: GanttTask, chart: Gantt) => void): void;
    }

    export interface GanttOptions {
        view_mode?: ViewMode;
        language?: string;
        popup_on?: "click" | "hover";
        readonly?: boolean;
        readonly_progress?: boolean;
        today_button?: boolean;
        view_mode_select?: boolean;

        // layout
        container_height?: number;
        infinite_padding?: boolean;
        scroll_to?: number | Date;

        // holidays
        holidays?: Record<string, HolidayDef[] | string[]>;
        ignore?: string[];

        // events
        on_click?(task: GanttTask): void;
        on_date_change?(task: GanttTask, start: Date, end: Date): void;
        on_progress_change?(task: GanttTask, progress: number): void;
        on_view_change?(mode: ViewMode): void;

        // custom popup renderer
        popup?(ctx: PopupContext): void;
    }

    export default class Gantt {
        constructor(
            selector: string | HTMLElement,
            tasks: GanttTask[],
            options?: GanttOptions
        );

        change_view_mode(mode: ViewMode, maintain_pos?: boolean): void;
        refresh(tasks: GanttTask[]): void;
        update_options(options: Partial<GanttOptions>): void;
        scroll_current(): void;
        update_task(id: string, new_details: Partial<GanttTask>): void;

        // internal arrays
        tasks: GanttTask[];
        options: GanttOptions;
        bars: { task: GanttTask; $bar: SVGElement }[];
    }

    export { GanttTask, GanttOptions, PopupContext };
}

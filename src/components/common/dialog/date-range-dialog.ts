import {DialogComponent} from "@components/common/dialog/dialog-component";
import flatpickr from "flatpickr";
import {WorkspaceDateRange, WorkspaceDateRangeDict} from "@models/workspace-date-range";
import {ViewBus} from "@components/workspace/views/view-bus";
import {SessionSettingsManager} from "@core/settings/session-settings";

export class DateRangeDialog extends DialogComponent {
    private picker: any | null = null;
    private readonly workspaceDateRangeManager = WorkspaceDateRange.getManager().get();

    // radios as class-level
    private disableRadio!: HTMLInputElement;
    private thisWeekRadio!: HTMLInputElement;
    private thisNextWeekRadio!: HTMLInputElement;
    private thisLastWeekRadio!: HTMLInputElement;
    private thisLastNextWeekRadio!: HTMLInputElement;
    private thisMonthRadio!: HTMLInputElement;
    private customRadio!: HTMLInputElement;

    constructor() {
        super({
            id: "date-range-dialog",
            title: `Select Range`,
            position: "right",
            bodyContent: `
                <div>
                    <div class="padding">
                        <nav class="vertical">
                            <label class="radio">
                                <input type="radio" name="radio4_" id="disable">
                                <span>Disabled</span>
                            </label>
                            <label class="radio">
                                <input type="radio" name="radio4_" id="this-week">
                                <span>This Week</span>
                            </label>
                            <label class="radio">
                                <input type="radio" name="radio4_" id="this-last-week">
                                <span>This & Last Week</span>
                            </label>
                            <label class="radio">
                                <input type="radio" name="radio4_" id="this-next-week">
                                <span>This & Next Week</span>
                            </label>
                            <label class="radio">
                                <input type="radio" name="radio4_" id="this-last-next-week">
                                <span>This & Last & Next Week</span>
                            </label>
                            <label class="radio">
                                <input type="radio" name="radio4_" id="this-month">
                                <span>This Month</span>
                            </label>
                            <label class="radio">
                                <input type="radio" name="radio4_" id="custom">
                                <span>Custom</span>
                            </label>
                        </nav>
                    </div>
                    <div class="center" id="calendar"></div>
                </div>
            `
        });
        this.init();
    }

    private init() {
        this.disableRadio = document.getElementById("disable") as HTMLInputElement;
        this.thisWeekRadio = document.getElementById("this-week") as HTMLInputElement;
        this.thisNextWeekRadio = document.getElementById("this-next-week") as HTMLInputElement;
        this.thisLastWeekRadio = document.getElementById("this-last-week") as HTMLInputElement;
        this.thisLastNextWeekRadio = document.getElementById("this-last-next-week") as HTMLInputElement;
        this.thisMonthRadio = document.getElementById("this-month") as HTMLInputElement;
        this.customRadio = document.getElementById("custom") as HTMLInputElement;

        // initialize calendar
        this.picker = flatpickr("#calendar", {
            mode: "range",
            animate: true,
            altInput: true,
            altFormat: "F j, Y",
            dateFormat: "Y-m-d",
            inline: true,
            position: "auto center",
            onChange: (selectedDates) => {
                if (this.customRadio.checked && selectedDates.length === 2) {
                    this.saveCustom(selectedDates[0], selectedDates[1]);
                }
                ViewBus.update({
                    dataType: SessionSettingsManager.get().lastActiveDataType,
                });
            }
        });

        this.bindRadios();
        this.restoreState();
    }

    private bindRadios() {
        this.disableRadio.addEventListener("change", () => {
            if (this.disableRadio.checked) {
                this.setDisabled();
                this.saveState("disable");
            }
        });

        this.thisWeekRadio.addEventListener("change", () => {
            if (this.thisWeekRadio.checked) {
                this.setThisWeek();
                this.saveState("thisWeek");
            }
        });

        this.thisNextWeekRadio.addEventListener("change", () => {
            if (this.thisNextWeekRadio.checked) {
                this.setThisNextWeek();
                this.saveState("thisNextWeek");
            }
        });

        this.thisLastWeekRadio.addEventListener("change", () => {
            if (this.thisLastWeekRadio.checked) {
                this.setThisLastWeek();
                this.saveState("thisLastWeek");
            }
        });

        this.thisLastNextWeekRadio.addEventListener("change", () => {
            if (this.thisLastNextWeekRadio.checked) {
                this.setThisLastNextWeek();
                this.saveState("thisLastNextWeek");
            }
        });

        this.thisMonthRadio.addEventListener("change", () => {
            if (this.thisMonthRadio.checked) {
                this.setThisMonth();
                this.saveState("thisMonth");
            }
        });
        this.customRadio.addEventListener("change", () => {
            const dates = this.picker.selectedDates;
            this.picker.config.clickOpens = this.customRadio.checked; // disable clicks if not custom

            if (this.customRadio.checked) {
                if (dates.length === 2) {
                    this.saveCustom(dates[0], dates[1]);
                } else {
                    const today = new Date();
                    this.saveCustom(today, today);
                }
            }
        });

    }

    private saveCustom(start: Date, end: Date) {
        WorkspaceDateRange.getManager().set({
            disable: false,
            thisWeek: false,
            thisNextWeek: false,
            thisLastWeek: false,
            thisLastNextWeek: false,
            thisMonth: false,
            custom: true,
            custom_start: start.toISOString(),
            custom_end: end.toISOString(),
        });
    }

    private saveState(selected: keyof Omit<WorkspaceDateRangeDict, "custom_start" | "custom_end">) {
        const nextState: WorkspaceDateRangeDict = {
            disable: false,
            thisWeek: false,
            thisNextWeek: false,
            thisLastWeek: false,
            thisLastNextWeek: false,
            thisMonth: false,
            custom: false,
            custom_start: null,
            custom_end: null,
        };
        nextState[selected] = true;

        WorkspaceDateRange.getManager().set(nextState);
    }

    private restoreState() {
        this.disableRadio.checked = this.workspaceDateRangeManager.disable;
        this.thisWeekRadio.checked = this.workspaceDateRangeManager.thisWeek;
        this.thisNextWeekRadio.checked = this.workspaceDateRangeManager.thisNextWeek;
        this.thisLastWeekRadio.checked = this.workspaceDateRangeManager.thisLastWeek;
        this.thisLastNextWeekRadio.checked = this.workspaceDateRangeManager.thisLastNextWeek;
        this.thisMonthRadio.checked = this.workspaceDateRangeManager.thisMonth;
        this.customRadio.checked = this.workspaceDateRangeManager.custom;

        if (this.workspaceDateRangeManager.disable) {
            this.setDisabled();
        } else if (this.workspaceDateRangeManager.thisWeek) {
            this.setThisWeek();
        } else if (this.workspaceDateRangeManager.thisNextWeek) {
            this.setThisNextWeek();
        } else if (this.workspaceDateRangeManager.thisLastWeek) {
            this.setThisLastWeek();
        } else if (this.workspaceDateRangeManager.thisLastNextWeek) {
            this.setThisLastNextWeek();
        } else if (this.workspaceDateRangeManager.thisMonth) {
            this.setThisMonth();
        } else if (this.workspaceDateRangeManager.custom && this.workspaceDateRangeManager.custom_start && this.workspaceDateRangeManager.custom_end) {
            this.picker.setDate([
                new Date(this.workspaceDateRangeManager.custom_start),
                new Date(this.workspaceDateRangeManager.custom_end),
            ], true);
        }
    }

    private setDisabled() {
        if (!this.picker) return;
        this.picker.clear();
    }

    private setThisWeek() {
        if (!this.picker) return;

        const today = new Date();
        const day = today.getDay(); // 0=Sunday → 6=Saturday

        // Current week (Sunday → Saturday)
        const start = new Date(today);
        start.setDate(today.getDate() - day);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        this.picker.setDate([start, end], true);
    }

    private setThisNextWeek() {
        if (!this.picker) return;

        const today = new Date();
        const day = today.getDay();

        // Last week (Sunday → Saturday)
        const start = new Date(today);
        start.setDate(today.getDate() - day);

        const end = new Date(start);
        end.setDate(start.getDate() + 6 + 7);

        this.picker.setDate([start, end], true);
    }

    private setThisLastWeek() {
        if (!this.picker) return;

        const today = new Date();
        const day = today.getDay();

        // Last week (Sunday → Saturday)
        const start = new Date(today);
        start.setDate(today.getDate() - day - 7);

        const end = new Date(start);
        end.setDate(start.getDate() + 6 + 7);

        this.picker.setDate([start, end], true);
    }

    private setThisLastNextWeek() {
        if (!this.picker) return;

        const today = new Date();
        const day = today.getDay();

        // Last week (Sunday → Saturday)
        const start = new Date(today);
        start.setDate(today.getDate() - day - 7);

        const end = new Date(start);
        end.setDate(start.getDate() + 6 + 7 + 7);

        this.picker.setDate([start, end], true);
    }


    private setThisMonth() {
        if (!this.picker) return;

        const today = new Date();

        // First of month
        const start = new Date(today.getFullYear(), today.getMonth(), 1);

        // Last of month
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        this.picker.setDate([start, end], true);
    }
}

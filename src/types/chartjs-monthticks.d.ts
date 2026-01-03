import "chart.js";

declare module "chart.js" {
    interface PluginOptionsByType<TType extends ChartType> {
        monthTicks?: {
            monthWeeks: number[];
        };
    }
}

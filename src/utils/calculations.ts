export function calculateOverhead(
    cost: number,
    profitMargin: number = 0.30,
    overheadPercentage: number = 0.18
): number {
    const divisor = 1 - profitMargin - overheadPercentage;

    if (divisor === 0) {
        throw new Error("Invalid percentages: profitMargin + overheadPercentage cannot equal 1.");
    }

    return cost / divisor;
}

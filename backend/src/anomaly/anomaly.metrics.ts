// Quality metrics shared by the API (anomaly.service.ts) and the seed script,
// so both always compute the same numbers.

// Cost of one failed unit, in dollars (one value for now; per-supplier cost later)
export const UNIT_FAILURE_COST = 25;

// Defect rate in %, rounded to 2 decimals — 180 failed of 1200 → 15
export function computeDefectRate(unitsReceived: number, unitsFailed: number): number {
    return Math.round((unitsFailed / unitsReceived) * 100 * 100) / 100;
}

// Cost of poor quality for one shipment, in dollars — 180 failed → 4500
export function computeFinancialImpact(unitsFailed: number): number {
    return unitsFailed * UNIT_FAILURE_COST;
}

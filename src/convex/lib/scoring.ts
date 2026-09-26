/**
 * Health-score calculation and AI output validation.
 * The score is a transparent weighted average of validated category scores.
 *
 * Weights (must sum to 1.0):
 *   Problem Definition 10% | Architecture 15% | Code Quality 15% | Security 15%
 *   Database 10% | Testing 10% | Documentation 10% | UX 5% | Innovation 10%
 */

export const CATEGORIES: Array<{ key: string; name: string; weight: number }> = [
  { key: "problem", name: "Problem Definition", weight: 0.1 },
  { key: "architecture", name: "Architecture", weight: 0.15 },
  { key: "code", name: "Code Quality", weight: 0.15 },
  { key: "security", name: "Security", weight: 0.15 },
  { key: "database", name: "Database", weight: 0.1 },
  { key: "testing", name: "Testing", weight: 0.1 },
  { key: "documentation", name: "Documentation", weight: 0.1 },
  { key: "ux", name: "UX", weight: 0.05 },
  { key: "innovation", name: "Innovation", weight: 0.1 },
];

export const VALID_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof VALID_SEVERITIES)[number];

export function clampScore(n: unknown): number {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

export function clampSeverity(value: unknown): Severity {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  return (VALID_SEVERITIES as readonly string[]).includes(s)
    ? (s as Severity)
    : "medium";
}

/**
 * Weighted score from validated category scores.
 * Categories missing from the model output are skipped and weights are
 * renormalized so the result always lands in 0..100.
 */
export function calculateScore(
  categories: { key: string; score: number }[],
): { score: number; byKey: Record<string, number> } {
  const raw = new Map(categories.map((c) => [c.key, clampScore(c.score)]));
  let total = 0;
  let weightSum = 0;
  for (const { key, weight } of CATEGORIES) {
    const score = raw.get(key);
    if (score === undefined) continue;
    total += score * weight;
    weightSum += weight;
  }
  const score = weightSum === 0 ? 0 : Math.round(total / weightSum);
  const byKey = Object.fromEntries(
    CATEGORIES.map(({ key }) => [key, raw.get(key) ?? 0]),
  );
  return { score, byKey };
}

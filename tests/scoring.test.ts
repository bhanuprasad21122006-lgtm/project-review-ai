import { describe, expect, test } from "bun:test";
import {
  CATEGORIES,
  calculateScore,
  clampScore,
  clampSeverity,
} from "../src/convex/lib/scoring";

describe("CATEGORIES weights", () => {
  test("weights sum to exactly 1.0", () => {
    const sum = CATEGORIES.reduce((total, c) => total + c.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  test("has nine unique category keys", () => {
    expect(CATEGORIES).toHaveLength(9);
    const keys = new Set(CATEGORIES.map((c) => c.key));
    expect(keys.size).toBe(9);
  });
});

describe("clampScore", () => {
  test("clamps values above 100 and below 0", () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-5)).toBe(0);
  });

  test("rounds fractional values", () => {
    expect(clampScore(82.4)).toBe(82);
    expect(clampScore(82.6)).toBe(83);
  });

  test("maps non-numeric garbage to 0", () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(undefined)).toBe(0);
    expect(clampScore("80" as unknown as number)).toBe(0);
  });
});

describe("clampSeverity", () => {
  test("accepts known severities case-insensitively", () => {
    expect(clampSeverity("critical")).toBe("critical");
    expect(clampSeverity("HIGH")).toBe("high");
    expect(clampSeverity("Medium")).toBe("medium");
    expect(clampSeverity("low")).toBe("low");
  });

  test("falls back to medium for unknown values", () => {
    expect(clampSeverity("bogus")).toBe("medium");
    expect(clampSeverity(undefined)).toBe("medium");
    expect(clampSeverity(42 as unknown as string)).toBe("medium");
  });
});

describe("calculateScore", () => {
  test("returns the same score when every category scores equally", () => {
    const categories = CATEGORIES.map((c) => ({ key: c.key, score: 70 }));
    expect(calculateScore(categories).score).toBe(70);
  });

  test("computes a transparent weighted average", () => {
    const baseline = CATEGORIES.map((c) => ({ key: c.key, score: 50 }));
    expect(calculateScore(baseline).score).toBe(50);

    // Architecture (0.15) and Security (0.15) carry the most weight. Raising
    // only those two to 100 moves 30% of the weight from 50 to 100: 65.
    const boosted = baseline.map((c) =>
      c.key === "architecture" || c.key === "security" ? { ...c, score: 100 } : c,
    );
    expect(calculateScore(boosted).score).toBe(65);
  });

  test("renormalizes when some categories are missing", () => {
    expect(calculateScore([{ key: "documentation", score: 100 }]).score).toBe(100);
    expect(
      calculateScore([
        { key: "documentation", score: 0 },
        { key: "testing", score: 100 },
      ]).score,
    ).toBe(50);
  });

  test("ignores unknown category keys from AI output", () => {
    const result = calculateScore([
      { key: "documentation", score: 80 },
      { key: "made_up_category", score: 0 },
    ]);
    expect(result.score).toBe(80);
  });

  test("clamps invalid category scores before averaging", () => {
    const result = calculateScore([
      { key: "documentation", score: 100 },
      { key: "testing", score: 999 },
      { key: "security", score: -20 },
    ]);
    // Clamped to 100 + 100 + 0 over weights 0.1 + 0.1 + 0.15:
    // 20 / 0.35 = 57.14 -> 57.
    expect(result.score).toBe(57);
  });

  test("returns 0 for empty input", () => {
    expect(calculateScore([]).score).toBe(0);
  });
});

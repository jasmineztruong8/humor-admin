import { describe, expect, it } from "vitest";
import { daysAgo, modelHealth, percentile } from "@/lib/stats";

describe("percentile", () => {
  it("finds the median and the slowest 5%", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 0.5)).toBe(50);
    expect(percentile(values, 0.95)).toBe(95);
    expect(percentile([7], 0.95)).toBe(7);
  });

  it("is null with nothing to measure", () => {
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("modelHealth", () => {
  it("groups calls by model, busiest first, timing only answered calls", () => {
    const health = modelHealth([
      { model: "a", status: "ok", latency_ms: 1000 },
      { model: "a", status: "quota", latency_ms: 50 },
      { model: "a", status: "ok", latency_ms: 3000 },
      { model: "b", status: "timeout", latency_ms: 30000 },
    ]);
    expect(health).toEqual([
      { model: "a", attempts: 3, ok: 2, quota: 1, busy: 0, medianMs: 1000 },
      { model: "b", attempts: 1, ok: 0, quota: 0, busy: 1, medianMs: null },
    ]);
  });
});

describe("daysAgo", () => {
  it("counts back whole days", () => {
    expect(daysAgo(7, new Date("2026-10-25T12:00:00Z"))).toBe("2026-10-18T12:00:00.000Z");
  });
});

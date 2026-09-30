process.env.DATABASE_URL ??= "postgresql://mock:mock@localhost:5432/mock";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const {
  categories,
  categoryWeights,
  calculateMetrics,
  mapDailyGoal,
  todayKey,
} = await import("./lifeos");
type Category = (typeof categories)[number];

describe("LifeOS Core Business Logic", () => {
  describe("Category Weights & Taxonomy", () => {
    it("should define all expected categories", () => {
      assert.deepEqual(categories, [
        "career",
        "learning",
        "health",
        "mind",
        "routine",
        "personal",
      ]);
    });

    it("should have total active weights summing to 1.0 (100%)", () => {
      const totalWeight = Object.values(categoryWeights).reduce(
        (sum, w) => sum + (w as number),
        0,
      );
      assert.equal(Math.round(totalWeight * 100) / 100, 1.0);
    });
  });

  describe("todayKey()", () => {
    it("should format date as YYYY-MM-DD for standard timezone", () => {
      const key = todayKey("Asia/Calcutta");
      assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
    });

    it("should support UTC timezone", () => {
      const keyUtc = todayKey("UTC");
      assert.match(keyUtc, /^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("mapDailyGoal()", () => {
    it("should calculate correct percentage clamped at 100% when exceeding target", () => {
      const mapped = mapDailyGoal({
        id: 1,
        goalId: 10,
        name: "Cardio",
        category: "health",
        targetValue: "30",
        currentValue: "45",
        unit: "minutes",
        status: "completed",
        priority: 1,
      });

      assert.equal(mapped.currentValue, 45);
      assert.equal(mapped.targetValue, 30);
      assert.equal(mapped.percent, 100, "Completion percentage should clamp at 100%");
    });

    it("should set percentage to 0 when status is skipped", () => {
      const mapped = mapDailyGoal({
        id: 2,
        goalId: 11,
        name: "Rest day",
        category: "health",
        targetValue: "30",
        currentValue: "20",
        unit: "minutes",
        status: "skipped",
        priority: 2,
      });

      assert.equal(mapped.percent, 0, "Skipped goals must contribute 0% completion");
      assert.equal(mapped.status, "skipped");
    });
  });

  describe("calculateMetrics()", () => {
    it("should return zero metrics for empty goals list", () => {
      const metrics = calculateMetrics([]);
      assert.equal(metrics.totalCount, 0);
      assert.equal(metrics.completedCount, 0);
      assert.equal(metrics.dailyCompletion, 0);
      assert.equal(metrics.dailyScore, 0);
      assert.equal(metrics.contributions.length, categories.length);
    });

    it("should calculate weighted daily score accurately across categories", () => {
      const sampleGoals = [
        {
          id: 1,
          goalId: 1,
          name: "Job Applications",
          category: "career" as Category,
          targetValue: 10,
          currentValue: 10,
          unit: "apps",
          status: "completed" as const,
          percent: 100,
          priority: 1,
        },
        {
          id: 2,
          goalId: 2,
          name: "Study",
          category: "learning" as Category,
          targetValue: 60,
          currentValue: 30,
          unit: "mins",
          status: "in_progress" as const,
          percent: 50,
          priority: 1,
        },
      ];

      const metrics = calculateMetrics(sampleGoals);

      assert.equal(metrics.totalCount, 2);
      assert.equal(metrics.completedCount, 1);
      assert.ok(metrics.dailyScore > 0, "Daily score should be positive");
      assert.equal(metrics.dailyCompletion, 75); // (100 + 50) / 2
    });
  });
});

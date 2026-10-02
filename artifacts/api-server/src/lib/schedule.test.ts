process.env.DATABASE_URL ??= "postgresql://mock:mock@localhost:5432/mock";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { doesScheduleRecurOnDate, listDatesInRange } = await import("./services/schedule-service");

describe("Schedule Recurrence Logic", () => {
  const baseSchedule: any = {
    id: 1,
    userId: 1,
    title: "Java Study",
    description: null,
    startAt: "18:00",
    durationMinutes: 120,
    timezone: "Asia/Calcutta",
    recurrence: "none",
    startDate: "2026-10-01",
    endDate: null,
    enabled: true,
    status: "active",
    goalId: null,
    taskId: null,
    reminderEnabled: false,
    reminderMinutesBefore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("One-time schedules (none)", () => {
    it("should occur only on start date", () => {
      const schedule = { ...baseSchedule, recurrence: "none", startDate: "2026-10-05" };
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-05"), true);
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-06"), false);
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-04"), false);
    });
  });

  describe("Daily recurrence", () => {
    it("should occur every day within date bounds", () => {
      const schedule = { ...baseSchedule, recurrence: "daily", startDate: "2026-10-01", endDate: "2026-10-03" };
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-01"), true);
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-02"), true);
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-03"), true);
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-04"), false, "Past end date");
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-09-30"), false, "Before start date");
    });
  });

  describe("Weekdays recurrence", () => {
    it("should occur on Mon-Fri and not on Sat-Sun", () => {
      const schedule = { ...baseSchedule, recurrence: "weekdays", startDate: "2026-10-01" };
      // 2026-10-02 is Friday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-02"), true, "Friday is weekday");
      // 2026-10-03 is Saturday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-03"), false, "Saturday is weekend");
      // 2026-10-04 is Sunday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-04"), false, "Sunday is weekend");
      // 2026-10-05 is Monday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-05"), true, "Monday is weekday");
    });
  });

  describe("Weekends recurrence", () => {
    it("should occur only on Sat-Sun", () => {
      const schedule = { ...baseSchedule, recurrence: "weekends", startDate: "2026-10-01" };
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-02"), false, "Friday");
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-03"), true, "Saturday");
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-04"), true, "Sunday");
    });
  });

  describe("Custom weekly days (weekly:MON,WED,FRI)", () => {
    it("should match selected weekdays", () => {
      const schedule = { ...baseSchedule, recurrence: "weekly:MON,WED,FRI", startDate: "2026-10-01" };
      // 2026-10-05 = Monday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-05"), true, "Monday");
      // 2026-10-06 = Tuesday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-06"), false, "Tuesday");
      // 2026-10-07 = Wednesday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-07"), true, "Wednesday");
      // 2026-10-08 = Thursday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-08"), false, "Thursday");
      // 2026-10-09 = Friday
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-09"), true, "Friday");
    });
  });

  describe("Every N days (every_n_days:3)", () => {
    it("should recur every 3 days starting from startDate", () => {
      const schedule = { ...baseSchedule, recurrence: "every_n_days:3", startDate: "2026-10-01" };
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-01"), true, "Day 0");
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-02"), false, "Day 1");
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-03"), false, "Day 2");
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-04"), true, "Day 3");
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-07"), true, "Day 6");
    });
  });

  describe("Disabled schedules", () => {
    it("should not recur when enabled is false", () => {
      const schedule = { ...baseSchedule, recurrence: "daily", enabled: false, startDate: "2026-10-01" };
      assert.equal(doesScheduleRecurOnDate(schedule, "2026-10-02"), false);
    });
  });

  describe("listDatesInRange() helper", () => {
    it("should generate all dates inclusively", () => {
      const dates = listDatesInRange("2026-10-01", "2026-10-05");
      assert.deepEqual(dates, [
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
        "2026-10-04",
        "2026-10-05",
      ]);
    });
  });
});

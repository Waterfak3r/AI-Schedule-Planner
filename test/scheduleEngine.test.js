const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildDaySchedule,
  buildWeekSchedule,
  ScheduleValidationError,
} = require("../server/scheduleEngine");

test("buildDaySchedule places tasks around fixed events and buffers", () => {
  const result = buildDaySchedule({
    date: "2026-04-20",
    dayStart: "08:00",
    dayEnd: "18:00",
    fixedEvents: [{ title: "Class", start: "09:00", end: "10:00", bufferMin: 15 }],
    tasks: [
      { title: "Deep Work", durationMin: 60, priority: 5, category: "study", energy: "high" },
      { title: "Workout", durationMin: 45, priority: 3, category: "workout" },
    ],
  });

  assert.equal(result.weekdayLabel, "周一");
  assert.deepEqual(
    result.blocks.map((block) => `${block.type}:${block.title}:${block.start}-${block.end}`),
    [
      "task:Workout:08:00-08:45",
      "buffer:Class · 通勤缓冲:08:45-09:00",
      "fixed:Class:09:00-10:00",
      "buffer:Class · 收尾缓冲:10:00-10:15",
      "task:Deep Work:10:15-11:15",
    ]
  );
  assert.deepEqual(result.stats, {
    taskMinutes: 105,
    fixedMinutes: 60,
    minutesByCategory: {
      workout: 45,
      study: 60,
    },
  });
});

test("buildWeekSchedule assigns weekly target tasks across candidate weekdays", () => {
  const result = buildWeekSchedule({
    startDate: "2026-04-20",
    dayCount: 7,
    dayStart: "08:00",
    dayEnd: "18:00",
    tasks: [
      {
        title: "Gym",
        durationMin: 45,
        priority: 4,
        weeklyTargetCount: 3,
        daysOfWeek: [1, 3, 5],
      },
    ],
  });

  assert.equal(result.totals.okDays, 7);
  assert.deepEqual(result.assignmentIssues, []);
  assert.deepEqual(result.taskAssignments, [
    {
      id: "",
      title: "Gym",
      desiredCount: 3,
      assignedCount: 3,
      dates: ["2026-04-20", "2026-04-22", "2026-04-24"],
    },
  ]);
});

test("buildDaySchedule rejects overlapping fixed events", () => {
  assert.throws(
    () =>
      buildDaySchedule({
        date: "2026-04-20",
        dayStart: "08:00",
        dayEnd: "18:00",
        fixedEvents: [
          { title: "Class A", start: "09:00", end: "10:00" },
          { title: "Class B", start: "09:30", end: "10:30" },
        ],
      }),
    (error) => {
      assert.ok(error instanceof ScheduleValidationError);
      assert.equal(error.message, "硬约束存在冲突，请先修正后再生成日程");
      assert.ok(error.issues.some((issue) => issue.code === "FIXED_OVERLAP"));
      return true;
    }
  );
});

test("buildDaySchedule rejects buffer collisions between fixed events", () => {
  assert.throws(
    () =>
      buildDaySchedule({
        date: "2026-04-20",
        dayStart: "08:00",
        dayEnd: "18:00",
        fixedEvents: [
          { title: "Commute In", start: "09:00", end: "10:00", bufferMin: 20 },
          { title: "Commute Out", start: "10:25", end: "11:00", bufferMin: 20 },
        ],
      }),
    (error) => {
      assert.ok(error instanceof ScheduleValidationError);
      assert.ok(error.issues.some((issue) => issue.code === "BUFFER_COLLISION"));
      return true;
    }
  );
});

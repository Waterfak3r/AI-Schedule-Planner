const test = require("node:test");
const assert = require("node:assert/strict");

const {
  previewScheduleActions,
  applyScheduleActions,
} = require("../server/scheduleActionService");

function buildRequest({ blocks, actions }) {
  return {
    date: "2026-04-20",
    dayStart: "08:00",
    dayEnd: "18:00",
    scheduleBlocks: blocks,
    actions,
  };
}

function findResult(preview, index) {
  return preview.results.find((item) => item.index === index);
}

test("previewScheduleActions validates add_task_block cases", async (t) => {
  const baseBlocks = [
    { type: "task", title: "Deep Work", start: "10:00", end: "11:00" },
    { type: "fixed", title: "Class", start: "13:00", end: "14:00", bufferMin: 15 },
  ];

  await t.test("applies a legal insertion", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: baseBlocks,
        actions: [{ type: "add_task_block", title: "Plan", start: "15:30", end: "16:00" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(preview.summary.inputScheduleValid, true);
    assert.equal(result.status, "applied");
    assert.equal(result.createdBlock.title, "Plan");
    assert.ok(preview.nextSchedule.blocks.some((block) => block.title === "Plan"));
  });

  await t.test("marks invalid times", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: baseBlocks,
        actions: [{ type: "add_task_block", title: "Plan", start: "16:00", end: "15:30" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "invalid");
    assert.match(result.message, /时间格式无效/);
  });

  await t.test("marks conflicts against existing schedule blocks", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: baseBlocks,
        actions: [{ type: "add_task_block", title: "Plan", start: "13:30", end: "14:30" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "conflict");
    assert.equal(result.conflictingBlocks.length, 1);
    assert.equal(result.conflictingBlocks[0].title, "Class");
    assert.ok(result.scheduleIssues.some((issue) => issue.code === "TASK_CONFLICTS_FIXED"));
  });

  await t.test("recomputes fixed-event buffer ranges instead of trusting client input", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          {
            type: "fixed",
            title: "Class",
            start: "13:00",
            end: "14:00",
            bufferMin: 30,
            blockedStartMin: 13 * 60,
            blockedEndMin: 14 * 60,
          },
        ],
        actions: [{ type: "add_task_block", title: "Warmup", start: "12:40", end: "12:55" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "conflict");
    assert.equal(result.conflictingBlocks.length, 1);
    assert.equal(result.conflictingBlocks[0].occupiedStart, "12:30");
    assert.equal(result.conflictingBlocks[0].occupiedEnd, "14:30");
  });

  await t.test("marks duplicate titles as ambiguous", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [{ type: "task", title: "Plan", start: "09:00", end: "09:30" }],
        actions: [{ type: "add_task_block", title: "Plan", start: "10:00", end: "10:30" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "ambiguous");
    assert.equal(result.matchedBlocks.length, 1);
    assert.equal(result.matchedBlocks[0].title, "Plan");
  });
});

test("previewScheduleActions enforces exact matching for move_block", async (t) => {
  await t.test("moves a uniquely exact-matched task", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "task", title: "Deep Work", start: "10:00", end: "11:00" },
          { type: "fixed", title: "Class", start: "13:00", end: "14:00", bufferMin: 15 },
        ],
        actions: [{ type: "move_block", matchTitle: "Deep Work", start: "15:00", end: "16:00" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "applied");
    assert.equal(result.updatedBlock.start, "15:00");
    assert.equal(result.updatedBlock.end, "16:00");
  });

  await t.test("moves a uniquely exact-matched fixed block", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "fixed", title: "Class", start: "13:00", end: "14:00", bufferMin: 15 },
          { type: "task", title: "Deep Work", start: "10:00", end: "11:00" },
        ],
        actions: [{ type: "move_block", matchTitle: "Class", start: "15:00", end: "16:00" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "applied");
    assert.equal(result.updatedBlock.type, "fixed");
    assert.equal(result.updatedBlock.start, "15:00");
    assert.equal(result.updatedBlock.end, "16:00");
    assert.equal(result.updatedBlock.bufferMin, 15);
    assert.ok(preview.nextSchedule.blocks.some((block) => block.title === "Class" && block.start === "15:00"));
  });

  await t.test("checks moved fixed-block buffer conflicts", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "fixed", title: "Class", start: "13:00", end: "14:00", bufferMin: 15 },
          { type: "task", title: "Deep Work", start: "14:20", end: "15:00" },
        ],
        actions: [{ type: "move_block", matchTitle: "Class", start: "13:30", end: "14:15" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "conflict");
    assert.equal(result.conflictingBlocks.length, 1);
    assert.equal(result.conflictingBlocks[0].title, "Deep Work");
    assert.ok(result.scheduleIssues.some((issue) => issue.code === "TASK_CONFLICTS_FIXED"));
  });

  await t.test("returns skipped on zero exact matches", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [{ type: "task", title: "Deep Work", start: "10:00", end: "11:00" }],
        actions: [{ type: "move_block", matchTitle: "Email", start: "15:00", end: "16:00" }],
      })
    );

    assert.equal(findResult(preview, 0).status, "skipped");
  });

  await t.test("returns ambiguous on multiple exact matches", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "task", title: "Review", start: "09:00", end: "09:30" },
          { type: "task", title: "Review", start: "16:00", end: "16:30" },
        ],
        actions: [{ type: "move_block", matchTitle: "Review", start: "12:00", end: "12:30" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "ambiguous");
    assert.equal(result.matchedBlocks.length, 2);
  });

  await t.test("does not execute on substring-only matches", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [{ type: "task", title: "Deep Work Session", start: "10:00", end: "11:00" }],
        actions: [{ type: "move_block", matchTitle: "Deep Work", start: "15:00", end: "16:00" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "skipped");
    assert.equal(result.diagnosticMatches.length, 1);
    assert.equal(result.diagnosticMatches[0].title, "Deep Work Session");
    assert.ok(
      preview.nextSchedule.blocks.some(
        (block) => block.title === "Deep Work Session" && block.start === "10:00"
      )
    );
  });

  await t.test("returns invalid on out-of-range times", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [{ type: "task", title: "Deep Work", start: "10:00", end: "11:00" }],
        actions: [{ type: "move_block", matchTitle: "Deep Work", start: "07:30", end: "08:30" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "invalid");
    assert.match(result.message, /时间超出可规划范围/);
  });
});

test("previewScheduleActions enforces exact matching for remove_block", async (t) => {
  await t.test("removes a uniquely exact-matched task", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "task", title: "Email", start: "11:30", end: "12:00" },
          { type: "task", title: "Deep Work", start: "10:00", end: "11:00" },
        ],
        actions: [{ type: "remove_block", matchTitle: "Email" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "applied");
    assert.equal(result.removedBlock.title, "Email");
    assert.ok(preview.nextSchedule.blocks.every((block) => block.title !== "Email"));
  });

  await t.test("removes a uniquely exact-matched fixed block", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "fixed", title: "Class", start: "13:00", end: "14:00", bufferMin: 15 },
          { type: "task", title: "Deep Work", start: "10:00", end: "11:00" },
        ],
        actions: [{ type: "remove_block", matchTitle: "Class" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "applied");
    assert.equal(result.removedBlock.type, "fixed");
    assert.equal(result.removedBlock.title, "Class");
    assert.ok(preview.nextSchedule.blocks.every((block) => block.title !== "Class"));
  });

  await t.test("returns skipped on zero exact matches", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [{ type: "task", title: "Deep Work", start: "10:00", end: "11:00" }],
        actions: [{ type: "remove_block", matchTitle: "Email" }],
      })
    );

    assert.equal(findResult(preview, 0).status, "skipped");
  });

  await t.test("returns ambiguous on multiple exact matches", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "task", title: "Review", start: "09:00", end: "09:30" },
          { type: "task", title: "Review", start: "16:00", end: "16:30" },
        ],
        actions: [{ type: "remove_block", matchTitle: "Review" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "ambiguous");
    assert.equal(result.matchedBlocks.length, 2);
  });

  await t.test("does not execute on substring-only matches", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [{ type: "task", title: "Inbox Email", start: "10:00", end: "10:30" }],
        actions: [{ type: "remove_block", matchTitle: "Email" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(result.status, "skipped");
    assert.equal(result.diagnosticMatches.length, 1);
    assert.equal(result.diagnosticMatches[0].title, "Inbox Email");
    assert.ok(preview.nextSchedule.blocks.some((block) => block.title === "Inbox Email"));
  });
});

test("previewScheduleActions blocks action execution when the input schedule is already invalid", async (t) => {
  await t.test("returns conflict results for overlapping task blocks", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "task", title: "Task A", start: "10:00", end: "11:00" },
          { type: "task", title: "Task B", start: "10:30", end: "11:30" },
        ],
        actions: [{ type: "remove_block", matchTitle: "Task A" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(preview.summary.inputScheduleValid, false);
    assert.equal(preview.summary.inputScheduleStatus, "conflict");
    assert.equal(preview.nextSchedule, null);
    assert.equal(result.status, "conflict");
    assert.ok(result.scheduleIssues.some((issue) => issue.code === "TASK_OVERLAP"));
  });

  await t.test("returns conflict results for fixed-event buffer collisions", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [
          { type: "fixed", title: "Commute In", start: "09:00", end: "10:00", bufferMin: 20 },
          { type: "fixed", title: "Commute Out", start: "10:25", end: "11:00", bufferMin: 20 },
        ],
        actions: [{ type: "add_task_block", title: "Plan", start: "12:00", end: "12:30" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(preview.summary.inputScheduleValid, false);
    assert.equal(preview.summary.inputScheduleStatus, "conflict");
    assert.equal(preview.nextSchedule, null);
    assert.equal(result.status, "conflict");
    assert.ok(result.scheduleIssues.some((issue) => issue.code === "BUFFER_COLLISION"));
  });

  await t.test("returns invalid results for out-of-range blocks", () => {
    const preview = previewScheduleActions(
      buildRequest({
        blocks: [{ type: "task", title: "Early Task", start: "07:30", end: "08:30" }],
        actions: [{ type: "move_block", matchTitle: "Early Task", start: "09:00", end: "10:00" }],
      })
    );

    const result = findResult(preview, 0);
    assert.equal(preview.summary.inputScheduleValid, false);
    assert.equal(preview.summary.inputScheduleStatus, "invalid");
    assert.equal(preview.nextSchedule, null);
    assert.equal(result.status, "invalid");
    assert.ok(result.scheduleIssues.some((issue) => issue.code === "TASK_OUTSIDE_DAY"));
  });
});

test("applyScheduleActions stays stateless and returns apply mode", () => {
  const request = buildRequest({
    blocks: [{ type: "task", title: "Deep Work", start: "10:00", end: "11:00" }],
    actions: [{ type: "move_block", matchTitle: "Deep Work", start: "15:00", end: "16:00" }],
  });

  const first = applyScheduleActions(request);
  const second = applyScheduleActions(request);

  assert.equal(first.mode, "apply");
  assert.equal(second.mode, "apply");
  assert.equal(first.results[0].status, "applied");
  assert.equal(first.nextSchedule.blocks.find((block) => block.title === "Deep Work").start, "15:00");
  assert.equal(second.nextSchedule.blocks.find((block) => block.title === "Deep Work").start, "15:00");
  assert.equal(request.scheduleBlocks[0].start, "10:00");
  assert.equal(request.scheduleBlocks[0].end, "11:00");
});

const test = require("node:test");
const assert = require("node:assert/strict");

const { generateSleepReminder } = require("../server/reminderEngine");

test("generateSleepReminder returns readable Chinese reminder text", () => {
  const result = generateSleepReminder({
    tone: "snarky",
    bedtime: "23:15",
    wakeTime: "07:30",
    stats: {
      minutesByCategory: {
        study: 150,
      },
    },
  });

  assert.equal(result.scenario, "study_heavy");
  assert.equal(result.tone, "snarky");
  assert.match(result.text, /23:15/);
  assert.match(result.text, /海马体|关屏|错觉/);
  assert.doesNotMatch(result.text, /�|瀛︿範|浠ｇ爜|杩愬姩/);
});

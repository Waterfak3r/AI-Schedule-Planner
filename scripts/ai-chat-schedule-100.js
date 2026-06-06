const fs = require("fs");
const path = require("path");
const { generateChatReply } = require("../server/aiClient");
const { previewScheduleActions } = require("../server/scheduleActionService");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const rootDir = path.resolve(__dirname, "..");
loadDotEnv(path.join(rootDir, ".env"));

const baseSchedule = {
  date: "2026-06-06",
  dayStart: "00:00",
  dayEnd: "24:00",
  blocks: [
    { type: "fixed", id: "fixed-class", runtimeId: "fixed-class-1", title: "课程", start: "09:00", end: "10:00", bufferMin: 0 },
    { type: "task", id: "task-vocab", runtimeId: "task-vocab-1", title: "背单词", start: "10:30", end: "11:00", category: "study", energy: "medium", priority: 3 },
    { type: "task", id: "task-code", runtimeId: "task-code-1", title: "写代码", start: "14:00", end: "15:00", category: "code", energy: "high", priority: 4 },
    { type: "task", id: "task-gym", runtimeId: "task-gym-1", title: "Gym", start: "18:00", end: "18:45", category: "workout", energy: "medium", priority: 3 },
    { type: "task", id: "task-math", runtimeId: "task-math-1", title: "复习数学", start: "19:00", end: "20:00", category: "study", energy: "medium", priority: 4 },
  ],
};

const context = {
  planDate: baseSchedule.date,
  wakeTime: "07:30",
  bedtime: "23:30",
  hasSchedule: true,
  scheduleSummary: `blocks=${baseSchedule.blocks.length}, unscheduled=0, done=0%`,
  scheduleBlocks: baseSchedule.blocks.map((block) => ({
    title: block.title,
    start: block.start,
    end: block.end,
    type: block.type,
    category: block.category || "",
  })),
};

const addCases = [
  ["zh-add-001", "今晚7点到8点阅读", "阅读", "19:00", "20:00"],
  ["zh-add-002", "八点20到九点10学英语", "学英语", ["08:20", "20:20"], ["09:10", "21:10"]],
  ["zh-add-003", "晚上8：三十到9：10复盘", "复盘", "20:30", "21:10"],
  ["zh-add-004", "晚上九点;40到十点20写报告", "写报告", "21:40", "22:20"],
  ["zh-add-005", "19点5到19点35整理房间", "整理房间", "19:05", "19:35"],
  ["zh-add-006", "七点半到八点跑步", "跑步", ["07:30", "19:30"], ["08:00", "20:00"]],
  ["zh-add-007", "给我加个13:15-13:45午休", "午休", "13:15", "13:45"],
  ["zh-add-008", "明早8点到8点25背书", "背书", "08:00", "08:25"],
  ["zh-add-009", "十六点到十七点做PPT", "做PPT", "16:00", "17:00"],
  ["zh-add-010", "下午三点一刻到四点开组会", "组会", "15:15", "16:00"],
  ["zh-add-011", "晚上11点到11点20拉伸", "拉伸", "23:00", "23:20"],
  ["zh-add-012", "中午12点到12点半吃饭", "吃饭", "12:00", "12:30"],
  ["zh-add-013", "14：00-14：50 读论文", "读论文", "14:00", "14:50"],
  ["zh-add-014", "15;10到15;55 debug", "debug", "15:10", "15:55"],
  ["zh-add-015", "晚上六点四十到七点十分买东西", "买东西", "18:40", "19:10"],
  ["zh-add-016", "8.30-9.00 冥想", "冥想", "08:30", "09:00"],
  ["zh-add-017", "22:10 至 22:40 复盘今天", "复盘今天", "22:10", "22:40"],
  ["zh-add-018", "帮我在17:05~17:35安排洗衣服", "洗衣服", "17:05", "17:35"],
  ["zh-add-019", "晚上8点零5到8点35看书", "看书", "20:05", "20:35"],
  ["zh-add-020", "一点半到两点处理邮件", "处理邮件", "13:30", "14:00"],
  ["en-add-021", "Add reading from 4pm to 4:30pm.", "reading", "16:00", "16:30"],
  ["en-add-022", "Schedule project planning 11:15-noon.", "project planning", "11:15", "12:00"],
  ["en-add-023", "Put laundry at 17:05-17:35.", "laundry", "17:05", "17:35"],
  ["en-add-024", "Add a quick walk between 7:30 and 8 pm.", "walk", "19:30", "20:00"],
  ["en-add-025", "Need meditation 8.30-9.00", "meditation", "08:30", "09:00"],
  ["en-add-026", "Please create dinner 18:40 to 19:10.", "dinner", "18:40", "19:10"],
  ["en-add-027", "slot in report writing from 21:40 to 22:20", "report writing", "21:40", "22:20"],
  ["en-add-028", "new task: email cleanup 13:30-14:00", "email cleanup", "13:30", "14:00"],
  ["en-add-029", "Can you add stretch 23:00-23:20?", "stretch", "23:00", "23:20"],
  ["en-add-030", "Block 15:10-15:55 for debugging.", "debugging", "15:10", "15:55"],
].map(([id, user, title, start, end]) => ({
  id,
  user,
  group: "add",
  expected: [
    Array.isArray(start) || Array.isArray(end)
      ? { type: "add_task_block", titleIncludes: title, startOneOf: start, endOneOf: end }
      : { type: "add_task_block", titleIncludes: title, start, end },
  ],
}));

const moveCases = [
  ["zh-move-031", "把写代码改到15:30-16:00", "写代码", "15:30", "16:00"],
  ["zh-move-032", "代码下午三点半到四点", "写代码", "15:30", "16:00"],
  ["zh-move-033", "背单词推迟到11:30-12:00", "背单词", "11:30", "12:00"],
  ["zh-move-034", "Gym提前到17:00-17:45", "Gym", "17:00", "17:45"],
  ["zh-move-035", "数学改到八点半到九点", "复习数学", "20:30", "21:00"],
  ["zh-move-036", "把课程挪到10:00-11:00", "课程", "10:00", "11:00"],
  ["zh-move-037", "写代吗放到15:30到16:30", "写代码", "15:30", "16:30"],
  ["zh-move-038", "把背单词往后挪半小时", "背单词", "11:00", "11:30"],
  ["zh-move-039", "复习数学提前到18:00-19:00", "复习数学", "18:00", "19:00"],
  ["zh-move-040", "Gym 17点到17点45", "Gym", "17:00", "17:45"],
  ["zh-move-041", "写代码 16点;20到17点;20", "写代码", "16:20", "17:20"],
  ["zh-move-042", "背单词 8：三十到9：00", "背单词", "08:30", "09:00"],
  ["zh-move-043", "把数学拖到晚上九点;40到十点20", "复习数学", "21:40", "22:20"],
  ["zh-move-044", "课程改成上午十点半到十一点半", "课程", "10:30", "11:30"],
  ["zh-move-045", "写代码不要14点了，改15点到16点", "写代码", "15:00", "16:00"],
  ["en-move-046", "Move Gym to 17:00-17:45.", "Gym", "17:00", "17:45"],
  ["en-move-047", "Shift coding to 3:30pm-4:30pm.", "写代码", "15:30", "16:30"],
  ["en-move-048", "Put vocab at 11:30-12:00.", "背单词", "11:30", "12:00"],
  ["en-move-049", "Reschedule math review to 20:30-21:00.", "复习数学", "20:30", "21:00"],
  ["en-move-050", "Move class to 10:00-11:00.", "课程", "10:00", "11:00"],
  ["en-move-051", "code block 16:20-17:20 please", "写代码", "16:20", "17:20"],
  ["en-move-052", "delay vocab by 30 minutes", "背单词", "11:00", "11:30"],
  ["en-move-053", "bring Gym forward to 5pm-5:45pm", "Gym", "17:00", "17:45"],
  ["en-move-054", "math 9:40pm to 10:20pm", "复习数学", "21:40", "22:20"],
  ["en-move-055", "change course to 10:30-11:30", "课程", "10:30", "11:30"],
].map(([id, user, matchTitle, start, end]) => ({
  id,
  user,
  group: "move",
  expected: [{ type: "move_block", matchTitleIncludes: matchTitle, start, end }],
}));

const removeCases = [
  ["zh-remove-056", "取消Gym", "Gym"],
  ["zh-remove-057", "复习数学删掉", "复习数学"],
  ["zh-remove-058", "写代码不要了", "写代码"],
  ["zh-remove-059", "背单词去掉", "背单词"],
  ["zh-remove-060", "课程先移除", "课程"],
  ["zh-remove-061", "删了Gym吧", "Gym"],
  ["zh-remove-062", "数学复习不做了", "复习数学"],
  ["zh-remove-063", "把写代码这个块取消", "写代码"],
  ["zh-remove-064", "今天不背单词了", "背单词"],
  ["zh-remove-065", "课程从日程里拿掉", "课程"],
  ["en-remove-066", "Delete Gym.", "Gym"],
  ["en-remove-067", "Remove math review.", "复习数学"],
  ["en-remove-068", "Cancel coding.", "写代码"],
  ["en-remove-069", "Drop vocab.", "背单词"],
  ["en-remove-070", "Remove class from schedule.", "课程"],
  ["en-remove-071", "delte Gym", "Gym"],
  ["en-remove-072", "cnacel coding block", "写代码"],
  ["en-remove-073", "skip vocab today", "背单词"],
  ["en-remove-074", "No math review today", "复习数学"],
  ["en-remove-075", "take out course", "课程"],
].map(([id, user, matchTitle]) => ({
  id,
  user,
  group: "remove",
  expected: [{ type: "remove_block", matchTitleIncludes: matchTitle }],
}));

const multiCases = [
  {
    id: "multi-076",
    user: "7点半到8点跑步，8点到8点半洗澡",
    group: "multi",
    expected: [
      { type: "add_task_block", titleIncludes: "跑步", startOneOf: ["07:30", "19:30"], endOneOf: ["08:00", "20:00"] },
      { type: "add_task_block", titleIncludes: "洗澡", startOneOf: ["08:00", "20:00"], endOneOf: ["08:30", "20:30"] },
    ],
  },
  {
    id: "multi-077",
    user: "把写代码改到16:00-17:00，顺便删掉Gym",
    group: "multi",
    expected: [
      { type: "move_block", matchTitleIncludes: "写代码", start: "16:00", end: "17:00" },
      { type: "remove_block", matchTitleIncludes: "Gym" },
    ],
  },
  {
    id: "multi-078",
    user: "Add reading 16:00-16:30 and move Gym to 17:00-17:45.",
    group: "multi",
    expected: [
      { type: "add_task_block", titleIncludes: "reading", start: "16:00", end: "16:30" },
      { type: "move_block", matchTitleIncludes: "Gym", start: "17:00", end: "17:45" },
    ],
  },
  {
    id: "multi-079",
    user: "背单词改11:30-12:00，再加一个22:10-22:40复盘",
    group: "multi",
    expected: [
      { type: "move_block", matchTitleIncludes: "背单词", start: "11:30", end: "12:00" },
      { type: "add_task_block", titleIncludes: "复盘", start: "22:10", end: "22:40" },
    ],
  },
  {
    id: "multi-080",
    user: "Delete Gym and cancel math review.",
    group: "multi",
    expected: [
      { type: "remove_block", matchTitleIncludes: "Gym" },
      { type: "remove_block", matchTitleIncludes: "复习数学" },
    ],
  },
];

const ambiguousCases = [
  ["amb-081", "明天学习一下"],
  ["amb-082", "帮我调整一下写代码"],
  ["amb-083", "晚上安排点东西"],
  ["amb-084", "I need to study tomorrow"],
  ["amb-085", "move it later"],
  ["amb-086", "delete that"],
  ["amb-087", "八点以后别太累"],
  ["amb-088", "maybe gym sometime"],
  ["amb-089", "周末看看数学"],
  ["amb-090", "安排一下"],
].map(([id, user]) => ({
  id,
  user,
  group: "ambiguous",
  expected: [],
  expectNoAction: true,
}));

const specialCases = [
  {
    id: "special-091-user-example",
    user: "我这周日晚上七点半要到教一601考试，然后大概九点要去居酒屋",
    group: "special",
    expected: [
      { type: "add_task_block", titleIncludes: "考试", start: "19:30", end: "21:00" },
      { type: "add_task_block", titleIncludes: "居酒屋", start: "21:00", end: "21:30" },
    ],
    textIncludes: ["30", "不确定", "修改"],
    note: "当前 action schema 没有 date 字段；居酒屋缺结束时间时按 30 分钟暂定，AI 文本应提醒用户自行修改。",
  },
  {
    id: "special-092-date-specific",
    user: "这周日19:30-21:00教一601考试",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "考试", start: "19:30", end: "21:00" }],
    note: "schema 无 date 字段，只能记录时间块，无法落到周日。",
  },
  {
    id: "special-093-start-only",
    user: "九点去居酒屋",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "居酒屋", startOneOf: ["09:00", "21:00"], endOneOf: ["09:30", "21:30"] }],
    textIncludes: ["30", "不确定", "修改"],
    note: "只有开始时间，没有结束时间；按 30 分钟暂定，AI 文本应提醒用户自行修改。",
  },
  {
    id: "special-094-location",
    user: "19:30-21:00在教一601考试",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "考试", start: "19:30", end: "21:00" }],
  },
  {
    id: "special-095-typo-time",
    user: "8：三十-9；40 刷题",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "刷题", start: "08:30", end: "09:40" }],
  },
  {
    id: "special-096-half",
    user: "晚上七点半到九点考试",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "考试", start: "19:30", end: "21:00" }],
  },
  {
    id: "special-097-semi",
    user: "九点;40到十点20复盘",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "复盘", startOneOf: ["09:40", "21:40"], endOneOf: ["10:20", "22:20"] }],
  },
  {
    id: "special-098-english-start-only",
    user: "Bar at 9 tonight",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "Bar", start: "21:00", end: "21:30" }],
    textIncludes: ["30", "不确定", "修改"],
    note: "Only a start time is provided; default to 30 minutes and tell the user to adjust.",
  },
  {
    id: "special-099-english-location",
    user: "Exam in room Jiao 1-601 from 7:30pm to 9pm this Sunday.",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "Exam", start: "19:30", end: "21:00" }],
    note: "schema 无 date 字段，只能记录时间块，无法落到周日。",
  },
  {
    id: "special-100-noisy",
    user: "额那个...晚上8：三十吧到9点10，搞一下英语听力",
    group: "special",
    expected: [{ type: "add_task_block", titleIncludes: "英语听力", start: "20:30", end: "21:10" }],
  },
];

const cases = [...addCases, ...moveCases, ...removeCases, ...multiCases, ...ambiguousCases, ...specialCases];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function includesLoose(actual, expected) {
  if (!expected) return true;
  const left = normalizeText(actual);
  const right = normalizeText(expected);
  if (left.includes(right)) return true;
  if (right === "写代码" && /code|coding|代码|写代/.test(left)) return true;
  if (right === "复习数学" && /math|数学/.test(left)) return true;
  if (right === "背单词" && /vocab|word|单词/.test(left)) return true;
  if (right === "课程" && /class|course|课/.test(left)) return true;
  return false;
}

function actionMatchesExpected(action, expected) {
  if (!action || action.type !== expected.type) return false;
  if (expected.titleIncludes && !includesLoose(action.title, expected.titleIncludes)) return false;
  if (expected.matchTitleIncludes && !includesLoose(action.matchTitle, expected.matchTitleIncludes)) return false;
  if (expected.start && action.start !== expected.start) return false;
  if (expected.end && action.end !== expected.end) return false;
  if (expected.startOneOf && !expected.startOneOf.includes(action.start)) return false;
  if (expected.endOneOf && !expected.endOneOf.includes(action.end)) return false;
  return true;
}

function compareActions(actions, expected, expectNoAction) {
  const mismatches = [];
  const safeActions = Array.isArray(actions) ? actions : [];
  if (expectNoAction) {
    if (safeActions.length > 0) mismatches.push(`expected no action, got ${safeActions.length}`);
    return { ok: mismatches.length === 0, mismatches };
  }

  const used = new Set();
  for (const item of expected) {
    const index = safeActions.findIndex((action, actionIndex) => !used.has(actionIndex) && actionMatchesExpected(action, item));
    if (index < 0) {
      const startText = item.start || (item.startOneOf ? `[${item.startOneOf.join("/")}]` : "");
      const endText = item.end || (item.endOneOf ? `[${item.endOneOf.join("/")}]` : "");
      mismatches.push(`missing ${item.type} ${item.titleIncludes || item.matchTitleIncludes || ""} ${startText}-${endText}`.trim());
      continue;
    }
    used.add(index);
  }
  if (safeActions.length > expected.length) {
    mismatches.push(`unexpected extra actions=${safeActions.length - expected.length}`);
  }
  return { ok: mismatches.length === 0, mismatches };
}

function summarizeAction(action) {
  return [
    action.type,
    action.title ? `title=${action.title}` : "",
    action.matchTitle ? `match=${action.matchTitle}` : "",
    action.start && action.end ? `${action.start}-${action.end}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizePreview(preview) {
  const results = Array.isArray(preview?.results) ? preview.results : [];
  return results.map((item) => ({
    action: item.action?.type || "",
    status: item.status || "",
    reason: item.reason || "",
    title: item.action?.title || item.action?.matchTitle || "",
  }));
}

async function runCase(testCase) {
  const startedAt = Date.now();
  const reply = await generateChatReply({
    messages: [{ role: "user", content: testCase.user }],
    context,
  });
  const actions = Array.isArray(reply.actions) ? reply.actions : [];
  const comparison = compareActions(actions, testCase.expected, testCase.expectNoAction);
  for (const requiredText of testCase.textIncludes || []) {
    if (!normalizeText(reply.text).includes(normalizeText(requiredText))) {
      comparison.mismatches.push(`missing AI text "${requiredText}"`);
    }
  }
  comparison.ok = comparison.mismatches.length === 0;
  let preview = null;
  let previewError = "";
  try {
    preview = actions.length
      ? previewScheduleActions({
          date: baseSchedule.date,
          dayStart: baseSchedule.dayStart,
          dayEnd: baseSchedule.dayEnd,
          scheduleBlocks: baseSchedule.blocks,
          actions,
        })
      : null;
  } catch (error) {
    previewError = error?.message || String(error);
  }
  return {
    id: testCase.id,
    group: testCase.group,
    user: testCase.user,
    expected: testCase.expected,
    expectNoAction: Boolean(testCase.expectNoAction),
    triggered: actions.length > 0,
    semanticMatch: comparison.ok,
    mismatches: comparison.mismatches,
    actions,
    preview: preview ? summarizePreview(preview) : null,
    previewError,
    aiText: reply.text,
    model: reply.model,
    note: testCase.note || "",
    elapsedMs: Date.now() - startedAt,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCaseWithRetry(testCase, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await runCase(testCase);
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(1500 * attempt);
      }
    }
  }

  throw lastError;
}

async function runApiPreflight() {
  try {
    const reply = await generateChatReply({
      messages: [{ role: "user", content: "请简短回复：连接测试。" }],
      context,
    });
    return { ok: true, model: reply.model, error: "" };
  } catch (error) {
    return { ok: false, model: process.env.RELAY_MODEL || process.env.OPENAI_MODEL || "", error: error?.message || String(error) };
  }
}

function failedResult(testCase, message, model) {
  return {
    id: testCase.id,
    group: testCase.group,
    user: testCase.user,
    expected: testCase.expected,
    expectNoAction: Boolean(testCase.expectNoAction),
    triggered: false,
    semanticMatch: false,
    mismatches: [message],
    actions: [],
    preview: null,
    previewError: "",
    aiText: "",
    model,
    note: testCase.note || "",
    elapsedMs: 0,
  };
}

function isTransientFailureResult(result) {
  return (
    !result.semanticMatch &&
    Array.isArray(result.mismatches) &&
    result.mismatches.some((item) => /fetch failed|timed out|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(String(item)))
  );
}

function toMarkdown(results, apiPreflight) {
  const total = results.length;
  const triggered = results.filter((item) => item.triggered).length;
  const semanticMatches = results.filter((item) => item.semanticMatch).length;
  const previewApplied = results.filter((item) => item.preview?.every((entry) => entry.status === "applied") ?? item.expectNoAction).length;
  const lines = [];
  lines.push("# AI 对话修改日程 100 次压力测试记录");
  lines.push("");
  lines.push(`生成时间：${new Date().toISOString()}`);
  lines.push(`模型：${apiPreflight.model || process.env.RELAY_MODEL || process.env.OPENAI_MODEL || ""}`);
  lines.push(`API 预检：${apiPreflight.ok ? "通过" : `失败 - ${apiPreflight.error}`}`);
  lines.push(`总数：${total}`);
  lines.push(`触发修改：${triggered}/${total}`);
  lines.push(`语义一致：${semanticMatches}/${total}`);
  lines.push(`Preview 全部 applied 或按预期无动作：${previewApplied}/${total}`);
  lines.push("");
  lines.push("| ID | 组 | 用户话术 | 触发 | 语义一致 | 动作 | Preview | 问题/备注 |");
  lines.push("|---|---|---|---:|---:|---|---|---|");
  for (const item of results) {
    const actionText = item.actions.map(summarizeAction).join("<br>");
    const previewText = item.preview
      ? item.preview.map((entry) => `${entry.action}:${entry.status}${entry.reason ? `(${entry.reason})` : ""}`).join("<br>")
      : item.expectNoAction
        ? "(no action expected)"
        : item.previewError || "";
    const issueText = [...item.mismatches, item.note].filter(Boolean).join("<br>");
    lines.push(
      `| ${item.id} | ${item.group} | ${item.user.replace(/\|/g, "\\|")} | ${item.triggered ? "是" : "否"} | ${
        item.semanticMatch ? "是" : "否"
      } | ${actionText.replace(/\|/g, "\\|")} | ${previewText.replace(/\|/g, "\\|")} | ${issueText.replace(/\|/g, "\\|")} |`
    );
  }
  lines.push("");
  lines.push("## 原始结果");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({ apiPreflight, results }, null, 2));
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  if (cases.length !== 100) throw new Error(`expected 100 cases, got ${cases.length}`);
  const reportDir = path.join(rootDir, "docs");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "AI_CHAT_SCHEDULE_100_CALLS.md");

  process.stdout.write("[AI-100] API preflight\n");
  const apiPreflight = await runApiPreflight();
  process.stdout.write(`[AI-100] API preflight ok=${apiPreflight.ok}${apiPreflight.error ? ` error=${apiPreflight.error}` : ""}\n`);

  const results = [];
  if (!apiPreflight.ok) {
    for (const testCase of cases) results.push(failedResult(testCase, apiPreflight.error, apiPreflight.model));
  } else {
    for (let index = 0; index < cases.length; index += 1) {
      const testCase = cases[index];
      process.stdout.write(`[AI-100] ${index + 1}/100 ${testCase.id}: ${testCase.user}\n`);
      try {
        const { result, attempts } = await runCaseWithRetry(testCase);
        results.push(result);
        process.stdout.write(
          `[AI-100] -> triggered=${result.triggered} semantic=${result.semanticMatch} actions=${result.actions.length} elapsed=${result.elapsedMs}ms attempts=${attempts}\n`
        );
      } catch (error) {
        const message = error?.message || String(error);
        results.push(failedResult(testCase, message, apiPreflight.model));
        process.stdout.write(`[AI-100] -> ERROR ${message}\n`);
      }
      fs.writeFileSync(reportPath, toMarkdown(results, apiPreflight), "utf8");
    }

    for (let pass = 1; pass <= 3; pass += 1) {
      const retryIndexes = results
        .map((result, index) => (isTransientFailureResult(result) ? index : -1))
        .filter((index) => index >= 0);
      if (retryIndexes.length === 0) break;

      process.stdout.write(`[AI-100] retry pass ${pass}: ${retryIndexes.length} transient failures\n`);
      for (const resultIndex of retryIndexes) {
        const testCase = cases[resultIndex];
        process.stdout.write(`[AI-100] retry ${resultIndex + 1}/100 ${testCase.id}: ${testCase.user}\n`);
        try {
          await sleep(3000);
          const retryResult = await runCaseWithRetry(testCase, 5);
          results[resultIndex] = retryResult.result;
          process.stdout.write(
            `[AI-100] retry -> triggered=${retryResult.result.triggered} semantic=${retryResult.result.semanticMatch} actions=${retryResult.result.actions.length} elapsed=${retryResult.result.elapsedMs}ms attempts=${retryResult.attempts}\n`
          );
        } catch (error) {
          const message = error?.message || String(error);
          results[resultIndex] = failedResult(testCase, message, apiPreflight.model);
          process.stdout.write(`[AI-100] retry -> ERROR ${message}\n`);
        }
        fs.writeFileSync(reportPath, toMarkdown(results, apiPreflight), "utf8");
      }
    }
  }

  fs.writeFileSync(reportPath, toMarkdown(results, apiPreflight), "utf8");
  const summary = {
    total: results.length,
    triggered: results.filter((item) => item.triggered).length,
    semanticMatch: results.filter((item) => item.semanticMatch).length,
    previewClean: results.filter((item) => item.preview?.every((entry) => entry.status === "applied") ?? item.expectNoAction).length,
    reportPath,
  };
  process.stdout.write(`[AI-100] SUMMARY ${JSON.stringify(summary)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

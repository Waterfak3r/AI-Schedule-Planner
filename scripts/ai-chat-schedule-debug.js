const fs = require("fs");
const path = require("path");
const { generateChatReply } = require("../server/aiClient");
const { previewScheduleActions, applyScheduleActions } = require("../server/scheduleActionService");

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
    {
      type: "fixed",
      id: "fixed-class",
      runtimeId: "fixed-class-1",
      title: "课程",
      start: "09:00",
      end: "10:00",
      bufferMin: 0,
    },
    {
      type: "task",
      id: "task-vocab",
      runtimeId: "task-vocab-1",
      title: "背单词",
      start: "10:30",
      end: "11:00",
      category: "study",
      energy: "medium",
      priority: 3,
    },
    {
      type: "task",
      id: "task-code",
      runtimeId: "task-code-1",
      title: "写代码",
      start: "14:00",
      end: "15:00",
      category: "code",
      energy: "high",
      priority: 4,
    },
    {
      type: "task",
      id: "task-gym",
      runtimeId: "task-gym-1",
      title: "Gym",
      start: "18:00",
      end: "18:45",
      category: "workout",
      energy: "medium",
      priority: 3,
    },
    {
      type: "task",
      id: "task-math",
      runtimeId: "task-math-1",
      title: "复习数学",
      start: "19:00",
      end: "20:00",
      category: "study",
      energy: "medium",
      priority: 4,
    },
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

const cases = [
  {
    id: "zh-add-direct",
    language: "zh",
    style: "direct",
    user: "把阅读安排到16:00-16:30",
    expect: { type: "add_task_block", titleIncludes: "阅读", start: "16:00", end: "16:30" },
  },
  {
    id: "zh-add-colloquial",
    language: "zh",
    style: "colloquial",
    user: "今晚8点到8点半背单词",
    expect: { type: "move_block", matchTitleIncludes: "背单词", start: "20:00", end: "20:30" },
  },
  {
    id: "zh-move-direct",
    language: "zh",
    style: "direct",
    user: "把写代码挪到15:30-16:30",
    expect: { type: "move_block", matchTitleIncludes: "写代码", start: "15:30", end: "16:30" },
  },
  {
    id: "zh-remove-short",
    language: "zh",
    style: "short",
    user: "复习数学删了",
    expect: { type: "remove_block", matchTitleIncludes: "复习数学" },
  },
  {
    id: "zh-omitted-verb",
    language: "zh",
    style: "omitted",
    user: "写代码 15:30-16:00",
    expect: { type: "move_block", matchTitleIncludes: "写代码", start: "15:30", end: "16:00" },
  },
  {
    id: "zh-natural-time",
    language: "zh",
    style: "natural time",
    user: "数学改到八点半到九点",
    expect: { type: "move_block", matchTitleIncludes: "复习数学", start: "20:30", end: "21:00" },
  },
  {
    id: "zh-typo-title",
    language: "zh",
    style: "typo",
    user: "帮我把写代吗挪到15:30到16:30",
    expect: { type: "move_block", matchTitleIncludes: "写代码", start: "15:30", end: "16:30" },
  },
  {
    id: "en-move-direct",
    language: "en",
    style: "direct",
    user: "Move Gym to 17:00-17:45.",
    expect: { type: "move_block", matchTitleIncludes: "Gym", start: "17:00", end: "17:45" },
  },
  {
    id: "en-add-natural",
    language: "en",
    style: "natural",
    user: "Add project planning from 11:15 to noon.",
    expect: { type: "add_task_block", titleIncludes: "project planning", start: "11:15", end: "12:00" },
  },
  {
    id: "en-remove-mixed-title",
    language: "en",
    style: "mixed title",
    user: "Delete 背单词 from my schedule.",
    expect: { type: "remove_block", matchTitleIncludes: "背单词" },
  },
  {
    id: "en-typo-delete",
    language: "en",
    style: "typo",
    user: "delte Gym",
    expect: { type: "remove_block", matchTitleIncludes: "Gym" },
  },
  {
    id: "zh-delay",
    language: "zh",
    style: "common command",
    user: "把背单词推迟到11:30-12:00",
    expect: { type: "move_block", matchTitleIncludes: "背单词", start: "11:30", end: "12:00" },
  },
];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function includesLoose(actual, expected) {
  if (!expected) return true;
  return normalizeText(actual).includes(normalizeText(expected));
}

function compareAction(action, expect) {
  const mismatches = [];
  if (!action) {
    return { ok: false, mismatches: ["no action returned"] };
  }
  if (action.type !== expect.type) mismatches.push(`type expected ${expect.type}, got ${action.type}`);
  if (expect.titleIncludes && !includesLoose(action.title, expect.titleIncludes)) {
    mismatches.push(`title expected to include ${expect.titleIncludes}, got ${action.title || ""}`);
  }
  if (expect.matchTitleIncludes && !includesLoose(action.matchTitle, expect.matchTitleIncludes)) {
    mismatches.push(`matchTitle expected to include ${expect.matchTitleIncludes}, got ${action.matchTitle || ""}`);
  }
  if (expect.start && action.start !== expect.start) mismatches.push(`start expected ${expect.start}, got ${action.start || ""}`);
  if (expect.end && action.end !== expect.end) mismatches.push(`end expected ${expect.end}, got ${action.end || ""}`);
  return { ok: mismatches.length === 0, mismatches };
}

function actionFromExpectation(expect) {
  if (expect.type === "add_task_block") {
    return {
      type: "add_task_block",
      title: expect.titleIncludes,
      start: expect.start,
      end: expect.end,
      category: expect.titleIncludes && /gym|跑步|运动/i.test(expect.titleIncludes) ? "workout" : "study",
      energy: "medium",
      priority: 3,
    };
  }

  if (expect.type === "move_block") {
    return {
      type: "move_block",
      matchTitle: expect.matchTitleIncludes,
      start: expect.start,
      end: expect.end,
    };
  }

  if (expect.type === "remove_block") {
    return {
      type: "remove_block",
      matchTitle: expect.matchTitleIncludes,
    };
  }

  return null;
}

function summarizePreview(preview) {
  const results = Array.isArray(preview?.results) ? preview.results : [];
  return results.map((item) => ({
    action: item.action?.type || "",
    status: item.status || "",
    reason: item.reason || "",
    changed: item.changed || false,
    title: item.action?.title || item.action?.matchTitle || "",
  }));
}

function summarizeApplyResult(result) {
  return {
    mode: result?.mode || "",
    summary: result?.summary || {},
    results: summarizePreview(result),
    nextBlocks: Array.isArray(result?.nextSchedule?.blocks)
      ? result.nextSchedule.blocks
          .filter((block) => block.type !== "buffer")
          .map((block) => `${block.start}-${block.end} ${block.title}`)
      : [],
  };
}

function runLocalActionCheck(testCase) {
  const action = actionFromExpectation(testCase.expect);
  if (!action) {
    return {
      id: testCase.id,
      ok: false,
      action: null,
      preview: null,
      apply: null,
      error: "no expected action could be materialized",
    };
  }

  try {
    const input = {
      date: baseSchedule.date,
      dayStart: baseSchedule.dayStart,
      dayEnd: baseSchedule.dayEnd,
      scheduleBlocks: baseSchedule.blocks,
      actions: [action],
    };
    const preview = previewScheduleActions(input);
    const applied = applyScheduleActions(input);
    const statuses = Array.isArray(applied?.results) ? applied.results.map((item) => item.status) : [];
    const ok = statuses.length > 0 && statuses.every((status) => status === "applied");
    return {
      id: testCase.id,
      ok,
      action,
      preview: summarizePreview(preview),
      apply: summarizeApplyResult(applied),
      error: "",
    };
  } catch (error) {
    return {
      id: testCase.id,
      ok: false,
      action,
      preview: null,
      apply: null,
      error: error?.message || String(error),
    };
  }
}

async function runCase(testCase) {
  const startedAt = Date.now();
  const reply = await generateChatReply({
    messages: [{ role: "user", content: testCase.user }],
    context,
  });
  const actions = Array.isArray(reply.actions) ? reply.actions : [];
  const firstAction = actions[0] || null;
  const comparison = compareAction(firstAction, testCase.expect);
  let preview = null;
  let previewError = "";
  try {
    preview = previewScheduleActions({
      date: baseSchedule.date,
      dayStart: baseSchedule.dayStart,
      dayEnd: baseSchedule.dayEnd,
      scheduleBlocks: baseSchedule.blocks,
      actions,
    });
  } catch (error) {
    previewError = error?.message || String(error);
  }

  return {
    id: testCase.id,
    language: testCase.language,
    style: testCase.style,
    user: testCase.user,
    expected: testCase.expect,
    triggered: actions.length > 0,
    semanticMatch: comparison.ok,
    mismatches: comparison.mismatches,
    actions,
    preview: preview ? summarizePreview(preview) : null,
    previewError,
    aiText: reply.text,
    model: reply.model,
    elapsedMs: Date.now() - startedAt,
  };
}

async function runApiPreflight() {
  try {
    const reply = await generateChatReply({
      messages: [{ role: "user", content: "请简短回复：连接测试。" }],
      context,
    });
    return {
      ok: true,
      model: reply.model,
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      model: process.env.RELAY_MODEL || process.env.OPENAI_MODEL || "",
      error: error?.message || String(error),
    };
  }
}

function failedAiResultFromCase(testCase, errorMessage, model) {
  return {
    id: testCase.id,
    language: testCase.language,
    style: testCase.style,
    user: testCase.user,
    expected: testCase.expect,
    triggered: false,
    semanticMatch: false,
    mismatches: [errorMessage],
    actions: [],
    preview: null,
    previewError: "",
    aiText: "",
    model: model || process.env.RELAY_MODEL || process.env.OPENAI_MODEL || "",
    elapsedMs: 0,
  };
}

function toMarkdown(results, localActionChecks, apiPreflight) {
  const lines = [];
  lines.push("# AI 对话修改日程调试记录");
  lines.push("");
  lines.push(`生成时间：${new Date().toISOString()}`);
  lines.push(`模型：${apiPreflight?.model || results.find((item) => item.model)?.model || process.env.RELAY_MODEL || process.env.OPENAI_MODEL || ""}`);
  lines.push(`API 预检：${apiPreflight?.ok ? "通过" : `失败 - ${apiPreflight?.error || ""}`}`);
  lines.push("");
  lines.push("| ID | 用户话术 | 触发修改 | 语义一致 | 动作 | Preview | 问题 |");
  lines.push("|---|---|---:|---:|---|---|---|");
  for (const item of results) {
    const actionText = item.actions
      .map((action) =>
        [
          action.type,
          action.title ? `title=${action.title}` : "",
          action.matchTitle ? `match=${action.matchTitle}` : "",
          action.start && action.end ? `${action.start}-${action.end}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join("<br>");
    const previewText = item.preview
      ? item.preview.map((entry) => `${entry.action}:${entry.status}${entry.reason ? `(${entry.reason})` : ""}`).join("<br>")
      : item.previewError || "";
    const issueText = item.mismatches.length > 0 ? item.mismatches.join("<br>") : "";
    lines.push(
      `| ${item.id} | ${item.user.replace(/\|/g, "\\|")} | ${item.triggered ? "是" : "否"} | ${
        item.semanticMatch ? "是" : "否"
      } | ${actionText.replace(/\|/g, "\\|")} | ${previewText.replace(/\|/g, "\\|")} | ${issueText.replace(/\|/g, "\\|")} |`
    );
  }
  lines.push("");
  lines.push("## 本地动作应用链路校验");
  lines.push("");
  lines.push("这部分不调用 AI，只把期望动作直接送入 `previewScheduleActions` / `applyScheduleActions`，用于确认日程修改服务本身是否能正确执行。");
  lines.push("");
  lines.push("| ID | 通过 | 动作 | Preview | Apply | 问题 |");
  lines.push("|---|---:|---|---|---|---|");
  for (const item of localActionChecks) {
    const actionText = item.action
      ? [
          item.action.type,
          item.action.title ? `title=${item.action.title}` : "",
          item.action.matchTitle ? `match=${item.action.matchTitle}` : "",
          item.action.start && item.action.end ? `${item.action.start}-${item.action.end}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "";
    const previewText = item.preview
      ? item.preview.map((entry) => `${entry.action}:${entry.status}${entry.reason ? `(${entry.reason})` : ""}`).join("<br>")
      : "";
    const applyText = item.apply?.results
      ? item.apply.results.map((entry) => `${entry.action}:${entry.status}${entry.reason ? `(${entry.reason})` : ""}`).join("<br>")
      : "";
    lines.push(
      `| ${item.id} | ${item.ok ? "是" : "否"} | ${actionText.replace(/\|/g, "\\|")} | ${previewText.replace(
        /\|/g,
        "\\|"
      )} | ${applyText.replace(/\|/g, "\\|")} | ${(item.error || "").replace(/\|/g, "\\|")} |`
    );
  }
  lines.push("");
  lines.push("## 原始结果");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({ apiPreflight, aiDialogResults: results, localActionChecks }, null, 2));
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const results = [];

  process.stdout.write("[AI-DEBUG] API preflight\n");
  const apiPreflight = await runApiPreflight();
  process.stdout.write(`[AI-DEBUG] API preflight ok=${apiPreflight.ok}${apiPreflight.error ? ` error=${apiPreflight.error}` : ""}\n`);

  if (!apiPreflight.ok) {
    for (const testCase of cases) {
      results.push(failedAiResultFromCase(testCase, apiPreflight.error, apiPreflight.model));
    }
  } else {
    for (const testCase of cases) {
      process.stdout.write(`[AI-DEBUG] ${testCase.id}: ${testCase.user}\n`);
      try {
        const result = await runCase(testCase);
        results.push(result);
        process.stdout.write(
          `[AI-DEBUG] -> triggered=${result.triggered} semanticMatch=${result.semanticMatch} actions=${result.actions.length} elapsed=${result.elapsedMs}ms\n`
        );
      } catch (error) {
        results.push(failedAiResultFromCase(testCase, error?.message || String(error), apiPreflight.model));
        process.stdout.write(`[AI-DEBUG] -> ERROR ${error?.message || String(error)}\n`);
      }
    }
  }

  const localActionChecks = cases.map(runLocalActionCheck);

  const reportDir = path.join(rootDir, "docs");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "AI_CHAT_SCHEDULE_DEBUG.md");
  fs.writeFileSync(reportPath, toMarkdown(results, localActionChecks, apiPreflight), "utf8");

  const summary = {
    total: results.length,
    triggered: results.filter((item) => item.triggered).length,
    semanticMatch: results.filter((item) => item.semanticMatch).length,
    localActionChecks: localActionChecks.filter((item) => item.ok).length,
    reportPath,
  };
  process.stdout.write(`[AI-DEBUG] SUMMARY ${JSON.stringify(summary)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

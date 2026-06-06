const { clampInt, isPlainObject } = require("./utils");
const { minutesToTime, parseTimeToMinutes } = require("./time");
const { normalizeActionInputs } = require("./scheduleActions");
const {
  PlannerInputError,
  buildDisplayBlocks,
  classifyScheduleIssueStatus,
  formatRange,
  intervalsOverlap,
  parseIsoDate,
  toIsoDate,
  summarizeBlocks,
  validateScheduleSnapshot,
} = require("./scheduleEngine");

let previewBlockCounter = 0;

function makePreviewRuntimeId() {
  previewBlockCounter += 1;
  return `preview-block-${previewBlockCounter}`;
}

function normalizeTitle(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sortBlocksByTime(blocks) {
  return blocks.sort((left, right) => {
    const startDiff = left.startMin - right.startMin;
    if (startDiff !== 0) return startDiff;
    const endDiff = left.endMin - right.endMin;
    if (endDiff !== 0) return endDiff;
    return String(left.title || "").localeCompare(String(right.title || ""));
  });
}

function cloneBlocks(blocks) {
  return blocks.map((block) => ({ ...block }));
}

function summarizeScheduleBlock(block) {
  return {
    runtimeId: block.runtimeId,
    id: block.id,
    type: block.type,
    title: block.title,
    start: minutesToTime(block.startMin),
    end: minutesToTime(block.endMin),
    startMin: block.startMin,
    endMin: block.endMin,
    durationMin: block.endMin - block.startMin,
    category: block.category || "other",
    energy: block.energy || "medium",
    priority: block.priority ?? 3,
    bufferMin: block.bufferMin || 0,
    manual: Boolean(block.manual),
  };
}

function occupiedRangeForBlock(block) {
  if (block.type === "fixed") {
    const bufferMin = clampInt(block.bufferMin ?? 0, 0, 180);
    return {
      startMin: block.blockedStartMin ?? block.startMin - bufferMin,
      endMin: block.blockedEndMin ?? block.endMin + bufferMin,
    };
  }

  return {
    startMin: block.startMin,
    endMin: block.endMin,
  };
}

function makeConflictSummary(block) {
  const occupied = occupiedRangeForBlock(block);
  return {
    ...summarizeScheduleBlock(block),
    occupiedStart: minutesToTime(occupied.startMin),
    occupiedEnd: minutesToTime(occupied.endMin),
    occupiedRange: formatRange(occupied.startMin, occupied.endMin),
  };
}

function resolveScheduleDate(input) {
  const rawDate = input?.date ?? input?.schedule?.date;
  const parsedDate = parseIsoDate(rawDate);
  if (!parsedDate) {
    throw new PlannerInputError("date is required (YYYY-MM-DD)");
  }
  return toIsoDate(parsedDate);
}

function resolveScheduleWindow(input) {
  const dayStart = input?.dayStart ?? input?.schedule?.dayStart ?? "00:00";
  const dayEnd = input?.dayEnd ?? input?.schedule?.dayEnd ?? "24:00";
  const dayStartMin = parseTimeToMinutes(dayStart);
  const dayEndMin = parseTimeToMinutes(dayEnd);

  if (dayStartMin == null || dayEndMin == null) {
    throw new PlannerInputError("dayStart / dayEnd must be valid HH:MM");
  }

  if (dayEndMin <= dayStartMin) {
    throw new PlannerInputError("dayEnd must be later than dayStart");
  }

  return { dayStartMin, dayEndMin };
}

function resolveRawScheduleBlocks(input) {
  if (!isPlainObject(input)) {
    throw new PlannerInputError("request body must be a JSON object");
  }

  if (input.schedule != null && !isPlainObject(input.schedule)) {
    throw new PlannerInputError("schedule must be an object");
  }

  if (input?.schedule?.blocks != null && !Array.isArray(input.schedule.blocks)) {
    throw new PlannerInputError("schedule.blocks must be an array");
  }

  if (input?.scheduleBlocks != null && !Array.isArray(input.scheduleBlocks)) {
    throw new PlannerInputError("scheduleBlocks must be an array");
  }

  if (Array.isArray(input?.schedule?.blocks)) {
    return input.schedule.blocks;
  }

  if (Array.isArray(input?.scheduleBlocks)) {
    return input.scheduleBlocks;
  }

  return [];
}

function resolveRawActions(input) {
  if (input?.actions != null && !Array.isArray(input.actions)) {
    throw new PlannerInputError("actions must be an array");
  }

  return Array.isArray(input?.actions) ? input.actions : [];
}

function readMinuteValue(rawMinutes, rawTime) {
  if (rawMinutes != null && String(rawMinutes).trim() !== "") {
    const minutes = Number(rawMinutes);
    if (Number.isFinite(minutes)) return Math.floor(minutes);
  }

  return parseTimeToMinutes(rawTime);
}

function normalizeScheduleBlock(raw, index) {
  if (!isPlainObject(raw)) {
    throw new PlannerInputError(`schedule.blocks[${index}] must be an object`);
  }

  const type = String(raw.type || "").trim().toLowerCase();
  if (!["task", "fixed", "buffer"].includes(type)) {
    throw new PlannerInputError(`schedule.blocks[${index}] has unsupported type`);
  }

  if (type === "buffer") {
    return null;
  }

  const startMin = readMinuteValue(raw.startMin, raw.start);
  const endMin = readMinuteValue(raw.endMin, raw.end);
  if (startMin == null || endMin == null || endMin <= startMin) {
    throw new PlannerInputError(`schedule.blocks[${index}] must include a valid time range`);
  }

  const titleFallback = type === "fixed" ? `固定日程 ${index + 1}` : `任务 ${index + 1}`;
  const bufferMin = type === "fixed" ? clampInt(raw.bufferMin ?? 0, 0, 180) : 0;
  const blockedStartMin = type === "fixed" ? startMin - bufferMin : startMin;
  const blockedEndMin = type === "fixed" ? endMin + bufferMin : endMin;

  return {
    type,
    id: String(raw.id || ""),
    runtimeId: String(raw.runtimeId || makePreviewRuntimeId()),
    title: String(raw.title || "").trim() || titleFallback,
    startMin,
    endMin,
    category: String(raw.category || "other"),
    energy: String(raw.energy || "medium"),
    priority: clampInt(raw.priority ?? 3, 1, 5),
    bufferMin,
    sourceTitle: String(raw.sourceTitle || ""),
    sourceId: String(raw.sourceId || ""),
    partial: Boolean(raw.partial),
    manual: Boolean(raw.manual),
    blockedStartMin: type === "fixed" ? blockedStartMin : startMin,
    blockedEndMin: type === "fixed" ? blockedEndMin : endMin,
  };
}

function normalizeScheduleContext(input) {
  const date = resolveScheduleDate(input);
  const { dayStartMin, dayEndMin } = resolveScheduleWindow(input);
  const rawBlocks = resolveRawScheduleBlocks(input);
  const blocks = sortBlocksByTime(
    rawBlocks
      .map((block, index) => normalizeScheduleBlock(block, index))
      .filter(Boolean)
  );

  return {
    date,
    dayStartMin,
    dayEndMin,
    blocks,
  };
}

function materializeScheduleSnapshot({ date, dayStartMin, dayEndMin, blocks }) {
  const baseBlocks = sortBlocksByTime(cloneBlocks(blocks));
  const fixedBlocks = baseBlocks.filter((block) => block.type === "fixed");
  const taskBlocks = baseBlocks.filter((block) => block.type === "task");
  const displayBlocks = [...buildDisplayBlocks(fixedBlocks, dayStartMin, dayEndMin), ...taskBlocks]
    .sort((left, right) => {
      const startDiff = left.startMin - right.startMin;
      if (startDiff !== 0) return startDiff;
      return left.endMin - right.endMin;
    })
    .map((block) => ({
      ...block,
      start: minutesToTime(block.startMin),
      end: minutesToTime(block.endMin),
      durationMin: block.endMin - block.startMin,
    }));

  return {
    date,
    dayStart: minutesToTime(dayStartMin),
    dayEnd: minutesToTime(dayEndMin),
    blocks: displayBlocks,
    stats: summarizeBlocks(displayBlocks),
    appliedCounts: {
      fixedEvents: fixedBlocks.length,
      tasks: taskBlocks.length,
    },
  };
}

function ensureActionRangeWithinDay(action, dayStartMin, dayEndMin) {
  const startMin = parseTimeToMinutes(action.start);
  const endMin = parseTimeToMinutes(action.end);

  if (startMin == null || endMin == null || endMin <= startMin) {
    return {
      ok: false,
      reason: "时间格式无效或结束时间不晚于开始时间",
    };
  }

  if (startMin < dayStartMin || endMin > dayEndMin) {
    return {
      ok: false,
      reason: `时间超出可规划范围 ${formatRange(dayStartMin, dayEndMin)}`,
    };
  }

  return { ok: true, startMin, endMin };
}

function findDuplicateTitleBlocks(blocks, title) {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return [];
  return blocks.filter(
    (block) => block.type === "task" && normalizeTitle(block.title) === normalizedTitle
  );
}

function findEditableBlockMatchDiagnostics(blocks, matchTitle) {
  const editableBlocks = blocks.filter((block) => block.type === "task" || block.type === "fixed");
  const needle = normalizeTitle(matchTitle);

  if (!needle) {
    return {
      exactMatches: [],
      fuzzyMatches: [],
    };
  }

  const exactMatches = editableBlocks.filter((block) => normalizeTitle(block.title) === needle);
  const exactMatchIds = new Set(exactMatches.map((block) => block.runtimeId));
  const fuzzyMatches = editableBlocks.filter(
    (block) =>
      !exactMatchIds.has(block.runtimeId) && normalizeTitle(block.title).includes(needle)
  );

  return {
    exactMatches,
    fuzzyMatches,
  };
}

function findConflictingBlocks(blocks, candidate, excludeRuntimeId) {
  const candidateOccupied = occupiedRangeForBlock(candidate);
  return blocks
    .filter((block) => block.runtimeId !== excludeRuntimeId)
    .filter((block) => {
      const occupied = occupiedRangeForBlock(block);
      return intervalsOverlap(
        candidateOccupied.startMin,
        candidateOccupied.endMin,
        occupied.startMin,
        occupied.endMin
      );
    })
    .map((block) => makeConflictSummary(block));
}

function makeResult(inputIndex, action, status, message, extra = {}) {
  return {
    index: inputIndex,
    status,
    action,
    message,
    ...extra,
  };
}

function summarizeIssueList(issues) {
  return issues.map((issue) => ({
    ...issue,
    status: classifyScheduleIssueStatus(issue),
  }));
}

function deriveBlockingStatus(blockingIssues) {
  if (!Array.isArray(blockingIssues) || blockingIssues.length === 0) return null;
  return blockingIssues.some((issue) => classifyScheduleIssueStatus(issue) === "conflict")
    ? "conflict"
    : "invalid";
}

function validateInputSchedule(blocks, context) {
  const validation = validateScheduleSnapshot({
    dayStartMin: context.dayStartMin,
    dayEndMin: context.dayEndMin,
    blocks,
  });

  return {
    ok: validation.blockingIssues.length === 0,
    status: deriveBlockingStatus(validation.blockingIssues),
    issues: summarizeIssueList(validation.issues),
    blockingIssues: summarizeIssueList(validation.blockingIssues),
    warningIssues: summarizeIssueList(validation.warningIssues),
  };
}

function buildContextBlockedResult(item, mode, inputScheduleValidation) {
  if (item.errors.length > 0) {
    return makeResult(item.index, item.action, "invalid", `action 无效: ${item.errors.join(", ")}`, {
      scheduleIssues: inputScheduleValidation.blockingIssues,
    });
  }

  const verb = mode === "apply" ? "应用" : "预演";
  const reason =
    inputScheduleValidation.status === "conflict"
      ? "当前日程上下文存在冲突"
      : "当前日程上下文无效";

  return makeResult(item.index, item.action, inputScheduleValidation.status, `${reason}，无法继续${verb}`, {
    scheduleIssues: inputScheduleValidation.blockingIssues,
  });
}

function buildStrictMatchSkipResult(index, action, verb, fuzzyMatches) {
  const extra =
    fuzzyMatches.length > 0
      ? {
          diagnosticMatches: fuzzyMatches.map((block) => summarizeScheduleBlock(block)),
          diagnostics: {
            exactMatchRequired: true,
            fuzzyMatchCount: fuzzyMatches.length,
          },
        }
      : {};

  return makeResult(index, action, "skipped", `未找到可${verb}的日程：“${action.matchTitle}”`, extra);
}

function previewAddAction(item, workingBlocks, context) {
  const { action, index } = item;
  const range = ensureActionRangeWithinDay(action, context.dayStartMin, context.dayEndMin);
  if (!range.ok) {
    return makeResult(index, action, "invalid", `新增任务失败: ${range.reason}`);
  }

  const duplicateMatches = findDuplicateTitleBlocks(workingBlocks, action.title);
  if (duplicateMatches.length > 0) {
    return makeResult(index, action, "ambiguous", `任务标题“${action.title}”已存在，停止新增以避免后续匹配歧义`, {
      matchedBlocks: duplicateMatches.map((block) => summarizeScheduleBlock(block)),
    });
  }

  const createdBlock = {
    type: "task",
    id: "",
    runtimeId: makePreviewRuntimeId(),
    title: action.title,
    startMin: range.startMin,
    endMin: range.endMin,
    category: action.category || "other",
    energy: action.energy || "medium",
    priority: clampInt(action.priority ?? 3, 1, 5),
    bufferMin: 0,
    sourceTitle: "",
    sourceId: "",
    partial: false,
    manual: true,
    blockedStartMin: range.startMin,
    blockedEndMin: range.endMin,
  };

  const candidateBlocks = [...cloneBlocks(workingBlocks), createdBlock];
  const candidateValidation = validateInputSchedule(candidateBlocks, context);
  if (!candidateValidation.ok) {
    return makeResult(index, action, candidateValidation.status, `新增任务“${action.title}”会与现有日程冲突`, {
      conflictingBlocks: findConflictingBlocks(workingBlocks, createdBlock, null),
      scheduleIssues: candidateValidation.blockingIssues,
    });
  }

  workingBlocks.push(createdBlock);
  sortBlocksByTime(workingBlocks);

  return makeResult(index, action, "applied", `已预演新增任务“${action.title}”`, {
    createdBlock: summarizeScheduleBlock(createdBlock),
  });
}

function previewMoveAction(item, workingBlocks, context) {
  const { action, index } = item;
  const { exactMatches, fuzzyMatches } = findEditableBlockMatchDiagnostics(workingBlocks, action.matchTitle);
  if (exactMatches.length === 0) {
    return buildStrictMatchSkipResult(index, action, "移动", fuzzyMatches);
  }

  if (exactMatches.length > 1) {
    return makeResult(index, action, "ambiguous", `“${action.matchTitle}”命中多个日程，未执行移动`, {
      matchedBlocks: exactMatches.map((block) => summarizeScheduleBlock(block)),
    });
  }

  const target = exactMatches[0];
  const range = ensureActionRangeWithinDay(action, context.dayStartMin, context.dayEndMin);
  if (!range.ok) {
    return makeResult(index, action, "invalid", `移动日程失败: ${range.reason}`, {
      matchedBlocks: [summarizeScheduleBlock(target)],
    });
  }

  const before = summarizeScheduleBlock(target);
  const updatedBlock = {
    ...target,
    startMin: range.startMin,
    endMin: range.endMin,
    blockedStartMin: target.type === "fixed" ? range.startMin - (target.bufferMin || 0) : range.startMin,
    blockedEndMin: target.type === "fixed" ? range.endMin + (target.bufferMin || 0) : range.endMin,
    manual: true,
  };
  const candidateBlocks = workingBlocks.map((block) =>
    block.runtimeId === target.runtimeId ? updatedBlock : { ...block }
  );
  const candidateValidation = validateInputSchedule(candidateBlocks, context);
  if (!candidateValidation.ok) {
    return makeResult(index, action, candidateValidation.status, `移动“${target.title}”后会与现有日程冲突`, {
      matchedBlocks: [before],
      conflictingBlocks: findConflictingBlocks(workingBlocks, updatedBlock, target.runtimeId),
      scheduleIssues: candidateValidation.blockingIssues,
    });
  }

  target.startMin = range.startMin;
  target.endMin = range.endMin;
  target.blockedStartMin = target.type === "fixed" ? range.startMin - (target.bufferMin || 0) : range.startMin;
  target.blockedEndMin = target.type === "fixed" ? range.endMin + (target.bufferMin || 0) : range.endMin;
  target.manual = true;
  sortBlocksByTime(workingBlocks);

  return makeResult(index, action, "applied", `已预演移动日程“${target.title}”`, {
    matchedBlocks: [before],
    updatedBlock: summarizeScheduleBlock(target),
  });
}

function previewRemoveAction(item, workingBlocks) {
  const { action, index } = item;
  const { exactMatches, fuzzyMatches } = findEditableBlockMatchDiagnostics(workingBlocks, action.matchTitle);
  if (exactMatches.length === 0) {
    return buildStrictMatchSkipResult(index, action, "删除", fuzzyMatches);
  }

  if (exactMatches.length > 1) {
    return makeResult(index, action, "ambiguous", `“${action.matchTitle}”命中多个日程，未执行删除`, {
      matchedBlocks: exactMatches.map((block) => summarizeScheduleBlock(block)),
    });
  }

  const target = exactMatches[0];
  const removedBlock = summarizeScheduleBlock(target);
  const nextBlocks = workingBlocks.filter((block) => block.runtimeId !== target.runtimeId);
  workingBlocks.splice(0, workingBlocks.length, ...nextBlocks);

  return makeResult(index, action, "applied", `已预演删除日程“${target.title}”`, {
    removedBlock,
  });
}

function summarizeResults(results, inputScheduleValidation) {
  const byStatus = {
    applied: 0,
    skipped: 0,
    ambiguous: 0,
    conflict: 0,
    invalid: 0,
  };

  for (const result of results) {
    if (byStatus[result.status] != null) {
      byStatus[result.status] += 1;
    }
  }

  return {
    total: results.length,
    changed: byStatus.applied,
    byStatus,
    inputScheduleValid: inputScheduleValidation.ok,
    inputScheduleStatus: inputScheduleValidation.status,
    inputScheduleIssueCount: inputScheduleValidation.issues.length,
    inputScheduleWarningCount: inputScheduleValidation.warningIssues.length,
  };
}

function runScheduleActionPreview(input, mode) {
  const context = normalizeScheduleContext(input);
  const workingBlocks = cloneBlocks(context.blocks);
  const normalizedActions = normalizeActionInputs(resolveRawActions(input));
  const inputScheduleValidation = validateInputSchedule(workingBlocks, context);

  if (!inputScheduleValidation.ok) {
    const blockedResults = normalizedActions.map((item) =>
      buildContextBlockedResult(item, mode, inputScheduleValidation)
    );

    return {
      mode,
      date: context.date,
      dayStart: minutesToTime(context.dayStartMin),
      dayEnd: minutesToTime(context.dayEndMin),
      normalizedActions: normalizedActions.map((item) => ({
        index: item.index,
        action: item.action,
        errors: item.errors,
      })),
      results: blockedResults,
      summary: summarizeResults(blockedResults, inputScheduleValidation),
      inputScheduleValidation,
      nextSchedule: null,
    };
  }

  const results = [];
  for (const item of normalizedActions) {
    if (item.errors.length > 0) {
      results.push(
        makeResult(item.index, item.action, "invalid", `action 无效: ${item.errors.join(", ")}`)
      );
      continue;
    }

    if (item.action.type === "add_task_block") {
      results.push(previewAddAction(item, workingBlocks, context));
      continue;
    }

    if (item.action.type === "move_block") {
      results.push(previewMoveAction(item, workingBlocks, context));
      continue;
    }

    if (item.action.type === "remove_block") {
      results.push(previewRemoveAction(item, workingBlocks));
      continue;
    }

    results.push(makeResult(item.index, item.action, "invalid", "action type 不受支持"));
  }

  return {
    mode,
    date: context.date,
    dayStart: minutesToTime(context.dayStartMin),
    dayEnd: minutesToTime(context.dayEndMin),
    normalizedActions: normalizedActions.map((item) => ({
      index: item.index,
      action: item.action,
      errors: item.errors,
    })),
    results,
    summary: summarizeResults(results, inputScheduleValidation),
    inputScheduleValidation,
    nextSchedule: materializeScheduleSnapshot({
      date: context.date,
      dayStartMin: context.dayStartMin,
      dayEndMin: context.dayEndMin,
      blocks: workingBlocks,
    }),
  };
}

function previewScheduleActions(input) {
  return runScheduleActionPreview(input, "preview");
}

function applyScheduleActions(input) {
  return runScheduleActionPreview(input, "apply");
}

module.exports = {
  previewScheduleActions,
  applyScheduleActions,
};

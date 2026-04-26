const { clampInt, isPlainObject } = require("./utils");
const { minutesToTime, parseTimeToMinutes } = require("./time");

const MAX_BUFFER_MIN = 180;
const MIN_SPLIT_CHUNK_MIN = 10;
const DEFAULT_WEEK_DAY_COUNT = 7;
const MAX_WEEK_DAY_COUNT = 14;
const MAX_WEEKLY_TARGET_COUNT = 7;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = {
  0: "周日",
  1: "周一",
  2: "周二",
  3: "周三",
  4: "周四",
  5: "周五",
  6: "周六",
};

class ScheduleValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = "ScheduleValidationError";
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

class PlannerInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlannerInputError";
  }
}

function makeIssue(level, code, message) {
  return { level, code, message };
}

function weekdayOrderValue(day) {
  const idx = WEEKDAY_ORDER.indexOf(day);
  return idx >= 0 ? idx : WEEKDAY_ORDER.length;
}

function normalizeDaysOfWeek(value) {
  if (!Array.isArray(value) || value.length === 0) return null;

  const unique = [];
  const seen = new Set();
  for (const raw of value) {
    const day = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(day) || day < 0 || day > 6) continue;
    if (seen.has(day)) continue;
    seen.add(day);
    unique.push(day);
  }

  if (unique.length === 0) return null;
  return unique.sort((left, right) => weekdayOrderValue(left) - weekdayOrderValue(right));
}

function weekdayLabel(day) {
  return WEEKDAY_LABELS[day] || "未知";
}

function clampIntOr(value, fallback, min, max) {
  if (value == null || String(value).trim() === "") return fallback;
  return clampInt(value, min, max);
}

function normalizeBoundaryMinutes(rawMinutes, rawTime) {
  if (rawMinutes != null && String(rawMinutes).trim() !== "") {
    const minutes = Number(rawMinutes);
    if (Number.isFinite(minutes)) {
      return clampInt(Math.floor(minutes), 0, 24 * 60);
    }
  }

  return parseTimeToMinutes(rawTime);
}

function formatRange(startMin, endMin) {
  return `${minutesToTime(startMin)}-${minutesToTime(endMin)}`;
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function parseIsoDate(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function toIsoDate(date) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, offset) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + Number(offset || 0))
  );
}

function diffIsoDays(leftIso, rightIso) {
  const left = parseIsoDate(leftIso);
  const right = parseIsoDate(rightIso);
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(right.getTime() - left.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizePlanningDate(value) {
  if (value == null || String(value).trim() === "") return null;

  const date = parseIsoDate(value);
  if (!date) {
    throw new PlannerInputError("date / startDate 必须是 YYYY-MM-DD");
  }

  const isoDate = toIsoDate(date);
  const weekday = date.getUTCDay();
  const weekdayName = weekdayLabel(weekday);

  return {
    date,
    isoDate,
    weekday,
    weekdayLabel: weekdayName,
    dateLabel: `${isoDate} ${weekdayName}`,
  };
}

function normalizeAssignedDates(value) {
  if (!Array.isArray(value) || value.length === 0) return null;

  const dates = [];
  const seen = new Set();
  for (const raw of value) {
    const date = parseIsoDate(raw);
    if (!date) continue;
    const isoDate = toIsoDate(date);
    if (seen.has(isoDate)) continue;
    seen.add(isoDate);
    dates.push(isoDate);
  }

  return dates.length > 0 ? dates.sort() : null;
}

function appliesToWeekday(item, weekday) {
  return !item.daysOfWeek || item.daysOfWeek.includes(weekday);
}

function normalizeFixedEvents(fixedEvents) {
  const events = [];
  const issues = [];
  if (!Array.isArray(fixedEvents)) return { events, issues };

  fixedEvents.forEach((ev, index) => {
    if (!isPlainObject(ev)) {
      issues.push(makeIssue("error", "INVALID_FIXED_EVENT", `固定日程 #${index + 1} 的格式不正确`));
      return;
    }

    const title = String(ev.title || "").trim() || `固定日程 ${index + 1}`;
    const startMin = parseTimeToMinutes(ev.start);
    const endMin = parseTimeToMinutes(ev.end);
    const bufferMin = clampInt(ev.bufferMin ?? 0, 0, MAX_BUFFER_MIN);
    const daysOfWeek = normalizeDaysOfWeek(ev.daysOfWeek);
    const assignedDates = normalizeAssignedDates(ev.assignedDates);

    if (startMin == null || endMin == null) {
      issues.push(makeIssue("error", "INVALID_FIXED_TIME", `“${title}” 的开始或结束时间无效`));
      return;
    }

    if (endMin <= startMin) {
      issues.push(makeIssue("error", "INVALID_FIXED_RANGE", `“${title}” 的结束时间必须晚于开始时间`));
      return;
    }

    events.push({
      type: "fixed",
      id: String(ev.id || `fixed-${index + 1}`),
      title,
      startMin,
      endMin,
      bufferMin,
      daysOfWeek,
      assignedDates,
      blockedStartMin: startMin - bufferMin,
      blockedEndMin: endMin + bufferMin,
    });
  });

  events.sort((left, right) => left.startMin - right.startMin);
  return { events, issues };
}

function normalizeTasks(tasks) {
  const out = [];
  if (!Array.isArray(tasks)) return out;

  for (const task of tasks) {
    if (!isPlainObject(task)) continue;

    const title = String(task.title || "").trim();
    if (!title) continue;

    const weeklyTargetCountRaw = clampIntOr(
      task.weeklyTargetCount ?? task.weeklyCount ?? 0,
      0,
      0,
      MAX_WEEKLY_TARGET_COUNT
    );

    out.push({
      type: "task",
      id: String(task.id || ""),
      title,
      durationMin: clampInt(task.durationMin ?? task.durationMinutes ?? 30, 5, 8 * 60),
      priority: clampInt(task.priority ?? 3, 1, 5),
      category: String(task.category || "other"),
      energy: String(task.energy || "medium"),
      splitAllowed: Boolean(task.splitAllowed),
      earliestStartMin: normalizeBoundaryMinutes(task.earliestStartMin, task.earliestStart),
      latestEndMin: normalizeBoundaryMinutes(task.latestEndMin, task.latestEnd),
      daysOfWeek: normalizeDaysOfWeek(task.daysOfWeek),
      assignedDates: normalizeAssignedDates(task.assignedDates),
      weeklyTargetCount: weeklyTargetCountRaw > 0 ? weeklyTargetCountRaw : null,
    });
  }

  return out;
}

function taskAppliesToDate(task, planningDate) {
  if (!planningDate) {
    return !task.weeklyTargetCount;
  }

  if (task.assignedDates) return task.assignedDates.includes(planningDate.isoDate);
  if (task.weeklyTargetCount) return false;
  if (task.daysOfWeek) return task.daysOfWeek.includes(planningDate.weekday);
  return true;
}

function eventAppliesToDate(event, planningDate) {
  if (!planningDate) return true;
  if (event.assignedDates) return event.assignedDates.includes(planningDate.isoDate);
  return appliesToWeekday(event, planningDate.weekday);
}

function applyDayFilters({ fixedEvents, tasks, planningDate }) {
  return {
    fixedEvents: fixedEvents.filter((event) => eventAppliesToDate(event, planningDate)),
    tasks: tasks.filter((task) => taskAppliesToDate(task, planningDate)),
  };
}

function validateFixedEvents({ fixedEvents, dayStartMin, dayEndMin }) {
  const issues = [];
  const dayRange = formatRange(dayStartMin, dayEndMin);

  for (const event of fixedEvents) {
    if (event.startMin < dayStartMin || event.endMin > dayEndMin) {
      issues.push(
        makeIssue("error", "FIXED_OUTSIDE_DAY", `“${event.title}” 超出今日可规划时间 ${dayRange}`)
      );
      continue;
    }

    if (event.bufferMin > 0 && (event.blockedStartMin < dayStartMin || event.blockedEndMin > dayEndMin)) {
      issues.push(
        makeIssue(
          "warning",
          "BUFFER_CLIPPED",
          `“${event.title}” 的 ±${event.bufferMin} 分钟缓冲超出今日范围，已按 ${dayRange} 裁剪`
        )
      );
    }
  }

  for (let i = 0; i < fixedEvents.length; i += 1) {
    for (let j = i + 1; j < fixedEvents.length; j += 1) {
      const left = fixedEvents[i];
      const right = fixedEvents[j];

      if (intervalsOverlap(left.startMin, left.endMin, right.startMin, right.endMin)) {
        issues.push(
          makeIssue(
            "error",
            "FIXED_OVERLAP",
            `“${left.title}”(${formatRange(left.startMin, left.endMin)}) 与 “${right.title}”(${formatRange(
              right.startMin,
              right.endMin
            )}) 时间重叠`
          )
        );
        continue;
      }

      if (
        (left.bufferMin > 0 || right.bufferMin > 0) &&
        intervalsOverlap(left.blockedStartMin, left.blockedEndMin, right.blockedStartMin, right.blockedEndMin)
      ) {
        const earlier = left.endMin <= right.startMin ? left : right;
        const later = earlier === left ? right : left;
        const gapMin = Math.max(0, later.startMin - earlier.endMin);
        const requiredGapMin = earlier.bufferMin + later.bufferMin;

        issues.push(
          makeIssue(
            "error",
            "BUFFER_COLLISION",
            `“${earlier.title}” 到 “${later.title}” 之间只有 ${gapMin} 分钟，少于需要预留的 ${requiredGapMin} 分钟缓冲`
          )
        );
      }
    }
  }

  return issues;
}

function occupiedRangeForBlock(block) {
  if (block.type === "fixed") {
    const bufferMin = clampInt(block.bufferMin ?? 0, 0, MAX_BUFFER_MIN);
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

function formatBlockLabel(block) {
  return `“${block.title}”(${formatRange(block.startMin, block.endMin)})`;
}

function classifyScheduleIssueStatus(issue) {
  return /(?:OVERLAP|COLLISION|CONFLICT)/.test(String(issue?.code || "")) ? "conflict" : "invalid";
}

function validateScheduleSnapshot({ dayStartMin, dayEndMin, blocks }) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const fixedEvents = safeBlocks.filter((block) => block?.type === "fixed");
  const taskBlocks = safeBlocks.filter((block) => block?.type === "task");
  const issues = [...validateFixedEvents({ fixedEvents, dayStartMin, dayEndMin })];
  const dayRange = formatRange(dayStartMin, dayEndMin);

  for (const task of taskBlocks) {
    if (task.startMin < dayStartMin || task.endMin > dayEndMin) {
      issues.push(
        makeIssue("error", "TASK_OUTSIDE_DAY", `任务“${task.title}”超出今日可规划时间 ${dayRange}`)
      );
    }
  }

  for (let i = 0; i < taskBlocks.length; i += 1) {
    for (let j = i + 1; j < taskBlocks.length; j += 1) {
      const left = taskBlocks[i];
      const right = taskBlocks[j];

      if (intervalsOverlap(left.startMin, left.endMin, right.startMin, right.endMin)) {
        issues.push(
          makeIssue(
            "error",
            "TASK_OVERLAP",
            `${formatBlockLabel(left)} 与 ${formatBlockLabel(right)} 时间重叠`
          )
        );
      }
    }
  }

  for (const task of taskBlocks) {
    for (const fixedEvent of fixedEvents) {
      const occupied = occupiedRangeForBlock(fixedEvent);
      if (!intervalsOverlap(task.startMin, task.endMin, occupied.startMin, occupied.endMin)) continue;

      issues.push(
        makeIssue(
          "error",
          "TASK_CONFLICTS_FIXED",
          `${formatBlockLabel(task)} 与固定日程 “${fixedEvent.title}” 的占用区间 ${formatRange(
            occupied.startMin,
            occupied.endMin
          )} 冲突`
        )
      );
    }
  }

  return {
    issues,
    blockingIssues: issues.filter((issue) => issue.level === "error"),
    warningIssues: issues.filter((issue) => issue.level !== "error"),
  };
}

function mergeIntervals(intervals) {
  const sorted = intervals.slice().sort((left, right) => left.startMin - right.startMin);
  const merged = [];

  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (!last || current.startMin > last.endMin) merged.push({ ...current });
    else last.endMin = Math.max(last.endMin, current.endMin);
  }

  return merged;
}

function totalIntervalMinutes(intervals) {
  return mergeIntervals(intervals).reduce((sum, interval) => sum + (interval.endMin - interval.startMin), 0);
}

function freeIntervalsBetween(dayStartMin, dayEndMin, busyIntervals) {
  const busy = mergeIntervals(
    busyIntervals
      .map((busyRange) => ({
        startMin: Math.max(dayStartMin, busyRange.startMin),
        endMin: Math.min(dayEndMin, busyRange.endMin),
      }))
      .filter((busyRange) => busyRange.endMin > busyRange.startMin)
  );

  const free = [];
  let cursor = dayStartMin;
  for (const busyRange of busy) {
    if (busyRange.startMin > cursor) free.push({ startMin: cursor, endMin: busyRange.startMin });
    cursor = Math.max(cursor, busyRange.endMin);
  }

  if (cursor < dayEndMin) free.push({ startMin: cursor, endMin: dayEndMin });
  return free;
}

function energyWeight(energy) {
  switch (energy) {
    case "high":
      return 3;
    case "low":
      return 1;
    default:
      return 2;
  }
}

function placeTasks({ freeSlots, tasks, dayStartMin, dayEndMin }) {
  const slots = freeSlots.slice();
  const placed = [];
  const unscheduled = [];

  const sortedTasks = tasks
    .slice()
    .sort((left, right) => {
      const priorityDiff = right.priority - left.priority;
      if (priorityDiff !== 0) return priorityDiff;

      const energyDiff = energyWeight(right.energy) - energyWeight(left.energy);
      if (energyDiff !== 0) return energyDiff;

      return right.durationMin - left.durationMin;
    });

  for (const task of sortedTasks) {
    const earliest = task.earliestStartMin ?? dayStartMin;
    const latest = task.latestEndMin ?? dayEndMin;
    const need = task.durationMin;

    let scheduled = false;

    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      const start = Math.max(slot.startMin, earliest);
      const end = Math.min(slot.endMin, latest);
      const len = end - start;
      if (len < need) continue;

      placed.push({
        type: "task",
        id: task.id || "",
        title: task.title,
        category: task.category,
        energy: task.energy,
        startMin: start,
        endMin: start + need,
      });

      const left = { startMin: slot.startMin, endMin: start };
      const right = { startMin: start + need, endMin: slot.endMin };
      const next = [];
      if (left.endMin > left.startMin) next.push(left);
      if (right.endMin > right.startMin) next.push(right);
      slots.splice(i, 1, ...next);

      scheduled = true;
      break;
    }

    if (scheduled) continue;

    if (!task.splitAllowed) {
      unscheduled.push({ ...task, reason: "没有可用时间段" });
      continue;
    }

    let bestIdx = -1;
    let bestLen = 0;
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      const start = Math.max(slot.startMin, earliest);
      const end = Math.min(slot.endMin, latest);
      const len = end - start;
      if (len > bestLen) {
        bestLen = len;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestLen >= MIN_SPLIT_CHUNK_MIN) {
      const slot = slots[bestIdx];
      const start = Math.max(slot.startMin, earliest);
      const chunk = Math.min(bestLen, need);
      placed.push({
        type: "task",
        id: task.id || "",
        title: task.title,
        category: task.category,
        energy: task.energy,
        startMin: start,
        endMin: start + chunk,
        partial: chunk < need,
      });

      const left = { startMin: slot.startMin, endMin: start };
      const right = { startMin: start + chunk, endMin: slot.endMin };
      const next = [];
      if (left.endMin > left.startMin) next.push(left);
      if (right.endMin > right.startMin) next.push(right);
      slots.splice(bestIdx, 1, ...next);

      if (chunk < need) {
        unscheduled.push({
          ...task,
          reason: `仅安排了 ${chunk} 分钟，剩余 ${need - chunk} 分钟未排入`,
        });
      }
      continue;
    }

    unscheduled.push({ ...task, reason: "没有可用时间段" });
  }

  return { placed, unscheduled };
}

function buildBusyIntervals(fixedEvents) {
  return fixedEvents.map((event) => ({
    startMin: event.blockedStartMin,
    endMin: event.blockedEndMin,
  }));
}

function buildDisplayBlocks(fixedEvents, dayStartMin, dayEndMin) {
  const blocks = [];

  for (const event of fixedEvents) {
    if (event.bufferMin > 0) {
      const beforeStartMin = Math.max(dayStartMin, event.startMin - event.bufferMin);
      if (beforeStartMin < event.startMin) {
        blocks.push({
          type: "buffer",
          title: `${event.title} · 通勤缓冲`,
          sourceTitle: event.title,
          bufferMin: event.bufferMin,
          startMin: beforeStartMin,
          endMin: event.startMin,
        });
      }
    }

    blocks.push(event);

    if (event.bufferMin > 0) {
      const afterEndMin = Math.min(dayEndMin, event.endMin + event.bufferMin);
      if (event.endMin < afterEndMin) {
        blocks.push({
          type: "buffer",
          title: `${event.title} · 收尾缓冲`,
          sourceTitle: event.title,
          bufferMin: event.bufferMin,
          startMin: event.endMin,
          endMin: afterEndMin,
        });
      }
    }
  }

  return blocks;
}

function summarizeBlocks(blocks) {
  const minutesByCategory = {};
  let taskMinutes = 0;
  let fixedMinutes = 0;

  for (const block of blocks) {
    const dur = Math.max(0, (block.endMin ?? 0) - (block.startMin ?? 0));
    if (block.type === "fixed") fixedMinutes += dur;
    if (block.type === "task") {
      taskMinutes += dur;
      const key = String(block.category || "other");
      minutesByCategory[key] = (minutesByCategory[key] || 0) + dur;
    }
  }

  return { taskMinutes, fixedMinutes, minutesByCategory };
}

function buildDaySchedule(input) {
  const dayStartMin = parseTimeToMinutes(input?.dayStart ?? "00:00") ?? 0;
  const dayEndMin = parseTimeToMinutes(input?.dayEnd ?? "24:00") ?? 24 * 60;

  if (dayEndMin <= dayStartMin) {
    throw new PlannerInputError("dayEnd 必须晚于 dayStart");
  }

  const planningDate = normalizePlanningDate(input?.date);
  const { events: normalizedFixed, issues: normalizeIssues } = normalizeFixedEvents(input?.fixedEvents);
  const normalizedTasks = normalizeTasks(input?.tasks);
  const { fixedEvents, tasks } = applyDayFilters({
    fixedEvents: normalizedFixed,
    tasks: normalizedTasks,
    planningDate,
  });
  const snapshotValidation = validateScheduleSnapshot({
    dayStartMin,
    dayEndMin,
    blocks: fixedEvents,
  });
  const validationIssues = [...normalizeIssues, ...snapshotValidation.issues];
  const blockingIssues = validationIssues.filter((issue) => issue.level === "error");
  const warningIssues = validationIssues.filter((issue) => issue.level !== "error");

  if (blockingIssues.length > 0) {
    throw new ScheduleValidationError("硬约束存在冲突，请先修正后再生成日程", validationIssues);
  }

  const freeSlots = freeIntervalsBetween(dayStartMin, dayEndMin, buildBusyIntervals(fixedEvents));
  const { placed, unscheduled } = placeTasks({ freeSlots, tasks, dayStartMin, dayEndMin });

  const blocks = [...buildDisplayBlocks(fixedEvents, dayStartMin, dayEndMin), ...placed]
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
    date: planningDate?.isoDate ?? null,
    weekday: planningDate?.weekday ?? null,
    weekdayLabel: planningDate?.weekdayLabel ?? null,
    dateLabel: planningDate?.dateLabel ?? null,
    dayStart: minutesToTime(dayStartMin),
    dayEnd: minutesToTime(dayEndMin),
    blocks,
    unscheduled: unscheduled.map((task) => ({
      title: task.title,
      durationMin: task.durationMin,
      priority: task.priority,
      category: task.category,
      energy: task.energy,
      reason: task.reason,
    })),
    stats: summarizeBlocks(blocks),
    issues: warningIssues,
    appliedCounts: {
      fixedEvents: fixedEvents.length,
      tasks: tasks.length,
    },
  };
}

function makePlanningDays({ startDate, dayCount, fixedEvents }) {
  const planningDays = [];

  for (let offset = 0; offset < dayCount; offset += 1) {
    const currentDate = addDays(startDate.date, offset);
    const isoDate = toIsoDate(currentDate);
    const weekday = currentDate.getUTCDay();
    const dayFixedEvents = fixedEvents.filter((event) =>
      eventAppliesToDate(event, { isoDate, weekday })
    );
    const busyMinutes = totalIntervalMinutes(buildBusyIntervals(dayFixedEvents));

    planningDays.push({
      date: currentDate,
      isoDate,
      weekday,
      weekdayLabel: weekdayLabel(weekday),
      dateLabel: `${isoDate} ${weekdayLabel(weekday)}`,
      fixedEvents: dayFixedEvents,
      busyMinutes,
    });
  }

  return planningDays;
}

function buildDayLoadMap(planningDays) {
  const loadMap = {};
  for (const day of planningDays) {
    loadMap[day.isoDate] = {
      targetCount: 0,
      targetMinutes: 0,
      busyMinutes: day.busyMinutes,
    };
  }
  return loadMap;
}

function candidateScore({ candidate, selectedDates, dayLoad }) {
  const load = dayLoad[candidate.isoDate];
  const minDistance = selectedDates.length
    ? Math.min(...selectedDates.map((date) => diffIsoDays(date, candidate.isoDate)))
    : Number.POSITIVE_INFINITY;

  const spreadPenalty =
    minDistance === Number.POSITIVE_INFINITY ? 0 : Math.max(0, 3 - minDistance) * 140;

  return load.targetCount * 220 + load.targetMinutes + Math.round(load.busyMinutes * 0.4) + spreadPenalty;
}

function assignWeeklyTargetTasks({ targetTasks, planningDays }) {
  const derivedTasks = [];
  const assignmentIssues = [];
  const taskAssignments = [];
  const dayLoad = buildDayLoadMap(planningDays);

  const sortedTasks = targetTasks
    .slice()
    .sort((left, right) => {
      const priorityDiff = right.priority - left.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return right.durationMin - left.durationMin;
    });

  for (const task of sortedTasks) {
    const candidates = planningDays.filter((day) => appliesToWeekday(task, day.weekday));
    const desiredCount = task.weeklyTargetCount || 0;
    const selectedDates = [];
    const usedDates = new Set();

    if (candidates.length === 0) {
      assignmentIssues.push(
        makeIssue(
          "warning",
          "WEEKLY_TARGET_NO_CANDIDATE",
          `“${task.title}” 设为每周 ${desiredCount} 次，但当前预览范围内没有匹配的候选日期`
        )
      );
      taskAssignments.push({
        id: task.id || "",
        title: task.title,
        desiredCount,
        assignedCount: 0,
        dates: [],
      });
      continue;
    }

    const assignableCount = Math.min(desiredCount, candidates.length);
    for (let repeat = 0; repeat < assignableCount; repeat += 1) {
      let bestCandidate = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of candidates) {
        if (usedDates.has(candidate.isoDate)) continue;

        const score = candidateScore({ candidate, selectedDates, dayLoad });
        if (
          score < bestScore ||
          (score === bestScore &&
            bestCandidate &&
            dayLoad[candidate.isoDate].busyMinutes < dayLoad[bestCandidate.isoDate].busyMinutes)
        ) {
          bestCandidate = candidate;
          bestScore = score;
        } else if (score === bestScore && !bestCandidate) {
          bestCandidate = candidate;
          bestScore = score;
        }
      }

      if (!bestCandidate) break;

      usedDates.add(bestCandidate.isoDate);
      selectedDates.push(bestCandidate.isoDate);
      dayLoad[bestCandidate.isoDate].targetCount += 1;
      dayLoad[bestCandidate.isoDate].targetMinutes += task.durationMin;
    }

    const orderedDates = selectedDates.slice().sort();

    if (orderedDates.length > 0) {
      derivedTasks.push({
        ...task,
        assignedDates: orderedDates,
        weeklyTargetCount: null,
      });
    }

    if (orderedDates.length < desiredCount) {
      assignmentIssues.push(
        makeIssue(
          "warning",
          "WEEKLY_TARGET_PARTIAL",
          `“${task.title}” 目标为每周 ${desiredCount} 次，但当前只分配了 ${orderedDates.length} 次`
        )
      );
    }

    taskAssignments.push({
      id: task.id || "",
      title: task.title,
      desiredCount,
      assignedCount: orderedDates.length,
      dates: orderedDates,
    });
  }

  return { derivedTasks, assignmentIssues, taskAssignments };
}

function summarizeWeek(days) {
  let okDays = 0;
  let errorDays = 0;
  let taskMinutes = 0;
  let fixedMinutes = 0;
  let unscheduledCount = 0;
  let warningCount = 0;

  for (const day of days) {
    if (day.ok) {
      okDays += 1;
      taskMinutes += day.summary.taskMinutes;
      fixedMinutes += day.summary.fixedMinutes;
      unscheduledCount += day.summary.unscheduledCount;
      warningCount += day.summary.issueCount;
      continue;
    }

    errorDays += 1;
    warningCount += day.summary.issueCount;
  }

  return { okDays, errorDays, taskMinutes, fixedMinutes, unscheduledCount, warningCount };
}

function buildWeekSchedule(input) {
  const startDate = normalizePlanningDate(input?.startDate ?? input?.date);
  if (!startDate) {
    throw new PlannerInputError("startDate 必须是 YYYY-MM-DD");
  }

  const dayCount = clampIntOr(
    input?.dayCount ?? DEFAULT_WEEK_DAY_COUNT,
    DEFAULT_WEEK_DAY_COUNT,
    1,
    MAX_WEEK_DAY_COUNT
  );

  const { events: normalizedFixed } = normalizeFixedEvents(input?.fixedEvents);
  const normalizedTasks = normalizeTasks(input?.tasks);
  const explicitTasks = normalizedTasks.filter((task) => !task.weeklyTargetCount);
  const targetTasks = normalizedTasks.filter((task) => task.weeklyTargetCount);
  const planningDays = makePlanningDays({ startDate, dayCount, fixedEvents: normalizedFixed });
  const { derivedTasks, assignmentIssues, taskAssignments } = assignWeeklyTargetTasks({
    targetTasks,
    planningDays,
  });

  const effectiveTasks = [...explicitTasks, ...derivedTasks];
  const days = [];

  for (const day of planningDays) {
    try {
      const result = buildDaySchedule({
        ...input,
        date: day.isoDate,
        fixedEvents: input?.fixedEvents,
        tasks: effectiveTasks,
      });

      days.push({
        date: day.isoDate,
        weekday: day.weekday,
        weekdayLabel: day.weekdayLabel,
        dateLabel: day.dateLabel,
        ok: true,
        result,
        summary: {
          taskMinutes: result.stats.taskMinutes,
          fixedMinutes: result.stats.fixedMinutes,
          unscheduledCount: result.unscheduled.length,
          issueCount: result.issues.length,
          blockCount: result.blocks.length,
          fixedEventCount: result.appliedCounts.fixedEvents,
          taskCount: result.appliedCounts.tasks,
        },
      });
    } catch (error) {
      if (!(error instanceof ScheduleValidationError)) throw error;

      days.push({
        date: day.isoDate,
        weekday: day.weekday,
        weekdayLabel: day.weekdayLabel,
        dateLabel: day.dateLabel,
        ok: false,
        error: error.message,
        issues: error.issues,
        summary: {
          taskMinutes: 0,
          fixedMinutes: 0,
          unscheduledCount: 0,
          issueCount: error.issues.length,
          blockCount: 0,
          fixedEventCount: day.fixedEvents.length,
          taskCount: effectiveTasks.filter((task) =>
            taskAppliesToDate(task, { isoDate: day.isoDate, weekday: day.weekday })
          ).length,
        },
      });
    }
  }

  return {
    startDate: startDate.isoDate,
    endDate: toIsoDate(addDays(startDate.date, dayCount - 1)),
    dayCount,
    days,
    totals: summarizeWeek(days),
    assignmentIssues,
    taskAssignments,
  };
}

module.exports = {
  buildDaySchedule,
  buildWeekSchedule,
  ScheduleValidationError,
  PlannerInputError,
  parseIsoDate,
  toIsoDate,
  formatRange,
  intervalsOverlap,
  classifyScheduleIssueStatus,
  validateScheduleSnapshot,
  buildDisplayBlocks,
  summarizeBlocks,
};

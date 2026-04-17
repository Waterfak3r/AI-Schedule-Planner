/* global fetch, localStorage, navigator, document, alert, HTMLElement, window */

const $ = (id) => document.getElementById(id);

const PIXELS_PER_MINUTE = 1.25;
const WEEK_PIXELS_PER_MINUTE = 0.5;
const DAY_CALENDAR_TOP_GUTTER = 28;
const DAY_CALENDAR_BOTTOM_GUTTER = 28;
const SCHEDULE_UNDO_TOAST_MS = 7000;
const FULL_DAY_START_MIN = 0;
const FULL_DAY_END_MIN = 24 * 60;
const FULL_DAY_START = "00:00";
const FULL_DAY_END = "24:00";
const SNAP_OPTIONS = [5, 10, 15, 30];
const DEFAULT_CALENDAR_SETTINGS = {
  showBuffers: true,
  snapMinutes: 15,
};
const NEW_FIXED_DRAFT_ID = "__new_fixed__";
const NEW_TASK_DRAFT_ID = "__new_task__";
const DEFAULT_WORKSPACE_PREFS = {
  defaultStartupView: "chat",
  defaultScheduleMode: "week",
  navCollapsed: false,
};
const DEFAULT_PLANNER_PREFS = {
  planDate: "",
  wakeTime: "07:30",
  bedtime: "23:30",
  tone: "snarky",
};
const DEFAULT_SCHEDULE_VIEW_PREFS = {
  weekLayout: "grid",
  dayUtilityOpen: false,
  dayZoom: 1,
  weekZoom: 1,
  scheduleSidebarCollapsed: false,
  plannerPanelCollapsed: false,
  calendarPanelCollapsed: false,
  optionsPanelCollapsed: false,
};
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_META = {
  0: { short: "日", full: "周日" },
  1: { short: "一", full: "周一" },
  2: { short: "二", full: "周二" },
  3: { short: "三", full: "周三" },
  4: { short: "四", full: "周四" },
  5: { short: "五", full: "周五" },
  6: { short: "六", full: "周六" },
};
const SCHEDULE_SIDEBAR_SECTIONS = [
  {
    key: "plannerPanelCollapsed",
    cardId: "scheduleSectionPlanner",
    bodyId: "scheduleSectionPlannerBody",
    buttonId: "btnToggleScheduleSectionPlanner",
    collapsedText: "+",
    expandedText: "-",
    collapsedTitle: "Expand planner panel",
    expandedTitle: "Collapse planner panel",
  },
  {
    key: "calendarPanelCollapsed",
    cardId: "scheduleSectionCalendar",
    bodyId: "scheduleSectionCalendarBody",
    buttonId: "btnToggleScheduleSectionCalendar",
    collapsedText: "+",
    expandedText: "-",
    collapsedTitle: "Expand calendar panel",
    expandedTitle: "Collapse calendar panel",
  },
  {
    key: "optionsPanelCollapsed",
    cardId: "scheduleSectionOptions",
    bodyId: "scheduleSectionOptionsBody",
    buttonId: "btnToggleScheduleSectionOptions",
    collapsedText: "+",
    expandedText: "-",
    collapsedTitle: "Expand view options panel",
    expandedTitle: "Collapse view options panel",
  },
];
let scheduleHydrationPromise = null;
let scheduleUndoTimer = null;

function cloneStorageValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

const desktopWorkspaceStorage = (() => {
  try {
    if (!window.desktopApp || typeof window.desktopApp.getWorkspaceStateSync !== "function") return null;
    const snapshot = window.desktopApp.getWorkspaceStateSync();
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
    return snapshot;
  } catch {
    return null;
  }
})();

function loadDesktopStorageValue(key) {
  if (!desktopWorkspaceStorage || !Object.prototype.hasOwnProperty.call(desktopWorkspaceStorage, key)) {
    return undefined;
  }

  return cloneStorageValue(desktopWorkspaceStorage[key]);
}

function saveDesktopStorageValue(key, value) {
  if (!desktopWorkspaceStorage || !window.desktopApp || typeof window.desktopApp.setWorkspaceValueSync !== "function") {
    return;
  }

  const cloned = cloneStorageValue(value);
  desktopWorkspaceStorage[key] = cloned;
  try {
    window.desktopApp.setWorkspaceValueSync(key, cloned);
  } catch {
    // Keep browser storage behavior if the desktop bridge is unavailable.
  }
}

const storage = {
  load(key, fallback) {
    const desktopValue = loadDesktopStorageValue(key);
    if (desktopValue !== undefined) return desktopValue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      saveDesktopStorageValue(key, parsed);
      return parsed;
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore browser storage failures and keep the in-memory state.
    }
    saveDesktopStorageValue(key, value);
  },
};

const state = {
  fixedEvents: storage.load("asp.fixedEvents", []),
  tasks: storage.load("asp.tasks", []),
  completed: storage.load("asp.completed", {}),
  localDayOverrides: storage.load("asp.localDayOverrides", {}),
  chatHistory: storage.load("asp.chatHistory", []),
  calendarSettings: normalizeCalendarSettings(storage.load("asp.calendarSettings", DEFAULT_CALENDAR_SETTINGS)),
  workspacePrefs: normalizeWorkspacePrefs(storage.load("asp.workspacePrefs", DEFAULT_WORKSPACE_PREFS)),
  plannerPrefs: normalizePlannerPrefs(storage.load("asp.plannerPrefs", DEFAULT_PLANNER_PREFS)),
  scheduleViewPrefs: normalizeScheduleViewPrefs(storage.load("asp.scheduleViewPrefs", DEFAULT_SCHEDULE_VIEW_PREFS)),
  lastSchedule: null,
  lastWeekPlan: null,
  ui: {
    drag: null,
    editor: null,
    chatSending: false,
    pendingAiProposal: null,
    desktopInfo: null,
    activeView: "chat",
    scheduleMode: "week",
    settingsSection: "app",
    rulesMode: "fixed",
    selectedFixedId: null,
    selectedTaskId: null,
    aiFocus: null,
    scheduleMonthCursor: null,
    conflictResolution: null,
    taskScopeResolution: null,
    undoToast: null,
  },
};

function persistData() {
  storage.save("asp.fixedEvents", state.fixedEvents);
  storage.save("asp.tasks", state.tasks);
  storage.save("asp.completed", state.completed);
  storage.save("asp.localDayOverrides", state.localDayOverrides);
}

function persistCalendarSettings() {
  storage.save("asp.calendarSettings", state.calendarSettings);
}

function normalizeWorkspacePrefs(value) {
  const raw = value && typeof value === "object" ? value : {};
  const defaultStartupView = ["chat", "schedule", "settings"].includes(raw.defaultStartupView)
    ? raw.defaultStartupView
    : DEFAULT_WORKSPACE_PREFS.defaultStartupView;
  const defaultScheduleMode = ["day", "week"].includes(raw.defaultScheduleMode)
    ? raw.defaultScheduleMode
    : DEFAULT_WORKSPACE_PREFS.defaultScheduleMode;
  const navCollapsed = Boolean(raw.navCollapsed);
  return {
    defaultStartupView,
    defaultScheduleMode,
    navCollapsed,
  };
}

function persistWorkspacePrefs() {
  storage.save("asp.workspacePrefs", state.workspacePrefs);
}

function normalizeScheduleViewPrefs(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    weekLayout: "grid",
    dayUtilityOpen: Boolean(raw.dayUtilityOpen),
    dayZoom: clampNumber(raw.dayZoom, DEFAULT_SCHEDULE_VIEW_PREFS.dayZoom, 0.75, 2.4),
    weekZoom: clampNumber(raw.weekZoom, DEFAULT_SCHEDULE_VIEW_PREFS.weekZoom, 0.7, 2.6),
    scheduleSidebarCollapsed: Boolean(raw.scheduleSidebarCollapsed),
    plannerPanelCollapsed: Boolean(raw.plannerPanelCollapsed),
    calendarPanelCollapsed: Boolean(raw.calendarPanelCollapsed),
    optionsPanelCollapsed: Boolean(raw.optionsPanelCollapsed),
  };
}

function persistScheduleViewPrefs() {
  storage.save("asp.scheduleViewPrefs", state.scheduleViewPrefs);
}

function renderShellChrome() {
  const navCollapsed = Boolean(state.workspacePrefs.navCollapsed);
  const scheduleSidebarCollapsed = Boolean(state.scheduleViewPrefs.scheduleSidebarCollapsed);

  $("desktopShell")?.classList.toggle("sidebar-collapsed", navCollapsed);
  $("scheduleShell")?.classList.toggle("sidebar-collapsed", scheduleSidebarCollapsed);

  const navButton = $("btnSidebarCollapse");
  if (navButton) {
    navButton.textContent = navCollapsed ? ">" : "<";
    navButton.title = navCollapsed ? "Expand navigation" : "Collapse navigation";
    navButton.setAttribute("aria-label", navButton.title);
    navButton.setAttribute("aria-expanded", String(!navCollapsed));
  }

  const scheduleButton = $("btnScheduleSidebarCollapse");
  if (scheduleButton) {
    scheduleButton.textContent = scheduleSidebarCollapsed ? "Show Panels" : "Hide Panels";
    scheduleButton.title = scheduleSidebarCollapsed ? "Show planner panels" : "Hide planner panels";
    scheduleButton.setAttribute("aria-expanded", String(!scheduleSidebarCollapsed));
    scheduleButton.classList.toggle("active", scheduleSidebarCollapsed);
  }

  SCHEDULE_SIDEBAR_SECTIONS.forEach((section) => {
    const collapsed = Boolean(state.scheduleViewPrefs[section.key]);
    $(section.cardId)?.classList.toggle("collapsed", collapsed);
    $(section.bodyId)?.classList.toggle("hidden", collapsed);

    const button = $(section.buttonId);
    if (!button) return;
    button.textContent = collapsed ? section.collapsedText : section.expandedText;
    button.title = collapsed ? section.collapsedTitle : section.expandedTitle;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-expanded", String(!collapsed));
  });
}

function setNavCollapsed(nextCollapsed) {
  state.workspacePrefs.navCollapsed = Boolean(nextCollapsed);
  persistWorkspacePrefs();
  renderShellChrome();
}

function setScheduleSidebarCollapsed(nextCollapsed) {
  state.scheduleViewPrefs.scheduleSidebarCollapsed = Boolean(nextCollapsed);
  persistScheduleViewPrefs();
  renderShellChrome();
}

function setScheduleSidebarSectionCollapsed(sectionKey, nextCollapsed) {
  if (!Object.prototype.hasOwnProperty.call(state.scheduleViewPrefs, sectionKey)) return;
  state.scheduleViewPrefs[sectionKey] = Boolean(nextCollapsed);
  persistScheduleViewPrefs();
  renderShellChrome();
}

function normalizePlannerPrefs(value) {
  const raw = value && typeof value === "object" ? value : {};
  const planDate = parseIsoDate(raw.planDate) ? raw.planDate : DEFAULT_PLANNER_PREFS.planDate;
  const wakeTime =
    parseTimeToMinutes(raw.wakeTime) != null ? raw.wakeTime : DEFAULT_PLANNER_PREFS.wakeTime;
  const bedtime =
    parseTimeToMinutes(raw.bedtime) != null ? raw.bedtime : DEFAULT_PLANNER_PREFS.bedtime;
  const tone = ["gentle", "snarky", "roast"].includes(raw.tone) ? raw.tone : DEFAULT_PLANNER_PREFS.tone;
  return {
    planDate,
    wakeTime,
    bedtime,
    tone,
  };
}

function applyPlannerPrefsToForm() {
  const prefs = state.plannerPrefs || DEFAULT_PLANNER_PREFS;
  $("planDate").value = prefs.planDate || todayInputValue();
  $("wakeTime").value = prefs.wakeTime || DEFAULT_PLANNER_PREFS.wakeTime;
  $("bedtime").value = prefs.bedtime || DEFAULT_PLANNER_PREFS.bedtime;
  $("tone").value = prefs.tone || DEFAULT_PLANNER_PREFS.tone;
}

function persistPlannerPrefsFromForm() {
  state.plannerPrefs = normalizePlannerPrefs({
    planDate: $("planDate")?.value || todayInputValue(),
    wakeTime: $("wakeTime")?.value || DEFAULT_PLANNER_PREFS.wakeTime,
    bedtime: $("bedtime")?.value || DEFAULT_PLANNER_PREFS.bedtime,
    tone: $("tone")?.value || DEFAULT_PLANNER_PREFS.tone,
  });
  storage.save("asp.plannerPrefs", state.plannerPrefs);
}

function persistPlanState() {
  storage.save("asp.lastSchedule", state.lastSchedule);
  storage.save("asp.lastWeekPlan", state.lastWeekPlan);
}

function captureScheduleUndoSnapshot() {
  return cloneData({
    fixedEvents: state.fixedEvents,
    tasks: state.tasks,
    completed: state.completed,
    localDayOverrides: state.localDayOverrides,
    lastSchedule: state.lastSchedule,
    lastWeekPlan: state.lastWeekPlan,
    planDate: $("planDate")?.value || todayInputValue(),
    selectedFixedId: state.ui.selectedFixedId,
    selectedTaskId: state.ui.selectedTaskId,
    aiFocus: state.ui.aiFocus,
    scheduleMode: state.ui.scheduleMode,
  });
}

function hideScheduleUndoToast(options = {}) {
  const { clearState = true } = options;
  if (scheduleUndoTimer) {
    window.clearTimeout(scheduleUndoTimer);
    scheduleUndoTimer = null;
  }

  const toast = $("scheduleUndoToast");
  const progressBar = $("scheduleUndoProgressBar");
  toast?.classList.add("hidden");
  if (progressBar) {
    progressBar.classList.remove("running");
    progressBar.style.removeProperty("--undo-toast-duration");
  }

  if (clearState) {
    state.ui.undoToast = null;
  }
}

function restoreScheduleUndoSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;

  hideContextMenu();
  closeEventEditor();
  closeCalendarSettings();
  closeAiApplyModal();
  closeConflictResolutionModal("dismiss");
  closeTaskScopeModal("dismiss");

  state.fixedEvents = cloneData(snapshot.fixedEvents || []);
  state.tasks = cloneData(snapshot.tasks || []);
  state.completed = cloneData(snapshot.completed || {});
  state.localDayOverrides = cloneData(snapshot.localDayOverrides || {});
  state.lastSchedule = snapshot.lastSchedule ? prepareSchedule(snapshot.lastSchedule) : null;
  state.lastWeekPlan = snapshot.lastWeekPlan ? prepareWeekPlan(snapshot.lastWeekPlan) : null;
  state.ui.selectedFixedId = snapshot.selectedFixedId || null;
  state.ui.selectedTaskId = snapshot.selectedTaskId || null;
  state.ui.aiFocus = snapshot.aiFocus ? cloneData(snapshot.aiFocus) : null;
  state.ui.scheduleMode = snapshot.scheduleMode === "day" ? "day" : "week";
  scheduleHydrationPromise = null;

  persistData();
  persistPlanState();
  updatePlanDateValue(snapshot.planDate || todayInputValue());
  renderLists();
  renderScheduleMode();
  renderAiFocusBanner();
  updateAiProposalUi();

  if (state.lastWeekPlan) renderWeekPlan(state.lastWeekPlan);
  else renderWeekPlan(null);

  if (state.lastSchedule) renderSchedule(state.lastSchedule);
  else {
    clearScheduleIssues();
    renderSchedule(null);
  }

  updateProgressPill();
  return true;
}

function showScheduleUndoToast(config = {}) {
  const snapshot = config.snapshot;
  if (!snapshot) return;

  hideScheduleUndoToast({ clearState: false });

  const changedDates = [...new Set((config.changedDates || []).filter(Boolean))];
  const changedCount = Math.max(1, changedDates.length || Number(config.changedCount) || 1);
  const label = String(config.label || "").trim();
  const toast = $("scheduleUndoToast");
  const summary = $("scheduleUndoSummary");
  const labelEl = $("scheduleUndoLabel");
  const progressBar = $("scheduleUndoProgressBar");
  if (!toast || !summary || !labelEl || !progressBar) return;

  state.ui.undoToast = {
    snapshot,
    changedDates,
    changedCount,
    label,
  };

  summary.textContent = `本操作更改了 ${changedCount} 个日程`;
  labelEl.textContent = label;
  labelEl.classList.toggle("hidden", !label);
  toast.classList.remove("hidden");

  progressBar.classList.remove("running");
  progressBar.style.setProperty("--undo-toast-duration", `${SCHEDULE_UNDO_TOAST_MS}ms`);
  void progressBar.offsetWidth;
  progressBar.classList.add("running");

  scheduleUndoTimer = window.setTimeout(() => {
    hideScheduleUndoToast();
  }, SCHEDULE_UNDO_TOAST_MS);
}

function registerScheduleUndo(snapshot, options = {}) {
  if (!snapshot) return;
  showScheduleUndoToast({
    snapshot,
    changedDates: options.changedDates || [],
    changedCount: options.changedCount || 0,
    label: options.label || "",
  });
}

function undoLastScheduleOperation() {
  const snapshot = state.ui.undoToast?.snapshot;
  if (!snapshot) return;
  hideScheduleUndoToast();
  restoreScheduleUndoSnapshot(snapshot);
}

function normalizeChatHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((item) => ({
      id: String(item?.id || uid("chatmsg")),
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim(),
      actions: normalizeAiActions(item?.actions || []),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-40);
}

function persistChatHistory() {
  storage.save("asp.chatHistory", state.chatHistory);
}

function ensureChatSeed() {
  state.chatHistory = normalizeChatHistory(state.chatHistory);
  if (state.chatHistory.length > 0) return;

  state.chatHistory = [
    {
      id: uid("chatmsg"),
      role: "assistant",
      content:
        "我是你的日程助理。你可以让我帮你拆解任务、调整日程、处理冲突，或根据今天完成情况给出下一步建议。",
    },
  ];
  persistChatHistory();
}

function pruneLocalDayOverrides(maxEntries = 60) {
  const entries = Object.entries(state.localDayOverrides || {});
  if (entries.length <= maxEntries) return;

  entries.sort((left, right) => {
    const a = left[1]?.savedAt || "";
    const b = right[1]?.savedAt || "";
    return a.localeCompare(b);
  });

  const toDrop = entries.length - maxEntries;
  for (let index = 0; index < toDrop; index += 1) {
    delete state.localDayOverrides[entries[index][0]];
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`;
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function todayInputValue() {
  const date = new Date();
  return toIsoDate(date);
}

function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOfWeekIso(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) return todayInputValue();

  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toIsoDate(date);
}

function addDaysIso(isoDate, days) {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayInputValue());
  date.setDate(date.getDate() + Number(days || 0));
  return toIsoDate(date);
}

function addMonthsIso(isoDate, months) {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayInputValue());
  date.setDate(1);
  date.setMonth(date.getMonth() + Number(months || 0));
  return toIsoDate(date);
}

function formatMonthYearLabel(isoDate) {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayInputValue());
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDayPeriodLabel(isoDate) {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayInputValue());
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeekPeriodLabel(isoDate) {
  const startIso = mondayOfWeekIso(isoDate);
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(addDaysIso(startIso, 6));
  if (!start || !end) return formatMonthYearLabel(isoDate);

  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  return `${startLabel} - ${endLabel}, ${end.getFullYear()}`;
}

function formatScheduleDateLabel(isoDate) {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayInputValue());
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });
}

function normalizeWeekdays(daysOfWeek) {
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return null;

  const unique = [];
  const seen = new Set();

  for (const raw of daysOfWeek) {
    const day = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(day) || day < 0 || day > 6 || seen.has(day)) continue;
    seen.add(day);
    unique.push(day);
  }

  if (unique.length === 0) return null;
  return unique.sort((left, right) => WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right));
}

function weekdaysEqual(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function normalizeAssignedDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return null;

  const unique = [];
  const seen = new Set();

  for (const raw of dates) {
    const parsed = parseIsoDate(raw);
    if (!parsed) continue;
    const isoDate = toIsoDate(parsed);
    if (seen.has(isoDate)) continue;
    seen.add(isoDate);
    unique.push(isoDate);
  }

  return unique.length > 0 ? unique.sort() : null;
}

function weekdaySummary(daysOfWeek) {
  const normalized = normalizeWeekdays(daysOfWeek);
  if (!normalized) return "每天";
  if (weekdaysEqual(normalized, [1, 2, 3, 4, 5])) return "工作日";
  if (weekdaysEqual(normalized, [6, 0])) return "周末";
  return normalized.map((day) => WEEKDAY_META[day].full).join(" / ");
}

function assignedDateSummary(assignedDates) {
  const normalized = normalizeAssignedDates(assignedDates);
  if (!normalized) return "";
  if (normalized.length === 1) return normalized[0];
  if (normalized.length <= 3) return normalized.join(" / ");
  return `${normalized[0]} ... ${normalized[normalized.length - 1]} / 共 ${normalized.length} 次`;
}

function fixedCadenceSummary(event) {
  const assignedDates = normalizeAssignedDates(event?.assignedDates);
  if (assignedDates) return `指定日期: ${assignedDateSummary(assignedDates)}`;
  return weekdaySummary(event?.daysOfWeek);
}

function cadenceSummary(task) {
  if (task.weeklyTargetCount > 0) {
    const candidateText = task.daysOfWeek ? `候选：${weekdaySummary(task.daysOfWeek)}` : "候选：任意一天";
    return `每周 ${task.weeklyTargetCount} 次 / ${candidateText}`;
  }
  return weekdaySummary(task.daysOfWeek);
}

function getSelectedWeekdays(attributeName) {
  const values = Array.from(document.querySelectorAll(`input[${attributeName}]`))
    .filter((input) => input.checked)
    .map((input) => Number.parseInt(input.value, 10));
  return normalizeWeekdays(values);
}

function clearSelectedWeekdays(attributeName) {
  document.querySelectorAll(`input[${attributeName}]`).forEach((input) => {
    input.checked = false;
  });
}

function setWeekdayInputsDisabled(attributeName, disabled) {
  document.querySelectorAll(`input[${attributeName}]`).forEach((input) => {
    input.disabled = Boolean(disabled);
  });
}

function parseTimeToMinutes(value) {
  if (value == null || String(value).trim() === "") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!match) return null;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  if (hours === 24 && minutes !== 0) return null;
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const normalized = Math.max(0, Math.min(FULL_DAY_END_MIN, Math.round(totalMinutes)));
  if (normalized === FULL_DAY_END_MIN) return FULL_DAY_END;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimeForInput(totalMinutes) {
  const normalized = Math.max(FULL_DAY_START_MIN, Math.min(FULL_DAY_END_MIN - 1, Math.round(totalMinutes)));
  return minutesToTime(normalized);
}

function getCalendarRange() {
  return {
    startMin: FULL_DAY_START_MIN,
    endMin: FULL_DAY_END_MIN,
    start: FULL_DAY_START,
    end: FULL_DAY_END,
  };
}

function roundToStep(value, step, mode = "nearest") {
  const safeStep = Math.max(1, Number(step) || 1);
  const raw = Number(value) || 0;

  if (mode === "down") return Math.floor(raw / safeStep) * safeStep;
  if (mode === "up") return Math.ceil(raw / safeStep) * safeStep;
  return Math.round(raw / safeStep) * safeStep;
}

function normalizeCalendarSettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  const snapMinutes = SNAP_OPTIONS.includes(Number(raw.snapMinutes)) ? Number(raw.snapMinutes) : DEFAULT_CALENDAR_SETTINGS.snapMinutes;
  return {
    showBuffers: raw.showBuffers !== false,
    snapMinutes,
  };
}

function getSnapMinutes() {
  return state.calendarSettings.snapMinutes || DEFAULT_CALENDAR_SETTINGS.snapMinutes;
}

function sortBlocks(blocks) {
  return blocks.sort((left, right) => {
    const startDiff = left.startMin - right.startMin;
    if (startDiff !== 0) return startDiff;
    const endDiff = left.endMin - right.endMin;
    if (endDiff !== 0) return endDiff;
    return String(left.title).localeCompare(String(right.title), "zh-CN");
  });
}

function buildIssue(level, code, message) {
  return { level, code, message };
}

function overlaps(left, right) {
  return left.startMin < right.endMin && right.startMin < left.endMin;
}

function summarizePlacementValidation(issues) {
  const normalized = Array.isArray(issues) ? issues.filter((issue) => issue?.message) : [];
  if (normalized.length === 0) {
    return { level: "ok", message: "", issues: [] };
  }

  const level = normalized.some((issue) => issue.level === "error") ? "error" : "warn";
  return {
    level,
    message: normalized[0].message,
    issues: normalized,
  };
}

function computePlacementValidation(schedule, candidate, ignoredRuntimeId = null) {
  if (!schedule || !candidate) {
    return { level: "error", message: "未找到对应日程", issues: [] };
  }

  if (candidate.endMin <= candidate.startMin) {
    return {
      level: "error",
      message: "结束时间必须晚于开始时间",
      issues: [{ level: "error", message: "结束时间必须晚于开始时间" }],
    };
  }

  const issues = [];
  if (candidate.startMin < schedule.dayStartMin || candidate.endMin > schedule.dayEndMin) {
    issues.push({
      level: "warn",
      message: `超出当日日程范围 ${minutesToTime(schedule.dayStartMin)}-${minutesToTime(schedule.dayEndMin)}`,
    });
  }

  const others = (schedule.blocks || []).filter((block) => {
    if (block.runtimeId === ignoredRuntimeId) return false;
    if (candidate.type === "fixed" && block.type === "buffer" && candidate.id && block.sourceId === candidate.id) {
      return false;
    }
    return true;
  });
  for (const block of others) {
    if (!overlaps(candidate, block)) continue;

    const involvesBuffer = block.type === "buffer" || candidate.type === "buffer";
    issues.push({
      level: involvesBuffer ? "warn" : "error",
      message: involvesBuffer
        ? `与 ${getBlockDisplayTitle(block)} 的缓冲区重叠`
        : `与 ${getBlockDisplayTitle(block)} 时间重叠`,
    });
  }

  return summarizePlacementValidation(issues);
}

function getTaskRuleById(id) {
  return state.tasks.find((item) => item.id === id) || null;
}

function getFixedRuleById(id) {
  return state.fixedEvents.find((item) => item.id === id) || null;
}

function findBlock(runtimeId) {
  return state.lastSchedule?.blocks?.find((block) => block.runtimeId === runtimeId) || null;
}

function findTaskOccurrencesInCurrentWeek(taskId) {
  if (!taskId || !state.lastWeekPlan?.days?.length) return [];

  const matches = [];
  for (const day of state.lastWeekPlan.days) {
    if (!day?.ok || !day.result?.blocks?.length) continue;
    for (const block of day.result.blocks) {
      if (block.type !== "task" || block.id !== taskId) continue;
      matches.push({ date: day.date, dateLabel: day.dateLabel || day.date, dayEntry: day, block });
    }
  }

  return matches;
}

function countTaskOccurrencesInCurrentWeek(taskId) {
  return findTaskOccurrencesInCurrentWeek(taskId).length;
}

function findTaskOccurrencesInCurrentWeekFromDate(taskId, focusDate) {
  const safeDate = parseIsoDate(focusDate) ? focusDate : todayInputValue();
  return findTaskOccurrencesInCurrentWeek(taskId).filter((occurrence) => occurrence.date >= safeDate);
}

function countTaskOccurrencesInCurrentWeekFromDate(taskId, focusDate) {
  return findTaskOccurrencesInCurrentWeekFromDate(taskId, focusDate).length;
}

function isRepeatableTaskBlock(block) {
  return Boolean(block?.type === "task" && block?.id && getTaskRuleById(block.id));
}

function findFixedOccurrencesInCurrentWeek(fixedId) {
  if (!fixedId || !state.lastWeekPlan?.days?.length) return [];

  const matches = [];
  for (const day of state.lastWeekPlan.days) {
    if (!day?.ok || !day.result?.blocks?.length) continue;
    for (const block of day.result.blocks) {
      if (block.type !== "fixed" || block.id !== fixedId) continue;
      matches.push({ date: day.date, dateLabel: day.dateLabel || day.date, dayEntry: day, block });
    }
  }

  return matches;
}

function countFixedOccurrencesInCurrentWeek(fixedId) {
  return findFixedOccurrencesInCurrentWeek(fixedId).length;
}

function isRepeatableFixedRule(rule) {
  if (!rule) return false;
  const assignedDates = normalizeAssignedDates(rule.assignedDates);
  if (assignedDates) return assignedDates.length > 1;
  return true;
}

function isRepeatableFixedBlock(block) {
  return Boolean(block?.type === "fixed" && block?.id && isRepeatableFixedRule(getFixedRuleById(block.id)));
}

function updateBlockTimes(block, startMin, endMin) {
  block.startMin = startMin;
  block.endMin = endMin;
  block.start = minutesToTime(startMin);
  block.end = minutesToTime(endMin);
  block.durationMin = endMin - startMin;
}

function buildDerivedBufferBlocks(blocks, dayStartMin, dayEndMin) {
  const buffers = [];
  for (const block of blocks) {
    if (block.type !== "fixed") continue;
    const bufferMin = clampInt(block.bufferMin ?? 0, 0, 0, 180);
    if (bufferMin <= 0) continue;

    const beforeStartMin = Math.max(dayStartMin, block.startMin - bufferMin);
    if (beforeStartMin < block.startMin) {
      buffers.push(
        prepareBlock({
          type: "buffer",
          title: `${block.title} 缓冲`,
          sourceTitle: block.title,
          sourceId: block.id,
          bufferMin,
          startMin: beforeStartMin,
          endMin: block.startMin,
          editable: false,
        })
      );
    }

    const afterEndMin = Math.min(dayEndMin, block.endMin + bufferMin);
    if (block.endMin < afterEndMin) {
      buffers.push(
        prepareBlock({
          type: "buffer",
          title: `${block.title} 缓冲`,
          sourceTitle: block.title,
          sourceId: block.id,
          bufferMin,
          startMin: block.endMin,
          endMin: afterEndMin,
          editable: false,
        })
      );
    }
  }

  return buffers;
}

function categoryLabel(category) {
  switch (category) {
    case "study":
      return "学习";
    case "code":
      return "编程";
    case "workout":
      return "运动";
    default:
      return "其他";
  }
}

function energyLabel(energy) {
  switch (energy) {
    case "high":
      return "高能耗";
    case "low":
      return "低能耗";
    default:
      return "中等";
  }
}

function toneLabel(tone) {
  switch (tone) {
    case "gentle":
      return "温柔";
    case "roast":
      return "毒舌";
    default:
      return "幽默";
  }
}

function fmtFixed(event) {
  const bufferMin = clampInt(event?.bufferMin ?? 0, 0, 0, 180);
  const bufferText = bufferMin > 0 ? ` / 缓冲 ${bufferMin} 分钟` : "";
  return `${event.start}-${event.end} 路 ${fixedCadenceSummary(event)}${bufferText}`;
}

function fmtTask(task) {
  return `${task.durationMin} 分钟 / ${cadenceSummary(task)} / ${categoryLabel(task.category)} / 优先级 ${task.priority}`;
}

function getBlockDisplayTitle(block) {
  if (block.type === "buffer") {
    return block.sourceTitle ? `${block.sourceTitle}（缓冲）` : block.title;
  }
  return block.title;
}

function resetReminderCard() {
  $("reminder").textContent = "（先生成当日日程，再根据完成情况生成提醒）";
  $("downloadLink").classList.add("hidden");
  $("shareCanvas").style.display = "none";
}

function clearScheduleIssues() {
  const container = $("scheduleIssues");
  container.innerHTML = "";
  container.classList.add("hidden");
}

function buildEmptyDaySchedule(date = $("planDate")?.value || todayInputValue()) {
  const safeDate = parseIsoDate(date) ? date : todayInputValue();
  return prepareSchedule({
    date: safeDate,
    dateLabel: formatScheduleDateLabel(safeDate),
    dayStart: FULL_DAY_START,
    dayEnd: FULL_DAY_END,
    blocks: [],
    unscheduled: [],
    issues: [],
    emptyScaffold: true,
  });
}

function buildEmptyWeekPlan(date = $("planDate")?.value || todayInputValue()) {
  const focusDate = parseIsoDate(date) ? date : todayInputValue();
  const startDate = mondayOfWeekIso(focusDate);
  const days = [];

  for (let index = 0; index < 7; index += 1) {
    const isoDate = addDaysIso(startDate, index);
    const result = buildEmptyDaySchedule(isoDate);
    days.push({
      date: isoDate,
      dateLabel: formatScheduleDateLabel(isoDate),
      ok: true,
      result,
      summary: summarizeScheduleResult(result),
    });
  }

  const plan = {
    scaffold: true,
    startDate,
    endDate: addDaysIso(startDate, 6),
    dayCount: 7,
    days,
    totals: {
      okDays: 7,
      errorDays: 0,
      taskMinutes: 0,
      fixedMinutes: 0,
      unscheduledCount: 0,
      warningCount: 0,
    },
  };

  return plan;
}

function getRenderableDaySchedule(schedule = state.lastSchedule) {
  return schedule || buildEmptyDaySchedule();
}

function getRenderableWeekPlan(plan = state.lastWeekPlan) {
  return plan || buildEmptyWeekPlan();
}

function ensureEditableDaySchedule() {
  if (state.lastSchedule) return state.lastSchedule;
  state.lastSchedule = buildEmptyDaySchedule();
  return state.lastSchedule;
}

function ensureEditableWeekPlan() {
  if (state.lastWeekPlan) return state.lastWeekPlan;
  state.lastWeekPlan = buildEmptyWeekPlan();
  return state.lastWeekPlan;
}

function renderEmptySchedule(message) {
  $("schedule").innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderWeekPlanPlaceholder(message) {
  $("weekRange").textContent = "—";
  $("weekPlan").className = "empty-state";
  $("weekPlan").textContent = message;
}

function clearScheduleView() {
  state.lastSchedule = null;
  state.ui.aiFocus = null;
  state.completed = {};
  persistData();
  persistPlanState();
  clearScheduleIssues();
  renderAiFocusBanner();
  updateProgressPill();
  resetReminderCard();
  renderSchedule(null);
}

function clearWeekPlan() {
  state.lastWeekPlan = null;
  state.ui.aiFocus = null;
  persistPlanState();
  renderWeekPlan(null);
  renderAiFocusBanner();
}

function invalidateDerivedState() {
  clearScheduleView();
  clearWeekPlan();
}

function renderScheduleIssues(issues) {
  const container = $("scheduleIssues");
  container.innerHTML = "";

  if (!Array.isArray(issues) || issues.length === 0) {
    container.classList.add("hidden");
    return;
  }

  for (const issue of issues) {
    const level = issue?.level === "error" ? "error" : "warning";
    const levelLabel = level === "error" ? "需要修复" : "提示";
    const el = document.createElement("div");
    el.className = `issue ${level}`;
    el.innerHTML = `
      <div class="issue-head">
        <span class="issue-level">${escapeHtml(levelLabel)}</span>
        <span class="issue-code">${escapeHtml(issue?.code || level.toUpperCase())}</span>
      </div>
      <div class="issue-text">${escapeHtml(issue?.message || "")}</div>
    `;
    container.appendChild(el);
  }

  container.classList.remove("hidden");
}

function renderLists() {
  ensureRuleSelection();

  const fixedList = $("fixedList");
  if (!fixedList) return;
  fixedList.innerHTML = "";

  for (const event of state.fixedEvents) {
    const el = document.createElement("div");
    el.className = `rule-list-row ${event.id === state.ui.selectedFixedId ? "selected" : ""}`.trim();
    el.innerHTML = `
      <button class="rule-list-main" type="button" data-select-fixed="${escapeHtml(event.id)}">
        <div class="meta">
          <div class="name">${escapeHtml(event.title)}</div>
          <div class="sub">${escapeHtml(fmtFixed(event))}</div>
        </div>
      </button>
      <div class="rule-list-actions">
        <button class="btn tiny" type="button" data-select-fixed="${escapeHtml(event.id)}">Edit</button>
        <button class="btn tiny" type="button" data-del-fixed="${escapeHtml(event.id)}">Delete</button>
      </div>
    `;
    fixedList.appendChild(el);
  }

  if (state.fixedEvents.length === 0) {
    fixedList.innerHTML = '<div class="empty-state compact-empty">No timed items yet.</div>';
  }

  const taskList = $("taskList");
  if (!taskList) return;
  taskList.innerHTML = "";

  for (const task of state.tasks) {
    const splitText = task.splitAllowed ? " / 可拆分" : "";
    const el = document.createElement("div");
    el.className = `rule-list-row ${task.id === state.ui.selectedTaskId ? "selected" : ""}`.trim();
    el.innerHTML = `
      <button class="rule-list-main" type="button" data-select-task="${escapeHtml(task.id)}">
        <div class="meta">
          <div class="name">${escapeHtml(task.title)}</div>
          <div class="sub">${escapeHtml(fmtTask(task))} 路 ${escapeHtml(energyLabel(task.energy))}${escapeHtml(splitText)}</div>
        </div>
      </button>
      <div class="rule-list-actions">
        <button class="btn tiny" type="button" data-select-task="${escapeHtml(task.id)}">Edit</button>
        <button class="btn tiny" type="button" data-del-task="${escapeHtml(task.id)}">Delete</button>
      </div>
    `;
    taskList.appendChild(el);
  }

  if (state.tasks.length === 0) {
    taskList.innerHTML = '<div class="empty-state compact-empty">No task rules yet.</div>';
  }

  renderRuleEditors();
}

function syncCalendarToolbar() {
  $("toggleBuffers").checked = state.calendarSettings.showBuffers;
  $("calendarSnapPreview").textContent = `Snap ${state.calendarSettings.snapMinutes} min`;
  $("scheduleZoomPreview").textContent = `Zoom ${Math.round(state.scheduleViewPrefs.dayZoom * 100)}%`;
  $("weekZoomPreview").textContent = `Zoom ${Math.round(state.scheduleViewPrefs.weekZoom * 100)}%`;
}

function getSelectedPlanDate() {
  return $("planDate")?.value || todayInputValue();
}

function syncScheduleMonthCursorToDate(isoDate) {
  const date = parseIsoDate(isoDate) || parseIsoDate(todayInputValue());
  date.setDate(1);
  state.ui.scheduleMonthCursor = toIsoDate(date);
}

function ensureScheduleMonthCursor() {
  if (!state.ui.scheduleMonthCursor) {
    syncScheduleMonthCursorToDate(getSelectedPlanDate());
  }
  return state.ui.scheduleMonthCursor;
}

function renderMiniMonthCalendar() {
  const grid = $("miniMonthGrid");
  const label = $("miniMonthLabel");
  if (!grid || !label) return;

  const monthCursor = ensureScheduleMonthCursor();
  const monthStart = parseIsoDate(monthCursor) || parseIsoDate(todayInputValue());
  monthStart.setDate(1);
  label.textContent = formatMonthYearLabel(toIsoDate(monthStart));

  const selectedDate = getSelectedPlanDate();
  const today = todayInputValue();
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - gridStart.getDay());

  grid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const iso = toIsoDate(cellDate);
    const button = document.createElement("button");
    const classes = ["mini-month-day"];
    if (cellDate.getMonth() !== monthStart.getMonth()) classes.push("muted");
    if (iso === today) classes.push("today");
    if (iso === selectedDate) classes.push("selected");
    button.className = classes.join(" ");
    button.type = "button";
    button.textContent = String(cellDate.getDate());
    button.dataset.miniDate = iso;
    grid.appendChild(button);
  }
}

function renderScheduleToolbarChrome() {
  const planDate = getSelectedPlanDate();
  $("schedulePeriodLabel").textContent =
    state.ui.scheduleMode === "week" ? formatWeekPeriodLabel(planDate) : formatDayPeriodLabel(planDate);
  $("weekZoomPreview")?.classList.toggle("hidden", state.ui.scheduleMode !== "week");
  $("scheduleZoomPreview")?.classList.toggle("hidden", state.ui.scheduleMode !== "day");
  $("btnToggleDayUtilities")?.classList.toggle("hidden", state.ui.scheduleMode !== "day");
  renderShellChrome();
}

function renderScheduleChrome() {
  renderScheduleToolbarChrome();
  renderMiniMonthCalendar();
  syncCalendarToolbar();
}

function updatePlanDateValue(nextDate, options = {}) {
  const { dispatchChange = false, syncMonthCursor = true } = options;
  const safeDate = parseIsoDate(nextDate) ? nextDate : todayInputValue();
  $("planDate").value = safeDate;
  if (syncMonthCursor) {
    syncScheduleMonthCursorToDate(safeDate);
  }
  persistPlannerPrefsFromForm();
  renderScheduleChrome();
  if (dispatchChange) {
    $("planDate").dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function shiftSelectedScheduleDate(direction) {
  const step = state.ui.scheduleMode === "week" ? 7 : 1;
  updatePlanDateValue(addDaysIso(getSelectedPlanDate(), direction * step), { dispatchChange: true });
}

function shiftMiniMonth(direction) {
  const nextMonth = addMonthsIso(ensureScheduleMonthCursor(), direction);
  syncScheduleMonthCursorToDate(nextMonth);
  renderMiniMonthCalendar();
}

function getDayPixelsPerMinute() {
  return PIXELS_PER_MINUTE * state.scheduleViewPrefs.dayZoom;
}

function getWeekPixelsPerMinute() {
  return WEEK_PIXELS_PER_MINUTE * state.scheduleViewPrefs.weekZoom;
}

function adjustScheduleZoom(mode, direction) {
  const key = mode === "week" ? "weekZoom" : "dayZoom";
  const current = key === "weekZoom" ? state.scheduleViewPrefs.weekZoom : state.scheduleViewPrefs.dayZoom;
  const step = current >= 1.6 ? 0.2 : 0.1;
  const next = clampNumber(current + direction * step, current, key === "weekZoom" ? 0.7 : 0.75, key === "weekZoom" ? 2.6 : 2.4);
  if (Math.abs(next - current) < 0.001) return false;

  state.scheduleViewPrefs[key] = Number(next.toFixed(2));
  persistScheduleViewPrefs();
  syncCalendarToolbar();

  if (mode === "week") {
    if (state.lastWeekPlan) renderWeekPlan(state.lastWeekPlan);
  } else if (state.lastSchedule) {
    renderSchedule(state.lastSchedule);
  }

  return true;
}

function getWorkspaceScrollContainer() {
  return document.querySelector(".workspace");
}

function computeCompletionStats(schedule) {
  const blocks = schedule?.blocks || [];
  let total = 0;
  let done = 0;
  const minutesByCategory = { study: 0, code: 0, workout: 0, other: 0 };

  for (const block of blocks) {
    if (block.type !== "task") continue;
    total += block.durationMin;

    const bucket = minutesByCategory[block.category] != null ? block.category : "other";
    if (state.completed[block.runtimeId]) {
      done += block.durationMin;
      minutesByCategory[bucket] += block.durationMin;
    }
  }

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return {
    totalTaskMin: total,
    doneTaskMin: done,
    percent,
    minutesByCategory,
    allGreen: total > 0 && done === total,
  };
}

function updateProgressPill() {
  const stats = computeCompletionStats(state.lastSchedule);
  if (stats.totalTaskMin === 0) {
    $("progress").textContent = "完成 0%";
    return;
  }

  $("progress").textContent = `完成 ${stats.percent}% / ${stats.doneTaskMin}/${stats.totalTaskMin} 分钟`;
}

function prepareBlock(block) {
  const taskRule = block.type === "task" && block.id ? getTaskRuleById(block.id) : null;
  const fixedRule = block.type === "fixed" && block.id ? getFixedRuleById(block.id) : null;
  const startMin = Number.isFinite(block.startMin) ? block.startMin : parseTimeToMinutes(block.start);
  const endMin = Number.isFinite(block.endMin) ? block.endMin : parseTimeToMinutes(block.end);
  const safeStart = startMin ?? 0;
  const safeEnd = endMin ?? safeStart;

  return {
    ...block,
    runtimeId: String(block.runtimeId || uid("blk")),
    startMin: safeStart,
    endMin: safeEnd,
    start: minutesToTime(safeStart),
    end: minutesToTime(safeEnd),
    durationMin: Math.max(0, safeEnd - safeStart),
    category: block.category || taskRule?.category || "other",
    energy: block.energy || taskRule?.energy || "medium",
    priority: clampInt(block.priority ?? taskRule?.priority ?? 3, 3, 1, 5),
    splitAllowed: Boolean(block.splitAllowed ?? taskRule?.splitAllowed),
    bufferMin: clampInt(block.bufferMin ?? fixedRule?.bufferMin ?? 0, 0, 0, 180),
    sourceTitle: block.sourceTitle || fixedRule?.title || "",
    sourceId: String(block.sourceId || ""),
    manual: Boolean(block.manual),
    editable: block.type === "task" || block.type === "fixed",
  };
}

function prepareSchedule(schedule) {
  const cloned = cloneData(schedule || {});
  const dayStartMin = parseTimeToMinutes(cloned.dayStart) ?? FULL_DAY_START_MIN;
  const dayEndMin = parseTimeToMinutes(cloned.dayEnd) ?? FULL_DAY_END_MIN;
  const preparedBlocks = Array.isArray(cloned.blocks) ? cloned.blocks.map(prepareBlock) : [];
  const nonBufferBlocks = preparedBlocks.filter((block) => block.type !== "buffer");
  const blocks = [...nonBufferBlocks, ...buildDerivedBufferBlocks(nonBufferBlocks, dayStartMin, dayEndMin)];

  sortBlocks(blocks);

  return {
    ...cloned,
    dayStartMin,
    dayEndMin,
    blocks,
    issues: Array.isArray(cloned.issues) ? cloned.issues : [],
    unscheduled: Array.isArray(cloned.unscheduled) ? cloned.unscheduled : [],
    emptyScaffold: Boolean(cloned.emptyScaffold) && nonBufferBlocks.length === 0,
  };
}

function summarizeScheduleResult(schedule) {
  const blocks = Array.isArray(schedule?.blocks) ? schedule.blocks : [];
  let taskMinutes = 0;
  let fixedMinutes = 0;
  let taskCount = 0;
  let fixedEventCount = 0;

  for (const block of blocks) {
    if (block.type === "task") {
      taskMinutes += block.durationMin;
      taskCount += 1;
    } else if (block.type === "fixed") {
      fixedMinutes += block.durationMin;
      fixedEventCount += 1;
    }
  }

  return {
    taskMinutes,
    fixedMinutes,
    unscheduledCount: Array.isArray(schedule?.unscheduled) ? schedule.unscheduled.length : 0,
    issueCount: [...(schedule?.issues || []), ...computeLocalScheduleIssues(schedule)].length,
    blockCount: blocks.length,
    fixedEventCount,
    taskCount,
  };
}

function recalculateWeekPlanTotals(plan) {
  if (!plan?.days?.length) return;

  let okDays = 0;
  let errorDays = 0;
  let taskMinutes = 0;
  let fixedMinutes = 0;
  let unscheduledCount = 0;
  let warningCount = 0;

  for (const day of plan.days) {
    if (day.ok) {
      okDays += 1;
      taskMinutes += day.summary?.taskMinutes || 0;
      fixedMinutes += day.summary?.fixedMinutes || 0;
      unscheduledCount += day.summary?.unscheduledCount || 0;
      warningCount += day.summary?.issueCount || 0;
    } else {
      errorDays += 1;
      warningCount += day.summary?.issueCount || 0;
    }
  }

  plan.totals = {
    okDays,
    errorDays,
    taskMinutes,
    fixedMinutes,
    unscheduledCount,
    warningCount,
  };
  plan.scaffold =
    Boolean(plan.scaffold) &&
    plan.days.every((day) => !day?.result?.blocks?.some((block) => block.type !== "buffer"));
}

function prepareWeekPlan(plan) {
  const cloned = cloneData(plan || {});
  cloned.days = Array.isArray(cloned.days)
    ? cloned.days.map((day) => {
        if (!day.ok || !day.result) return day;
        const withOverride = applyLocalDayOverride(day.date, day.result);
        const preparedResult = prepareSchedule(withOverride);
        return {
          ...day,
          result: preparedResult,
          summary: summarizeScheduleResult(preparedResult),
        };
      })
    : [];

  recalculateWeekPlanTotals(cloned);
  return cloned;
}

function restorePersistedWorkspace() {
  const rawWeekPlan = storage.load("asp.lastWeekPlan", null);
  const rawSchedule = storage.load("asp.lastSchedule", null);

  state.lastWeekPlan = rawWeekPlan ? prepareWeekPlan(rawWeekPlan) : null;
  state.lastSchedule = rawSchedule ? prepareSchedule(rawSchedule) : null;

  if (state.lastSchedule?.date) {
    updatePlanDateValue(state.lastSchedule.date);
  } else if (state.lastWeekPlan?.days?.length) {
    updatePlanDateValue(state.lastWeekPlan.days[0].date || getSelectedPlanDate());
  }

  persistPlannerPrefsFromForm();
}

function resolveInitialWorkspaceView() {
  const hasAnySchedule = Boolean(
    (state.lastSchedule && !state.lastSchedule.emptyScaffold) || (state.lastWeekPlan && !state.lastWeekPlan.scaffold)
  );
  if (!hasAnySchedule) return "chat";
  return state.workspacePrefs.defaultStartupView || "chat";
}

function hasPlanningRules() {
  return state.fixedEvents.length > 0 || state.tasks.length > 0;
}

function weekPlanContainsDate(date) {
  return Boolean(date && state.lastWeekPlan?.days?.some((day) => day.date === date));
}

function resolveLoadableWeekDate(preferredDate) {
  if (!state.lastWeekPlan?.days?.length) return null;
  const preferred = state.lastWeekPlan.days.find((day) => day.date === preferredDate && day.ok);
  if (preferred) return preferred.date;
  return state.lastWeekPlan.days.find((day) => day.ok)?.date || null;
}

function showScheduleHydrationLoading(mode) {
  const targetDate = $("planDate").value || state.lastSchedule?.date || todayInputValue();
  if (!state.lastSchedule) {
    clearScheduleIssues();
    renderSchedule(buildEmptyDaySchedule(targetDate));
  }
  if (!state.lastWeekPlan) {
    renderWeekPlan(buildEmptyWeekPlan(targetDate));
  }
}

function findWeekDayEntry(date) {
  return getRenderableWeekPlan().days?.find((day) => day.date === date) || null;
}

function findWeekBlock(date, runtimeId) {
  return findWeekDayEntry(date)?.result?.blocks?.find((block) => block.runtimeId === runtimeId) || null;
}

function syncCurrentScheduleToWeekPlan() {
  if (!state.lastSchedule?.date || !state.lastWeekPlan?.days?.length) return;

  const dayEntry = findWeekDayEntry(state.lastSchedule.date);
  if (!dayEntry || !dayEntry.ok) return;

  dayEntry.result = prepareSchedule(state.lastSchedule);
  dayEntry.summary = summarizeScheduleResult(dayEntry.result);
  recalculateWeekPlanTotals(state.lastWeekPlan);
  persistPlanState();
  renderWeekPlan(state.lastWeekPlan);
}

async function refreshScheduleFromRules({ focusDate, resetCompletion = false } = {}) {
  const targetDate = focusDate || $("planDate").value || state.lastSchedule?.date || todayInputValue();
  updatePlanDateValue(targetDate);

  if (!hasPlanningRules()) {
    invalidateDerivedState();
    return null;
  }

  return fetchWeekPlan({
    focusDate: targetDate,
    loadDay: true,
    scrollToFirstBlock: false,
    resetCompletion,
  });
}

async function ensureScheduleHydrated({ preferMode = state.ui.scheduleMode, renderLoading = false } = {}) {
  const mode = preferMode === "day" ? "day" : "week";
  const targetDate = $("planDate").value || state.lastSchedule?.date || resolveLoadableWeekDate("") || todayInputValue();
  updatePlanDateValue(targetDate);
  const rulesExist = hasPlanningRules();

  if (mode === "day" && state.lastSchedule?.date === targetDate && (!rulesExist || !state.lastSchedule.emptyScaffold)) {
    return state.lastSchedule;
  }

  if (weekPlanContainsDate(targetDate) && (!rulesExist || !state.lastWeekPlan?.scaffold)) {
    if (!state.lastSchedule || state.lastSchedule.date !== targetDate) {
      loadDayFromWeek(targetDate, {
        resetCompletion: false,
        scrollToFirstBlock: false,
        fallbackToFirstOkDay: true,
        silent: true,
      });
    }
    return mode === "week" ? state.lastWeekPlan : state.lastSchedule;
  }

  if (!rulesExist) {
    return mode === "week" ? state.lastWeekPlan : state.lastSchedule;
  }

  if (renderLoading) {
    showScheduleHydrationLoading(mode);
  }

  if (!scheduleHydrationPromise) {
    scheduleHydrationPromise = (async () => {
      try {
        return await fetchWeekPlan({
          focusDate: targetDate,
          loadDay: true,
          scrollToFirstBlock: false,
          resetCompletion: false,
          fallbackToFirstOkDay: true,
        });
      } finally {
        scheduleHydrationPromise = null;
      }
    })();
  }

  const hydrated = await scheduleHydrationPromise;
  return mode === "week" ? hydrated : state.lastSchedule;
}

function syncCurrentDayFromWeek(date, options = {}) {
  if (!state.lastSchedule || state.lastSchedule.date !== date) return;

  const dayEntry = findWeekDayEntry(date);
  if (!dayEntry || !dayEntry.ok) return;

  setCurrentSchedule(dayEntry.result, {
    resetCompletion: false,
    scrollToRuntimeId: options.scrollToRuntimeId || null,
    scrollToFirstBlock: false,
  });
}

function setCurrentSchedule(schedule, options = {}) {
  const { resetCompletion = true, scrollToFirstBlock = false, scrollToRuntimeId = null } = options;
  const scheduleDate = schedule?.date || state.lastSchedule?.date || $("planDate").value || todayInputValue();
  updatePlanDateValue(scheduleDate);
  state.lastSchedule = prepareSchedule(applyLocalDayOverride(scheduleDate, schedule));

  if (resetCompletion) {
    state.completed = {};
    persistData();
  } else {
    persistData();
  }

  resetReminderCard();
  renderSchedule(state.lastSchedule, { scrollToFirstBlock, scrollToRuntimeId });
  persistPlanState();
}

function getVisibleBlocks(schedule) {
  if (!schedule) return [];
  return schedule.blocks.filter((block) => state.calendarSettings.showBuffers || block.type !== "buffer");
}

function computeLocalScheduleIssues(schedule) {
  if (!schedule) return [];

  const issues = [];
  const blocks = sortBlocks(schedule.blocks.slice());

  for (const block of blocks) {
    if (block.endMin <= block.startMin) {
      issues.push(
        buildIssue("error", "LOCAL_INVALID_RANGE", `${getBlockDisplayTitle(block)} 的时间区间无效`)
      );
      continue;
    }

    if (block.startMin < schedule.dayStartMin || block.endMin > schedule.dayEndMin) {
      issues.push(
        buildIssue(
          "error",
          "LOCAL_OUTSIDE_DAY",
          `${getBlockDisplayTitle(block)} 超出当日日程范围 ${schedule.dayStart}-${schedule.dayEnd}`
        )
      );
    }
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const current = blocks[index];
    for (let nextIndex = index + 1; nextIndex < blocks.length; nextIndex += 1) {
      const next = blocks[nextIndex];
      if (next.startMin >= current.endMin) break;
      if (!overlaps(current, next)) continue;

      const involvesBuffer = current.type === "buffer" || next.type === "buffer";
      const level = involvesBuffer ? "warning" : "error";
      const code = involvesBuffer ? "BUFFER_CONFLICT" : "LOCAL_OVERLAP";
      issues.push(
        buildIssue(
          level,
          code,
          `${getBlockDisplayTitle(current)} 与 ${getBlockDisplayTitle(next)} 在 ${minutesToTime(
            Math.max(current.startMin, next.startMin)
          )} 发生重叠`
        )
      );
    }
  }

  return issues;
}

function computeEventLayout(blocks) {
  const result = new Map();
  const sorted = sortBlocks(blocks.slice());
  let group = [];
  let groupMaxEnd = -1;

  function flushGroup(items) {
    if (items.length === 0) return;

    const columns = [];
    let maxColumns = 0;

    for (const item of items) {
      let columnIndex = columns.findIndex((endMin) => endMin <= item.startMin);
      if (columnIndex === -1) {
        columnIndex = columns.length;
        columns.push(item.endMin);
      } else {
        columns[columnIndex] = item.endMin;
      }

      item.column = columnIndex;
      maxColumns = Math.max(maxColumns, columns.length);
    }

    for (const item of items) {
      result.set(item.runtimeId, {
        column: item.column,
        columnCount: Math.max(1, maxColumns),
      });
    }
  }

  for (const block of sorted) {
    if (group.length === 0) {
      group = [block];
      groupMaxEnd = block.endMin;
      continue;
    }

    if (block.startMin < groupMaxEnd) {
      group.push(block);
      groupMaxEnd = Math.max(groupMaxEnd, block.endMin);
      continue;
    }

    flushGroup(group);
    group = [block];
    groupMaxEnd = block.endMin;
  }

  flushGroup(group);
  return result;
}

function buildEventMeta(block) {
  if (block.type === "task") {
    const items = [categoryLabel(block.category), energyLabel(block.energy), `优先级 ${block.priority}`];
    if (block.partial) items.push("部分安排");
    if (block.manual) items.push("本地调整");
    return items.join(" 路 ");
  }

  if (block.type === "fixed") {
    const items = ["定时事项"];
    if (block.bufferMin > 0) items.push(`缓冲 ${block.bufferMin} 分钟`);
    return items.join(" 路 ");
  }

  const items = ["缓冲区"];
  if (block.bufferMin > 0) items.push(`${block.bufferMin} 分钟`);
  return items.join(" 路 ");
}

function eventClassName(block) {
  if (block.type === "task") return `task ${block.category || "other"}`;
  return block.type;
}

function renderSchedule(schedule, options = {}) {
  const { scrollToFirstBlock = false, scrollToRuntimeId = null } = options;
  syncCalendarToolbar();
  const displaySchedule = getRenderableDaySchedule(schedule);

  const previousScrollLeft = $("calendarScroll")?.scrollLeft || 0;
  const visibleBlocks = getVisibleBlocks(displaySchedule);
  const layoutMap = computeEventLayout(visibleBlocks);
  const range = getCalendarRange();
  const dayPixelsPerMinute = getDayPixelsPerMinute();
  const height = Math.max(480, (range.endMin - range.startMin) * dayPixelsPerMinute);
  const canvasHeight = height + DAY_CALENDAR_TOP_GUTTER + DAY_CALENDAR_BOTTOM_GUTTER;
  const container = $("schedule");
  const shell = document.createElement("div");
  shell.className = "calendar-shell";

  const scroll = document.createElement("div");
  scroll.className = "calendar-scroll";
  scroll.id = "calendarScroll";

  const canvas = document.createElement("div");
  canvas.className = "calendar-canvas";
  canvas.style.height = `${canvasHeight}px`;

  const times = document.createElement("div");
  times.className = "calendar-times";

  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  grid.dataset.grid = "1";

  for (let minute = range.startMin; minute <= range.endMin; minute += 30) {
    const top = DAY_CALENDAR_TOP_GUTTER + (minute - range.startMin) * dayPixelsPerMinute;
    if (top < 0 || top > canvasHeight) continue;

    const line = document.createElement("div");
    line.className = `calendar-line ${minute === range.startMin ? "start" : minute % 60 === 0 ? "hour" : ""}`.trim();
    line.style.top = `${top}px`;
    grid.appendChild(line);

    if (minute % 60 === 0 || minute === range.endMin) {
      const label = document.createElement("div");
      label.className = "calendar-time-label";
      label.style.top = `${top}px`;
      label.textContent = minutesToTime(minute);
      times.appendChild(label);
    }
  }

  if (visibleBlocks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty";
    empty.textContent = "当前日期暂无事项。右键空白区域可新建事项，或直接创建重复定时事项。";
    grid.appendChild(empty);
  }

  for (const block of visibleBlocks) {
    const position = layoutMap.get(block.runtimeId) || { column: 0, columnCount: 1 };
    const top = DAY_CALENDAR_TOP_GUTTER + (block.startMin - range.startMin) * dayPixelsPerMinute;
    const rawHeight = (block.endMin - block.startMin) * dayPixelsPerMinute;
    const blockHeight = Math.max(28, rawHeight);
    const widthPercent = 100 / position.columnCount;
    const isDone = Boolean(state.completed[block.runtimeId]);
    const isAiFocused =
      state.ui.aiFocus?.date === displaySchedule.date &&
      Array.isArray(state.ui.aiFocus?.runtimeIds) &&
      state.ui.aiFocus.runtimeIds.includes(block.runtimeId);

    const el = document.createElement("article");
    el.className = `calendar-event ${eventClassName(block)}${blockHeight < 72 ? " compact" : ""}${
      isAiFocused ? " ai-focus" : ""
    }`;
    el.dataset.runtimeId = block.runtimeId;
    el.dataset.blockType = block.type;
    el.dataset.editable = block.editable ? "1" : "0";
    el.style.top = `${top}px`;
    el.style.height = `${blockHeight}px`;
    el.style.left = `calc(${position.column * widthPercent}% + 4px)`;
    el.style.width = `calc(${widthPercent}% - 8px)`;
    el.style.zIndex = String(4 + position.column);

    el.innerHTML = `
      <div class="calendar-event-head">
        <div class="calendar-event-time" data-role="time">${escapeHtml(block.start)} - ${escapeHtml(block.end)}</div>
        ${
          block.type === "task"
            ? `<button
                class="calendar-check ${isDone ? "is-done" : ""}"
                type="button"
                data-action="toggle-complete"
                data-runtime-id="${escapeHtml(block.runtimeId)}"
                title="${isDone ? "标记未完成" : "标记完成"}"
              >
                <span class="calendar-check-marker">${isDone ? "✓" : ""}</span>
              </button>`
            : `<span class="event-pill">${block.type === "fixed" ? "定时" : "缓冲"}</span>`
        }
      </div>
      <div class="calendar-event-title">${escapeHtml(block.title)}</div>
      <div class="calendar-event-meta">${escapeHtml(buildEventMeta(block))}</div>
    `;

    if (block.editable) {
      const startHandle = document.createElement("div");
      startHandle.className = "event-resize start";
      startHandle.dataset.resize = "start";

      const endHandle = document.createElement("div");
      endHandle.className = "event-resize end";
      endHandle.dataset.resize = "end";

      el.appendChild(startHandle);
      el.appendChild(endHandle);
    }

    grid.appendChild(el);
  }

  canvas.appendChild(times);
  canvas.appendChild(grid);
  scroll.appendChild(canvas);
  shell.appendChild(scroll);

  container.innerHTML = "";
  container.appendChild(shell);

  if (displaySchedule.unscheduled.length > 0) {
    const unscheduled = document.createElement("div");
    unscheduled.className = "unscheduled-panel";
    unscheduled.innerHTML = `
      <div class="unscheduled-head">
        <div class="unscheduled-title">未排入的任务</div>
        <div class="pill">${escapeHtml(String(displaySchedule.unscheduled.length))} 项</div>
      </div>
      <div class="unscheduled-list">
        ${displaySchedule.unscheduled
          .map(
            (item) => `
              <div class="unscheduled-item">
                <strong>${escapeHtml(item.title)}</strong> 路 ${escapeHtml(String(item.durationMin))} 分钟<br />
                ${escapeHtml(item.reason)}
              </div>
            `
          )
          .join("")}
      </div>
    `;
    container.appendChild(unscheduled);
  }

  const allIssues = [...(displaySchedule.issues || []), ...computeLocalScheduleIssues(displaySchedule)];
  renderScheduleIssues(allIssues);
  $("dayRange").textContent = displaySchedule.dateLabel
    ? `${displaySchedule.dateLabel} 路 ${displaySchedule.dayStart}-${displaySchedule.dayEnd}`
    : `${displaySchedule.dayStart}-${displaySchedule.dayEnd}`;
  updateProgressPill();

  if (scrollToRuntimeId) {
    const target = scroll.querySelector(`.calendar-event[data-runtime-id="${scrollToRuntimeId}"]`);
    if (target) {
      const top = Number.parseFloat(target.style.top) || 0;
      target.scrollIntoView({ block: "center", inline: "nearest" });
      return;
    }
  }

  if (scrollToFirstBlock) {
    const firstBlockRuntimeId = visibleBlocks[0]?.runtimeId;
    const firstEl = firstBlockRuntimeId
      ? scroll.querySelector(`.calendar-event[data-runtime-id="${firstBlockRuntimeId}"]`)
      : null;
    if (firstEl) {
      firstEl.scrollIntoView({ block: "start", inline: "nearest" });
      return;
    }
    return;
  }

  scroll.scrollLeft = previousScrollLeft;
}

function toggleTaskComplete(runtimeId) {
  if (!runtimeId) return;
  if (state.completed[runtimeId]) delete state.completed[runtimeId];
  else state.completed[runtimeId] = true;
  persistData();
  renderSchedule(state.lastSchedule);
}

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!json.ok) {
    const error = new Error(json.error || "API error");
    error.details = Array.isArray(json.details) ? json.details : [];
    throw error;
  }

  return json;
}

function buildChatContext() {
  const schedule = state.lastSchedule;
  const stats = computeCompletionStats(schedule);
  const scheduleBlocks = schedule
    ? schedule.blocks
        .filter((block) => block.type !== "buffer")
        .slice(0, 24)
        .map((block) => ({
          title: block.title || "",
          start: block.start || "",
          end: block.end || "",
          type: block.type || "task",
          category: block.category || "",
        }))
    : [];

  return {
    planDate: $("planDate").value || todayInputValue(),
    wakeTime: $("wakeTime").value || "07:30",
    bedtime: $("bedtime").value || "23:30",
    hasSchedule: Boolean(schedule),
    scheduleSummary: schedule
      ? `blocks=${schedule.blocks.length}, unscheduled=${schedule.unscheduled.length}, done=${stats.percent}%`
      : "no schedule loaded",
    scheduleBlocks,
  };
}

function setInlineStatus(id, message, { isError = false } = {}) {
  const el = $(id);
  if (!el) return;

  const text = String(message || "").trim();
  if (!text) {
    el.textContent = "";
    el.classList.add("hidden");
    el.dataset.state = "";
    return;
  }

  el.textContent = text;
  el.dataset.state = isError ? "error" : "ok";
  el.classList.remove("hidden");
}

function renderWorkspacePrefsForm() {
  $("defaultStartupView").value = state.workspacePrefs.defaultStartupView;
  $("defaultScheduleMode").value = state.workspacePrefs.defaultScheduleMode;
}

function setSelectedWeekdays(attributeName, daysOfWeek) {
  const normalized = normalizeWeekdays(daysOfWeek) || [];
  const selected = new Set(normalized);
  document.querySelectorAll(`input[${attributeName}]`).forEach((input) => {
    input.checked = selected.has(Number.parseInt(input.value, 10));
  });
}

function getSelectedFixedRule() {
  if (state.ui.selectedFixedId === NEW_FIXED_DRAFT_ID) return null;
  return state.fixedEvents.find((item) => item.id === state.ui.selectedFixedId) || null;
}

function getSelectedTaskRule() {
  if (state.ui.selectedTaskId === NEW_TASK_DRAFT_ID) return null;
  return state.tasks.find((item) => item.id === state.ui.selectedTaskId) || null;
}

function ensureRuleSelection() {
  if (state.ui.selectedFixedId !== NEW_FIXED_DRAFT_ID && !getSelectedFixedRule()) {
    state.ui.selectedFixedId = state.fixedEvents[0]?.id || null;
  }
  if (state.ui.selectedTaskId !== NEW_TASK_DRAFT_ID && !getSelectedTaskRule()) {
    state.ui.selectedTaskId = state.tasks[0]?.id || null;
  }
}

function resetFixedEditor() {
  $("fixedTitle").value = "";
  $("fixedStart").value = "09:00";
  $("fixedEnd").value = "10:30";
  $("fixedBuffer").value = "0";
  clearSelectedWeekdays("data-weekday-fixed");
  setWeekdayInputsDisabled("data-weekday-fixed", false);
  $("fixedRepeatReadonly").classList.add("hidden");
  $("fixedRepeatReadonly").textContent = "";
  setInlineStatus("fixedEditorStatus", "");
}

function resetTaskEditor() {
  $("taskTitle").value = "";
  $("taskCategory").value = "other";
  $("taskDuration").value = "30";
  $("taskEnergy").value = "medium";
  $("taskPriority").value = "3";
  $("taskWeeklyTarget").value = "0";
  $("taskSplit").checked = false;
  clearSelectedWeekdays("data-weekday-task");
  setInlineStatus("taskEditorStatus", "");
}

function renderRuleEditors() {
  ensureRuleSelection();

  const fixed = getSelectedFixedRule();
  if (fixed) {
    const assignedDates = normalizeAssignedDates(fixed.assignedDates);
    $("fixedEditorTitle").textContent = "Edit Timed Item";
    $("fixedTitle").value = fixed.title || "";
    $("fixedStart").value = fixed.start || "09:00";
    $("fixedEnd").value = fixed.end || "10:30";
    $("fixedBuffer").value = String(clampInt(fixed.bufferMin ?? 0, 0, 0, 180));
    setSelectedWeekdays("data-weekday-fixed", fixed.daysOfWeek);
    setWeekdayInputsDisabled("data-weekday-fixed", Boolean(assignedDates));
    $("fixedRepeatReadonly").classList.toggle("hidden", !assignedDates);
    $("fixedRepeatReadonly").textContent = assignedDates
      ? `这个定时事项按指定日期重复：${assignedDateSummary(assignedDates)}`
      : "";
    $("btnDeleteFixed").classList.remove("hidden");
    $("btnSubmitFixed").textContent = "Save Timed Item";
  } else {
    $("fixedEditorTitle").textContent = "New Timed Item";
    $("btnDeleteFixed").classList.add("hidden");
    $("btnSubmitFixed").textContent = "Create Timed Item";
    resetFixedEditor();
  }

  const task = getSelectedTaskRule();
  if (task) {
    $("taskEditorTitle").textContent = "Edit Task Rule";
    $("taskTitle").value = task.title || "";
    $("taskCategory").value = task.category || "other";
    $("taskDuration").value = String(task.durationMin || 30);
    $("taskEnergy").value = task.energy || "medium";
    $("taskPriority").value = String(clampInt(task.priority ?? 3, 3, 1, 5));
    $("taskWeeklyTarget").value = String(clampInt(task.weeklyTargetCount ?? 0, 0, 0, 7));
    $("taskSplit").checked = Boolean(task.splitAllowed);
    setSelectedWeekdays("data-weekday-task", task.daysOfWeek);
    $("btnDeleteTask").classList.remove("hidden");
    $("btnSubmitTask").textContent = "Save Task Rule";
  } else {
    $("taskEditorTitle").textContent = "New Task Rule";
    $("btnDeleteTask").classList.add("hidden");
    $("btnSubmitTask").textContent = "Create Task Rule";
    resetTaskEditor();
  }
}

function renderActiveView() {
  const active = state.ui.activeView || "chat";

  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.getAttribute("data-view-panel") !== active);
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-view") === active);
  });
}

function setActiveView(nextView) {
  const safeView = ["chat", "schedule", "settings"].includes(nextView) ? nextView : "chat";
  state.ui.activeView = safeView;
  renderActiveView();

  if (safeView === "schedule") {
    ensureScheduleHydrated({ preferMode: state.ui.scheduleMode, renderLoading: true }).catch(() => {});
  }
}

function renderScheduleMode() {
  const mode = state.ui.scheduleMode === "day" ? "day" : "week";
  $("scheduleDayPanel").classList.toggle("hidden", mode !== "day");
  $("scheduleWeekPanel").classList.toggle("hidden", mode !== "week");
  $("btnScheduleModeDay").classList.toggle("active", mode === "day");
  $("btnScheduleModeWeek").classList.toggle("active", mode === "week");
  renderScheduleToolbarChrome();
}

function setScheduleMode(nextMode) {
  state.ui.scheduleMode = nextMode === "day" ? "day" : "week";
  renderScheduleMode();
}

function renderDayUtilityPanel() {
  const isOpen = Boolean(state.scheduleViewPrefs.dayUtilityOpen);
  $("dayWorkbench")?.classList.toggle("utilities-open", isOpen);
  $("scheduleDayUtilities")?.classList.toggle("hidden", !isOpen);
  $("btnToggleDayUtilities")?.classList.toggle("active", isOpen);
  if ($("btnToggleDayUtilities")) {
    $("btnToggleDayUtilities").textContent = isOpen ? "Hide Tools" : "Show Tools";
  }
}

function setDayUtilityPanelOpen(nextOpen) {
  state.scheduleViewPrefs.dayUtilityOpen = Boolean(nextOpen);
  persistScheduleViewPrefs();
  renderDayUtilityPanel();
}

function renderWeekLayoutMode() {
  state.scheduleViewPrefs.weekLayout = "grid";
}

function setWeekLayoutMode() {
  state.scheduleViewPrefs.weekLayout = "grid";
  persistScheduleViewPrefs();
  if (state.lastWeekPlan) {
    renderWeekPlan(state.lastWeekPlan);
  }
}

function renderSettingsSection() {
  const active = state.ui.settingsSection || "app";
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.getAttribute("data-settings-panel") !== active);
  });
  document.querySelectorAll("[data-settings-section]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-settings-section") === active);
  });
}

function setSettingsSection(nextSection) {
  const safeSection = ["app", "ai", "rules", "community"].includes(nextSection) ? nextSection : "app";
  state.ui.settingsSection = safeSection;
  renderSettingsSection();
}

function renderRulesMode() {
  const mode = state.ui.rulesMode === "task" ? "task" : "fixed";
  $("rulesFixedPanel").classList.toggle("hidden", mode !== "fixed");
  $("rulesTaskPanel").classList.toggle("hidden", mode !== "task");
  document.querySelectorAll("[data-rules-mode]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-rules-mode") === mode);
  });
}

function setRulesMode(nextMode) {
  state.ui.rulesMode = nextMode === "task" ? "task" : "fixed";
  renderRulesMode();
}

function buildAiFocusSummary(focus) {
  if (!focus?.date) return "";
  const parts = [];
  if (focus.addedCount > 0) parts.push(`added ${focus.addedCount}`);
  if (focus.movedCount > 0) parts.push(`moved ${focus.movedCount}`);
  if (focus.removedCount > 0) parts.push(`removed ${focus.removedCount}`);
  const changeText = parts.length > 0 ? parts.join(", ") : "updated schedule";
  return `AI changes applied for ${focus.date}: ${changeText}. Highlighted blocks remain marked until you dismiss this banner.`;
}

function renderAiFocusBanner() {
  const banner = $("scheduleAiBanner");
  const text = $("scheduleAiBannerText");
  if (!banner || !text) return;

  const focus = state.ui.aiFocus;
  if (!focus) {
    banner.classList.add("hidden");
    text.textContent = "";
    return;
  }

  text.textContent = buildAiFocusSummary(focus);
  $("btnScheduleAiJumpWeek")?.classList.toggle("hidden", !state.lastWeekPlan?.days?.length);
  banner.classList.remove("hidden");
}

function clearAiFocus() {
  state.ui.aiFocus = null;
  renderAiFocusBanner();
  if (state.lastWeekPlan) renderWeekPlan(state.lastWeekPlan);
  if (state.lastSchedule) renderSchedule(state.lastSchedule);
}

function setAiFocus(focus) {
  state.ui.aiFocus = focus ? { ...focus } : null;
  renderAiFocusBanner();
}

async function loadAiConfigIntoForm() {
  if (!window.desktopApp || typeof window.desktopApp.getAiConfig !== "function") {
    setInlineStatus("aiConfigStatus", "AI config editing is available in the desktop build only.");
    return;
  }

  try {
    const config = await window.desktopApp.getAiConfig();
    $("relayBaseUrl").value = config?.RELAY_BASE_URL || "";
    $("relayModel").value = config?.RELAY_MODEL || "";
    $("relayApiKey").value = config?.RELAY_API_KEY || "";
    $("relayChatPath").value = config?.RELAY_CHAT_PATH || "";
    $("relayApiKeyHeader").value = config?.RELAY_API_KEY_HEADER || "";
    $("relayApiKeyPrefix").value = config?.RELAY_API_KEY_PREFIX || "";
    setInlineStatus("aiConfigStatus", "Desktop config loaded from the app profile.");
  } catch (error) {
    setInlineStatus("aiConfigStatus", `Failed to load AI config: ${error.message}`, { isError: true });
  }
}

function readAiConfigFormPayload() {
  return {
    RELAY_BASE_URL: $("relayBaseUrl").value.trim(),
    RELAY_MODEL: $("relayModel").value.trim(),
    RELAY_API_KEY: $("relayApiKey").value.trim(),
    RELAY_CHAT_PATH: $("relayChatPath").value.trim(),
    RELAY_API_KEY_HEADER: $("relayApiKeyHeader").value.trim(),
    RELAY_API_KEY_PREFIX: $("relayApiKeyPrefix").value,
  };
}

async function saveAiConfigFromForm(event) {
  event.preventDefault();

  if (!window.desktopApp || typeof window.desktopApp.saveAiConfig !== "function") {
    setInlineStatus("aiConfigStatus", "This build cannot save desktop AI config.", { isError: true });
    return;
  }

  const submitButton = $("btnSaveAiConfig");
  const previousButtonText = submitButton?.textContent || "Save AI Config";
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
    submitButton.textContent = "Detecting...";
  }
  setInlineStatus("aiConfigStatus", "Trying API base URL and auth patterns automatically...");

  try {
    const saved = await window.desktopApp.saveAiConfig(readAiConfigFormPayload());
    $("relayBaseUrl").value = saved?.RELAY_BASE_URL || "";
    $("relayModel").value = saved?.RELAY_MODEL || "";
    $("relayApiKey").value = saved?.RELAY_API_KEY || "";
    $("relayChatPath").value = saved?.RELAY_CHAT_PATH || "";
    $("relayApiKeyHeader").value = saved?.RELAY_API_KEY_HEADER || "";
    $("relayApiKeyPrefix").value = saved?.RELAY_API_KEY_PREFIX || "";
    const probe = saved?._probe;
    if (probe?.ok) {
      const prefixLabel = probe.authPrefix ? probe.authPrefix.trim() || "(custom prefix)" : "raw key";
      const modelLabel = probe.detectedModel || saved?.RELAY_MODEL || "";
      setInlineStatus(
        "aiConfigStatus",
        `AI config saved. Auto-detected ${probe.baseUrl}${probe.chatPath} with ${probe.authHeader} / ${prefixLabel}${
          modelLabel ? ` / model ${modelLabel}` : ""
        }.`
      );
    } else if (probe?.skipped) {
      setInlineStatus(
        "aiConfigStatus",
        `AI config saved. Auto-detect skipped: ${probe.reason || "missing required fields."}`
      );
    } else if (probe?.error) {
      setInlineStatus(
        "aiConfigStatus",
        `AI config saved, but auto-detect could not confirm the endpoint: ${probe.error}`,
        { isError: true }
      );
    } else {
      setInlineStatus("aiConfigStatus", "AI config saved. New chat requests will use the updated values.");
    }
  } catch (error) {
    setInlineStatus("aiConfigStatus", `Failed to save AI config: ${error.message}`, { isError: true });
  } finally {
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false;
      submitButton.textContent = previousButtonText;
    }
  }
}

function saveWorkspacePrefsFromForm() {
  state.workspacePrefs = normalizeWorkspacePrefs({
    ...state.workspacePrefs,
    defaultStartupView: $("defaultStartupView").value,
    defaultScheduleMode: $("defaultScheduleMode").value,
  });
  persistWorkspacePrefs();
  setScheduleMode(state.workspacePrefs.defaultScheduleMode);
  setInlineStatus("workspacePrefsStatus", "Workspace defaults saved.");
}

function hookWorkspaceChrome() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.getAttribute("data-view") || "chat";
      setActiveView(nextView);
    });
  });

  document.querySelectorAll("[data-schedule-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.getAttribute("data-schedule-mode") || "week";
      setScheduleMode(nextMode);
      if (state.ui.activeView === "schedule") {
        ensureScheduleHydrated({ preferMode: nextMode, renderLoading: true }).catch(() => {});
      }
    });
  });

  document.querySelectorAll("[data-settings-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextSection = button.getAttribute("data-settings-section") || "app";
      setSettingsSection(nextSection);
    });
  });

  document.querySelectorAll("[data-rules-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.getAttribute("data-rules-mode") || "fixed";
      setRulesMode(nextMode);
    });
  });

  $("btnSaveWorkspacePrefs")?.addEventListener("click", () => saveWorkspacePrefsFromForm());
  $("btnSidebarCollapse")?.addEventListener("click", () => setNavCollapsed(!state.workspacePrefs.navCollapsed));
  $("btnScheduleSidebarCollapse")?.addEventListener("click", () =>
    setScheduleSidebarCollapsed(!state.scheduleViewPrefs.scheduleSidebarCollapsed)
  );
  SCHEDULE_SIDEBAR_SECTIONS.forEach((section) => {
    $(section.buttonId)?.addEventListener("click", () =>
      setScheduleSidebarSectionCollapsed(section.key, !state.scheduleViewPrefs[section.key])
    );
  });
  $("aiConfigForm")?.addEventListener("submit", (event) => saveAiConfigFromForm(event));
  $("btnScheduleToday")?.addEventListener("click", () => updatePlanDateValue(todayInputValue(), { dispatchChange: true }));
  $("btnSchedulePrev")?.addEventListener("click", () => shiftSelectedScheduleDate(-1));
  $("btnScheduleNext")?.addEventListener("click", () => shiftSelectedScheduleDate(1));
  $("btnMiniMonthPrev")?.addEventListener("click", () => shiftMiniMonth(-1));
  $("btnMiniMonthNext")?.addEventListener("click", () => shiftMiniMonth(1));
  $("miniMonthGrid")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const dateButton = target.closest("[data-mini-date]");
    if (!(dateButton instanceof HTMLElement)) return;
    const nextDate = dateButton.getAttribute("data-mini-date");
    if (!nextDate) return;
    updatePlanDateValue(nextDate, { dispatchChange: true });
  });
  $("btnToggleDayUtilities")?.addEventListener("click", () =>
    setDayUtilityPanelOpen(!state.scheduleViewPrefs.dayUtilityOpen)
  );
  $("btnScheduleAiClear")?.addEventListener("click", () => clearAiFocus());
  $("btnScheduleAiJumpDay")?.addEventListener("click", () => {
    setActiveView("schedule");
    setScheduleMode("day");
  });
  $("btnScheduleAiJumpWeek")?.addEventListener("click", () => {
    setActiveView("schedule");
    setScheduleMode("week");
    ensureScheduleHydrated({ preferMode: "week", renderLoading: true }).catch(() => {});
  });

  $("btnNewFixed")?.addEventListener("click", () => {
    state.ui.selectedFixedId = NEW_FIXED_DRAFT_ID;
    renderLists();
  });
  $("btnDeleteFixed")?.addEventListener("click", () => {
    const fixed = getSelectedFixedRule();
    if (!fixed) return;
    state.fixedEvents = state.fixedEvents.filter((item) => item.id !== fixed.id);
    state.ui.selectedFixedId = state.fixedEvents[0]?.id || null;
    persistData();
    renderLists();
    refreshScheduleFromRules().catch((error) => {
      setInlineStatus("fixedEditorStatus", `Timed item deleted, but refresh failed: ${error.message}`, {
        isError: true,
      });
    });
  });
  $("btnNewTask")?.addEventListener("click", () => {
    state.ui.selectedTaskId = NEW_TASK_DRAFT_ID;
    renderLists();
  });
  $("btnDeleteTask")?.addEventListener("click", () => {
    const task = getSelectedTaskRule();
    if (!task) return;
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    state.ui.selectedTaskId = state.tasks[0]?.id || null;
    persistData();
    renderLists();
    refreshScheduleFromRules().catch((error) => {
      setInlineStatus("taskEditorStatus", `Task rule deleted, but refresh failed: ${error.message}`, {
        isError: true,
      });
    });
  });
}

function renderDesktopUi() {
  const banner = $("desktopBanner");
  const runtimeText = $("desktopRuntimeText");
  const storageNote = $("storageNote");
  const info = state.ui.desktopInfo;

  if (!banner || !runtimeText || !storageNote) return;

  if (!info || !info.isDesktop) {
    banner.classList.add("hidden");
    return;
  }

  runtimeText.textContent = `Desktop mode active · v${info.version || "0.0.0"} · config and data live in your Windows app profile.`;
  runtimeText.title = `${info.envPath || ""}\n${info.dataDir || ""}\n${info.workspaceStatePath || ""}`.trim();
  storageNote.textContent =
    "Desktop mode: workspace state is persisted to the app profile data folder, so schedules and preferences survive app restarts even when the local server port changes.";
  banner.classList.remove("hidden");
}

async function initDesktopUi() {
  if (!window.desktopApp || typeof window.desktopApp.getRuntimeInfo !== "function") return;

  try {
    const info = await window.desktopApp.getRuntimeInfo();
    if (!info || typeof info !== "object") return;
    state.ui.desktopInfo = info;
    renderDesktopUi();
  } catch {
    // Ignore desktop bridge failures and keep web behavior.
  }
}

function hookDesktopActions() {
  const configBtn = $("btnDesktopOpenConfig");
  const dataBtn = $("btnDesktopOpenData");

  if (!window.desktopApp) return;

  configBtn?.addEventListener("click", async () => {
    try {
      await window.desktopApp.openConfigFile();
    } catch {
      alert("Unable to open config file.");
    }
  });

  dataBtn?.addEventListener("click", async () => {
    try {
      await window.desktopApp.openDataDirectory();
    } catch {
      alert("Unable to open data folder.");
    }
  });
}

function renderChatMessages() {
  const box = $("chatMessages");
  if (!box) return;

  box.innerHTML = "";
  for (let index = 0; index < state.chatHistory.length; index += 1) {
    const item = state.chatHistory[index];
    const hasActions = item.role === "assistant" && Array.isArray(item.actions) && item.actions.length > 0;
    const row = document.createElement("div");
    row.className = `chat-row ${item.role}`;
    row.innerHTML = `
      <div class="chat-role">${item.role === "assistant" ? "AI" : "You"}</div>
      <div class="chat-bubble">${escapeHtml(item.content).replace(/\n/g, "<br />")}</div>
      ${
        hasActions
          ? `<button class="btn tiny chat-apply-btn" type="button" data-chat-apply-index="${index}">
               Apply from this reply (${item.actions.length})
             </button>`
          : ""
      }
    `;
    box.appendChild(row);
  }

  box.scrollTop = box.scrollHeight;
}

function normalizeAiActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((raw) => {
      const rawType = String(raw?.type || raw?.action || raw?.kind || raw?.operation || raw?.op || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
      const typeMap = {
        add: "add_task_block",
        add_block: "add_task_block",
        add_task: "add_task_block",
        create: "add_task_block",
        create_task: "add_task_block",
        create_block: "add_task_block",
        insert: "add_task_block",
        insert_task: "add_task_block",
        move: "move_block",
        move_task: "move_block",
        reschedule: "move_block",
        shift: "move_block",
        update_time: "move_block",
        relocate: "move_block",
        remove: "remove_block",
        delete: "remove_block",
        remove_task: "remove_block",
        delete_task: "remove_block",
        cancel_task: "remove_block",
      };
      const type =
        rawType === "add_task_block" || rawType === "move_block" || rawType === "remove_block"
          ? rawType
          : typeMap[rawType] || "";
      const title = String(raw?.title || raw?.name || raw?.taskTitle || raw?.task || "").trim();
      const matchTitle = String(raw?.matchTitle || raw?.targetTitle || raw?.target || raw?.match || title).trim();
      const category = String(raw?.category || "").trim().toLowerCase();
      const energy = String(raw?.energy || "").trim().toLowerCase();
      return {
        type,
        title,
        matchTitle,
        start: String(raw?.start || raw?.startTime || raw?.from || raw?.begin || "").trim().replace(/：/g, ":"),
        end: String(raw?.end || raw?.endTime || raw?.to || raw?.finish || "").trim().replace(/：/g, ":"),
        category: ["study", "code", "workout", "other"].includes(category) ? category : "other",
        energy: ["high", "medium", "low"].includes(energy) ? energy : "medium",
        priority: clampInt(raw?.priority ?? 3, 3, 1, 5),
      };
    })
    .filter((item) => item.type);
}

function aiActionSummary(actions) {
  if (!actions.length) return "No actionable change.";
  return actions
    .map((action, index) => {
      if (action.type === "add_task_block") {
        return `${index + 1}. Add: ${action.title || "(untitled)"} ${action.start}-${action.end}`;
      }
      if (action.type === "move_block") {
        return `${index + 1}. Move: ${action.matchTitle || "(match)"} -> ${action.start}-${action.end}`;
      }
      if (action.type === "remove_block") {
        return `${index + 1}. Remove: ${action.matchTitle || "(match)"}`;
      }
      return `${index + 1}. Unsupported action: ${action.type}`;
    })
    .join("\n");
}

function openAiApplyModal(actions) {
  const modal = $("aiApplyModal");
  const summary = $("aiApplySummary");
  if (!modal || !summary) return;

  summary.textContent = aiActionSummary(actions);
  modal.classList.remove("hidden");
}

function closeAiApplyModal() {
  $("aiApplyModal")?.classList.add("hidden");
}

function clearPendingAiProposal() {
  state.ui.pendingAiProposal = null;
  updateAiProposalUi();
}

function updateAiProposalUi() {
  const hasProposal = Array.isArray(state.ui.pendingAiProposal) && state.ui.pendingAiProposal.length > 0;
  const reviewBtn = $("btnAiProposalReview");
  const discardBtn = $("btnAiProposalDiscard");
  const hint = $("aiProposalHint");

  if (reviewBtn) reviewBtn.classList.toggle("hidden", !hasProposal);
  if (discardBtn) discardBtn.classList.toggle("hidden", !hasProposal);
  if (hint) {
    hint.classList.toggle("hidden", !hasProposal);
    hint.textContent = hasProposal
      ? `AI proposal ready: ${state.ui.pendingAiProposal.length} action(s). You can review/apply anytime.`
      : "";
  }
}

function findTaskBlockByTitleMatch(matchTitle) {
  if (!state.lastSchedule?.blocks?.length) return null;
  const needle = String(matchTitle || "").trim().toLowerCase();
  if (!needle) return null;
  return (
    state.lastSchedule.blocks.find(
      (block) => block.type === "task" && String(block.title || "").toLowerCase().includes(needle)
    ) || null
  );
}

function applyAiActions(actions) {
  const undoSnapshot = captureScheduleUndoSnapshot();
  if (!state.lastSchedule) {
    const targetDate = $("planDate").value || todayInputValue();
    const dayEntry = findWeekDayEntry(targetDate);
    if (dayEntry?.ok) {
      setCurrentSchedule(dayEntry.result, { resetCompletion: false, scrollToFirstBlock: false });
    } else {
      state.lastSchedule = buildEmptyDaySchedule(targetDate);
      persistPlanState();
    }
  }

  if (!state.lastSchedule) {
    throw new Error("当前没有可修改的日程。请先生成并加载某一天日程。");
  }

  ensureEditableWeekPlan();

  let changed = 0;
  let addedCount = 0;
  let movedCount = 0;
  let removedCount = 0;
  const changedRuntimeIds = [];
  const removedTitles = [];
  for (const action of actions) {
    if (action.type === "add_task_block") {
      const startMin = parseTimeToMinutes(action.start);
      const endMin = parseTimeToMinutes(action.end);
      if (startMin == null || endMin == null || endMin <= startMin) continue;

      const runtimeId = uid("blk");
      state.lastSchedule.blocks.push(
        prepareBlock({
          type: "task",
          id: uid("ai-task"),
          runtimeId,
          title: action.title || "AI Planned Task",
          category: action.category || "other",
          energy: action.energy || "medium",
          priority: action.priority || 3,
          startMin,
          endMin,
          manual: true,
        })
      );
      changed += 1;
      addedCount += 1;
      changedRuntimeIds.push(runtimeId);
      continue;
    }

    if (action.type === "move_block") {
      const target = findTaskBlockByTitleMatch(action.matchTitle);
      const startMin = parseTimeToMinutes(action.start);
      const endMin = parseTimeToMinutes(action.end);
      if (!target || startMin == null || endMin == null || endMin <= startMin) continue;

      updateBlockTimes(target, startMin, endMin);
      target.manual = true;
      changed += 1;
      movedCount += 1;
      changedRuntimeIds.push(target.runtimeId);
      continue;
    }

    if (action.type === "remove_block") {
      const target = findTaskBlockByTitleMatch(action.matchTitle);
      if (!target) continue;
      state.lastSchedule.blocks = state.lastSchedule.blocks.filter((b) => b.runtimeId !== target.runtimeId);
      delete state.completed[target.runtimeId];
      changed += 1;
      removedCount += 1;
      removedTitles.push(target.title);
    }
  }

  if (changed === 0) {
    return {
      changed: 0,
      date: state.lastSchedule?.date || $("planDate").value || todayInputValue(),
      runtimeIds: [],
      removedTitles: [],
      addedCount: 0,
      movedCount: 0,
      removedCount: 0,
    };
  }

  sortBlocks(state.lastSchedule.blocks);
  state.lastSchedule = prepareSchedule(state.lastSchedule);
  saveLocalDayOverride(state.lastSchedule.date, state.lastSchedule);
  persistData();
  const runtimeIds = [...new Set(changedRuntimeIds)];
  renderSchedule(state.lastSchedule, { scrollToRuntimeId: runtimeIds[0] || null });
  syncCurrentScheduleToWeekPlan();
  registerScheduleUndo(undoSnapshot, {
    changedDates: [state.lastSchedule.date],
    label: "已应用 AI 改动",
  });
  return {
    changed,
    date: state.lastSchedule.date,
    runtimeIds,
    removedTitles,
    addedCount,
    movedCount,
    removedCount,
  };
}

function focusScheduleFromAiResult(result) {
  if (!result || result.changed <= 0) return;

  setAiFocus({
    date: result.date,
    runtimeIds: result.runtimeIds || [],
    removedTitles: result.removedTitles || [],
    addedCount: result.addedCount || 0,
    movedCount: result.movedCount || 0,
    removedCount: result.removedCount || 0,
  });

  setActiveView("schedule");
  setScheduleMode("day");
  renderAiFocusBanner();

  if (state.lastWeekPlan) {
    renderWeekPlan(state.lastWeekPlan);
  }
  if (state.lastSchedule) {
    renderSchedule(state.lastSchedule, {
      scrollToRuntimeId: result.runtimeIds?.[0] || null,
    });
  }

  if (!state.lastWeekPlan?.days?.length && hasPlanningRules()) {
    ensureScheduleHydrated({ preferMode: "week" }).catch(() => {});
  }
}

function pushChatMessage(role, content, options = {}) {
  const text = String(content || "").trim();
  if (!text) return;
  const id = String(options.id || uid("chatmsg"));
  state.chatHistory.push({
    id,
    role: role === "assistant" ? "assistant" : "user",
    content: text,
    actions: normalizeAiActions(options.actions || []),
  });
  state.chatHistory = normalizeChatHistory(state.chatHistory);
  persistChatHistory();
  renderChatMessages();
  return id;
}

function upsertChatMessageById(messageId, patch = {}) {
  const id = String(messageId || "").trim();
  if (!id) return false;
  const index = state.chatHistory.findIndex((item) => item.id === id);
  if (index < 0) return false;

  const item = state.chatHistory[index];
  if (typeof patch.content === "string") {
    item.content = patch.content.trim();
  }
  if (Array.isArray(patch.actions)) {
    item.actions = normalizeAiActions(patch.actions);
  }

  state.chatHistory = normalizeChatHistory(state.chatHistory);
  persistChatHistory();
  renderChatMessages();
  return true;
}

function setChatSending(nextSending) {
  state.ui.chatSending = Boolean(nextSending);

  const input = $("chatInput");
  const sendBtn = $("btnChatSend");
  if (!input || !sendBtn) return;

  input.disabled = state.ui.chatSending;
  sendBtn.disabled = state.ui.chatSending;
  sendBtn.textContent = state.ui.chatSending ? "Sending..." : "Send";
}

async function submitChatMessage(text) {
  const message = String(text || "").trim();
  if (!message || state.ui.chatSending) return;

  pushChatMessage("user", message);
  setChatSending(true);

  try {
    const history = state.chatHistory.slice(-16).map((item) => ({
      role: item.role,
      content: item.content,
    }));
    const context = buildChatContext();
    const streamMessageId = pushChatMessage("assistant", "Thinking...", { id: uid("chatmsg") });
    let streamText = "";
    let streamModel = "";
    let streamDone = false;

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream unavailable (${response.status})`);
      }

      const decoder = new TextDecoder();
      let buffer = "";

      const handlePacket = (packetText) => {
        const normalized = String(packetText || "").replace(/\r\n/g, "\n").trim();
        if (!normalized) return;

        let eventType = "message";
        const dataLines = [];

        for (const line of normalized.split("\n")) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim() || "message";
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (dataLines.length === 0) return;

        let payload = null;
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch {
          payload = null;
        }
        if (!payload) return;

        if (eventType === "token") {
          streamText += String(payload.token || "");
          upsertChatMessageById(streamMessageId, { content: streamText || "..." });
          return;
        }

        if (eventType === "meta") {
          streamModel = String(payload.model || streamModel || "");
          return;
        }

        if (eventType === "done") {
          streamDone = true;
          const actions = normalizeAiActions(payload.result?.actions || []);
          const finalText = String(payload.result?.text || streamText || "AI returned empty content.");
          const modelText = String(payload.result?.model || streamModel || "");
          const monitorLine = `[monitor] actions=${actions.length}${modelText ? `, model=${modelText}` : ""}`;
          upsertChatMessageById(streamMessageId, {
            content: `${finalText}\n\n${monitorLine}`,
            actions,
          });
          if (actions.length > 0) {
            state.ui.pendingAiProposal = actions;
            openAiApplyModal(actions);
            updateAiProposalUi();
          }
          return;
        }

        if (eventType === "error") {
          throw new Error(String(payload.error || "AI stream failed"));
        }
      };

      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let splitIndex = buffer.indexOf("\n\n");
        while (splitIndex >= 0) {
          const packet = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);
          handlePacket(packet);
          splitIndex = buffer.indexOf("\n\n");
        }
      }

      if (buffer.trim()) {
        handlePacket(buffer);
      }

      if (!streamDone) {
        throw new Error("AI stream interrupted");
      }
    } catch {
      const res = await api("/api/chat", {
        messages: history,
        context,
      });

      const actions = normalizeAiActions(res.result?.actions || []);
      const replyText = res.result?.text || "AI returned empty content.";
      const monitorLine = `[monitor] actions=${actions.length}${res.result?.model ? `, model=${res.result.model}` : ""}`;
      upsertChatMessageById(streamMessageId, {
        content: `${replyText}\n\n${monitorLine}`,
        actions,
      });

      if (actions.length > 0) {
        state.ui.pendingAiProposal = actions;
        openAiApplyModal(actions);
        updateAiProposalUi();
      }
    }
  } catch (error) {
    pushChatMessage("assistant", `AI request failed: ${error.message}`);
  } finally {
    setChatSending(false);
  }
}

function hasWeeklyTargetTasks() {
  return state.tasks.some((task) => clampInt(task.weeklyTargetCount ?? 0, 0, 0, 7) > 0);
}

function buildRuleFingerprintPayload() {
  const activeStart = $("wakeTime").value || "07:30";
  const activeEnd = $("bedtime").value || "23:30";

  return {
    dayStart: FULL_DAY_START,
    dayEnd: FULL_DAY_END,
    activeStart,
    activeEnd,
    fixedEvents: state.fixedEvents.map((item) => ({
      id: item.id,
      title: item.title,
      start: item.start,
      end: item.end,
      bufferMin: clampInt(item.bufferMin ?? 0, 0, 0, 180),
      daysOfWeek: normalizeWeekdays(item.daysOfWeek),
      assignedDates: normalizeAssignedDates(item.assignedDates),
    })),
    tasks: state.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      durationMin: task.durationMin,
      category: task.category,
      energy: task.energy,
      priority: task.priority,
      splitAllowed: Boolean(task.splitAllowed),
      earliestStart: activeStart,
      latestEnd: activeEnd,
      daysOfWeek: normalizeWeekdays(task.daysOfWeek),
      weeklyTargetCount: clampInt(task.weeklyTargetCount ?? 0, 0, 0, 7),
    })),
  };
}

function computeRuleFingerprint() {
  return JSON.stringify(buildRuleFingerprintPayload());
}

function toOverrideBlockPayload(block) {
  return {
    type: block.type,
    id: block.id || null,
    runtimeId: block.runtimeId || null,
    title: block.title,
    startMin: block.startMin,
    endMin: block.endMin,
    category: block.category || "other",
    energy: block.energy || "medium",
    priority: clampInt(block.priority ?? 3, 3, 1, 5),
    splitAllowed: Boolean(block.splitAllowed),
    bufferMin: clampInt(block.bufferMin ?? 0, 0, 0, 180),
    sourceTitle: block.sourceTitle || "",
    manual: Boolean(block.manual),
    editable: Boolean(block.editable),
  };
}

function saveLocalDayOverride(date, schedule) {
  if (!date || !schedule) return;

  const blocks = Array.isArray(schedule.blocks) ? schedule.blocks : [];
  state.localDayOverrides[date] = {
    savedAt: new Date().toISOString(),
    fingerprint: computeRuleFingerprint(),
    blocks: blocks.filter((block) => block.type !== "buffer").map(toOverrideBlockPayload),
  };

  pruneLocalDayOverrides();
  storage.save("asp.localDayOverrides", state.localDayOverrides);
}

function applyLocalDayOverride(date, schedule) {
  if (!date || !schedule) return schedule;
  const entry = state.localDayOverrides?.[date];
  if (!entry || !Array.isArray(entry.blocks)) return schedule;
  if (entry.fingerprint !== computeRuleFingerprint()) return schedule;

  const patchedBlocks = entry.blocks.map((raw) =>
    prepareBlock({
      ...raw,
      runtimeId: raw.runtimeId || uid("blk"),
    })
  );

  return {
    ...schedule,
    blocks: sortBlocks(patchedBlocks),
  };
}

function refreshAllLocalDayOverrideFingerprints() {
  const fingerprint = computeRuleFingerprint();
  Object.values(state.localDayOverrides || {}).forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    entry.fingerprint = fingerprint;
  });
  storage.save("asp.localDayOverrides", state.localDayOverrides);
}

function applyTaskPayloadToBlock(block, payload) {
  if (!block || !payload) return;
  block.title = payload.title;
  block.category = payload.category;
  block.energy = payload.energy;
  block.priority = payload.priority;
  block.manual = true;
  updateBlockTimes(block, payload.startMin, payload.endMin);
}

function updateTaskRuleFromPayload(taskId, payload) {
  const rule = getTaskRuleById(taskId);
  if (!rule || !payload) return false;

  rule.title = payload.title;
  rule.category = payload.category;
  rule.energy = payload.energy;
  rule.priority = payload.priority;
  rule.durationMin = Math.max(5, payload.endMin - payload.startMin);
  persistData();
  refreshAllLocalDayOverrideFingerprints();
  renderLists();
  return true;
}

function applyTaskPayloadToRepeatingOccurrences(taskId, payload, options = {}) {
  const scope = options.scope === "following_repeating" ? "following_repeating" : "all_repeating";
  const focusDate = parseIsoDate(options.focusDate) ? options.focusDate : state.lastSchedule?.date || todayInputValue();
  const undoSnapshot = options.undoSnapshot || captureScheduleUndoSnapshot();
  if (scope === "all_repeating") {
    updateTaskRuleFromPayload(taskId, payload);
  }

  const occurrences =
    scope === "following_repeating"
      ? findTaskOccurrencesInCurrentWeekFromDate(taskId, focusDate)
      : findTaskOccurrencesInCurrentWeek(taskId);

  const touchedDates = new Set();
  let scrollTargetRuntimeId = null;

  for (const occurrence of occurrences) {
    applyTaskPayloadToBlock(occurrence.block, payload);
    sortBlocks(occurrence.dayEntry.result.blocks);
    occurrence.dayEntry.summary = summarizeScheduleResult(occurrence.dayEntry.result);
    saveLocalDayOverride(occurrence.date, occurrence.dayEntry.result);
    touchedDates.add(occurrence.date);

    if (occurrence.date === options.focusDate && !scrollTargetRuntimeId) {
      scrollTargetRuntimeId = occurrence.block.runtimeId;
    }
  }

  if (
    state.lastSchedule?.blocks?.some(
      (block) => block.type === "task" && block.id === taskId && (scope !== "following_repeating" || state.lastSchedule.date >= focusDate)
    )
  ) {
    state.lastSchedule.blocks
      .filter(
        (block) => block.type === "task" && block.id === taskId && (scope !== "following_repeating" || state.lastSchedule.date >= focusDate)
      )
      .forEach((block) => applyTaskPayloadToBlock(block, payload));
    sortBlocks(state.lastSchedule.blocks);
    state.lastSchedule = prepareSchedule(state.lastSchedule);
    saveLocalDayOverride(state.lastSchedule.date, state.lastSchedule);
    touchedDates.add(state.lastSchedule.date);
  }

  if (state.lastWeekPlan?.days?.length) {
    recalculateWeekPlanTotals(state.lastWeekPlan);
    persistPlanState();
    renderWeekPlan(state.lastWeekPlan);
  } else {
    persistPlanState();
  }

  if (state.lastSchedule?.date && touchedDates.has(state.lastSchedule.date)) {
    syncCurrentDayFromWeek(state.lastSchedule.date, { scrollToRuntimeId: scrollTargetRuntimeId });
    if (!weekPlanContainsDate(state.lastSchedule.date)) {
      renderSchedule(state.lastSchedule, { scrollToRuntimeId: scrollTargetRuntimeId });
    }
  }

  const changedDates = [...touchedDates];
  if (changedDates.length > 0) {
    registerScheduleUndo(undoSnapshot, {
      changedDates,
      label: scope === "following_repeating" ? `已更新 ${focusDate} 及之后的重复任务` : "已更新全部重复任务",
    });
  }

  return {
    changedDates,
    changed: changedDates.length > 0,
  };
}

function applyTaskPayloadToAllRepeatingOccurrences(taskId, payload, options = {}) {
  return applyTaskPayloadToRepeatingOccurrences(taskId, payload, {
    ...options,
    scope: "all_repeating",
  });
}

function applyTaskPayloadToFollowingRepeatingOccurrences(taskId, payload, options = {}) {
  return applyTaskPayloadToRepeatingOccurrences(taskId, payload, {
    ...options,
    scope: "following_repeating",
  });
}

function applyFixedPayloadToBlock(block, payload) {
  if (!block || !payload) return;
  block.title = payload.title;
  block.bufferMin = clampInt(payload.bufferMin ?? block.bufferMin ?? 0, 0, 0, 180);
  block.manual = true;
  updateBlockTimes(block, payload.startMin, payload.endMin);
}

function applyFixedPayloadToSingleDay(runtimeId, payload, options = {}) {
  const surface = options.surface || "day";
  const date = options.date || state.lastSchedule?.date || $("planDate").value || todayInputValue();
  const undoSnapshot = options.undoSnapshot || captureScheduleUndoSnapshot();

  if (surface === "week") {
    ensureEditableWeekPlan();
    const dayEntry = findWeekDayEntry(date);
    if (!dayEntry?.ok) throw new Error("这一天当前不可编辑");

    const block = findWeekBlock(date, runtimeId);
    if (!block || block.type !== "fixed") {
      throw new Error("未找到对应定时事项");
    }

    applyFixedPayloadToBlock(block, payload);
    sortBlocks(dayEntry.result.blocks);
    updateWeekDayAfterLocalChange(date, { scrollToRuntimeId: block.runtimeId });
    registerScheduleUndo(undoSnapshot, {
      changedDates: [date],
      label: "已调整单日定时事项",
    });
    return;
  }

  const editableSchedule = ensureEditableDaySchedule();
  const block = editableSchedule.blocks.find((item) => item.runtimeId === runtimeId && item.type === "fixed");
  if (!block) {
    throw new Error("未找到对应定时事项");
  }

  applyFixedPayloadToBlock(block, payload);
  sortBlocks(editableSchedule.blocks);
  state.lastSchedule = prepareSchedule(editableSchedule);
  saveLocalDayOverride(state.lastSchedule.date, state.lastSchedule);
  persistPlanState();
  renderSchedule(state.lastSchedule, { scrollToRuntimeId: block.runtimeId });
  syncCurrentScheduleToWeekPlan();
  registerScheduleUndo(undoSnapshot, {
    changedDates: [state.lastSchedule.date],
    label: "已调整单日定时事项",
  });
}

function applyTaskPayloadToSingleDay(runtimeId, payload, options = {}) {
  const surface = options.surface || "day";
  const date = options.date || state.lastSchedule?.date || $("planDate").value || todayInputValue();
  const undoSnapshot = options.undoSnapshot || captureScheduleUndoSnapshot();

  if (surface === "week") {
    ensureEditableWeekPlan();
    const dayEntry = findWeekDayEntry(date);
    if (!dayEntry?.ok) throw new Error("这一天当前不可编辑");

    const block = findWeekBlock(date, runtimeId);
    if (!block || block.type !== "task") {
      throw new Error("任务块已不存在");
    }

    applyTaskPayloadToBlock(block, payload);
    sortBlocks(dayEntry.result.blocks);
    updateWeekDayAfterLocalChange(date, { scrollToRuntimeId: block.runtimeId });
    registerScheduleUndo(undoSnapshot, {
      changedDates: [date],
      label: "已调整单日任务",
    });
    return block.runtimeId;
  }

  const editableSchedule = ensureEditableDaySchedule();
  const block = editableSchedule.blocks.find((item) => item.runtimeId === runtimeId && item.type === "task");
  if (!block) {
    throw new Error("任务块已不存在");
  }

  applyTaskPayloadToBlock(block, payload);
  sortBlocks(editableSchedule.blocks);
  state.lastSchedule = prepareSchedule(editableSchedule);
  saveLocalDayOverride(state.lastSchedule.date, state.lastSchedule);
  persistPlanState();
  renderSchedule(state.lastSchedule, { scrollToRuntimeId: block.runtimeId });
  syncCurrentScheduleToWeekPlan();
  registerScheduleUndo(undoSnapshot, {
    changedDates: [state.lastSchedule.date],
    label: "已调整单日任务",
  });
  return block.runtimeId;
}

function createTaskBlockOnSurface(payload, options = {}) {
  const surface = options.surface || "day";
  const date = options.date || state.lastSchedule?.date || $("planDate").value || todayInputValue();
  const undoSnapshot = options.undoSnapshot || captureScheduleUndoSnapshot();

  if (surface === "week") {
    ensureEditableWeekPlan();
    const dayEntry = findWeekDayEntry(date);
    if (!dayEntry?.ok) {
      throw new Error("这一天当前不可编辑");
    }

    const newBlock = prepareBlock({
      type: "task",
      id: uid("manual-task"),
      runtimeId: uid("blk"),
      title: payload.title,
      category: payload.category,
      energy: payload.energy,
      priority: payload.priority,
      startMin: payload.startMin,
      endMin: payload.endMin,
      manual: true,
    });
    dayEntry.result.blocks.push(newBlock);
    sortBlocks(dayEntry.result.blocks);
    updateWeekDayAfterLocalChange(date, { scrollToRuntimeId: newBlock.runtimeId });
    registerScheduleUndo(undoSnapshot, {
      changedDates: [date],
      label: "已新建任务",
    });
    return newBlock.runtimeId;
  }

  const editableSchedule = ensureEditableDaySchedule();
  const newRuntimeId = uid("blk");
  editableSchedule.blocks.push(
    prepareBlock({
      type: "task",
      id: uid("manual-task"),
      runtimeId: newRuntimeId,
      title: payload.title,
      category: payload.category,
      energy: payload.energy,
      priority: payload.priority,
      startMin: payload.startMin,
      endMin: payload.endMin,
      manual: true,
    })
  );
  sortBlocks(editableSchedule.blocks);
  state.lastSchedule = prepareSchedule(editableSchedule);
  saveLocalDayOverride(state.lastSchedule.date, state.lastSchedule);
  persistPlanState();
  renderSchedule(state.lastSchedule, { scrollToRuntimeId: newRuntimeId });
  syncCurrentScheduleToWeekPlan();
  registerScheduleUndo(undoSnapshot, {
    changedDates: [state.lastSchedule.date],
    label: "已新建任务",
  });
  return newRuntimeId;
}

async function createFixedRule(rule, options = {}) {
  const undoSnapshot = options.undoSnapshot || captureScheduleUndoSnapshot();
  const previousFixedEvents = cloneData(state.fixedEvents);
  const previousSchedule = state.lastSchedule ? cloneData(state.lastSchedule) : null;
  const previousWeekPlan = state.lastWeekPlan ? cloneData(state.lastWeekPlan) : null;
  const previousCompleted = cloneData(state.completed);
  const nextRule = {
    id: String(rule.id || uid("fx")),
    title: String(rule.title || "").trim(),
    start: rule.start,
    end: rule.end,
    bufferMin: clampInt(rule.bufferMin ?? 0, 0, 0, 180),
    daysOfWeek: normalizeWeekdays(rule.daysOfWeek),
    assignedDates: normalizeAssignedDates(rule.assignedDates),
  };

  state.fixedEvents.push(nextRule);
  state.ui.selectedFixedId = nextRule.id;
  persistData();
  renderLists();

  try {
    await refreshAfterFixedRuleChange(options.focusDate || $("planDate").value || todayInputValue());
    const changedDates = [];
    if (state.lastWeekPlan?.days?.length) {
      state.lastWeekPlan.days.forEach((day) => {
        if (day?.ok && day.result?.blocks?.some((block) => block.type === "fixed" && block.id === nextRule.id)) {
          changedDates.push(day.date);
        }
      });
    }
    if (changedDates.length === 0) {
      changedDates.push(options.focusDate || $("planDate").value || todayInputValue());
    }
    registerScheduleUndo(undoSnapshot, {
      changedDates,
      label: "已创建重复定时事项",
    });
    return nextRule.id;
  } catch (error) {
    state.fixedEvents = previousFixedEvents;
    state.lastWeekPlan = previousWeekPlan;
    state.lastSchedule = previousSchedule;
    state.completed = previousCompleted;
    persistData();
    persistPlanState();
    renderLists();

    if (previousWeekPlan) renderWeekPlan(previousWeekPlan);
    else renderWeekPlan(null);

    if (previousSchedule) renderSchedule(previousSchedule);
    else renderSchedule(null);

    throw error;
  }
}

function buildBasePlannerPayload() {
  const planDate = $("planDate").value || todayInputValue();
  const activeStart = $("wakeTime").value || "07:30";
  const activeEnd = $("bedtime").value || "23:30";

  return {
    date: planDate,
    dayStart: FULL_DAY_START,
    dayEnd: FULL_DAY_END,
    fixedEvents: state.fixedEvents.map((item) => ({
      id: item.id,
      title: item.title,
      start: item.start,
      end: item.end,
      bufferMin: clampInt(item.bufferMin ?? 0, 0, 0, 180),
      daysOfWeek: normalizeWeekdays(item.daysOfWeek),
      assignedDates: normalizeAssignedDates(item.assignedDates),
    })),
    tasks: state.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      durationMin: task.durationMin,
      category: task.category,
      energy: task.energy,
      priority: task.priority,
      splitAllowed: task.splitAllowed,
      earliestStart: activeStart,
      latestEnd: activeEnd,
      daysOfWeek: normalizeWeekdays(task.daysOfWeek),
      weeklyTargetCount: clampInt(task.weeklyTargetCount ?? 0, 0, 0, 7),
    })),
  };
}

function quickStart() {
  state.fixedEvents = [];

  state.tasks = [
    {
      id: uid("t"),
      title: "通勤",
      category: "other",
      durationMin: 40,
      energy: "low",
      priority: 5,
      splitAllowed: false,
      daysOfWeek: [1, 2, 3, 4, 5],
      weeklyTargetCount: 0,
    },
    {
      id: uid("t"),
      title: "上课 / 会议准备",
      category: "study",
      durationMin: 90,
      energy: "medium",
      priority: 5,
      splitAllowed: false,
      daysOfWeek: [1, 2, 3, 4, 5],
      weeklyTargetCount: 0,
    },
    {
      id: uid("t"),
      title: "午餐",
      category: "other",
      durationMin: 30,
      energy: "low",
      priority: 3,
      splitAllowed: false,
      daysOfWeek: null,
      weeklyTargetCount: 0,
    },
    {
      id: uid("t"),
      title: "晚餐",
      category: "other",
      durationMin: 40,
      energy: "low",
      priority: 3,
      splitAllowed: false,
      daysOfWeek: null,
      weeklyTargetCount: 0,
    },
    {
      id: uid("t"),
      title: "背单词",
      category: "study",
      durationMin: 45,
      energy: "medium",
      priority: 4,
      splitAllowed: true,
      daysOfWeek: [1, 2, 3, 4, 5],
      weeklyTargetCount: 5,
    },
    {
      id: uid("t"),
      title: "Python 项目推进",
      category: "code",
      durationMin: 90,
      energy: "high",
      priority: 5,
      splitAllowed: false,
      daysOfWeek: [1, 2, 3, 4, 5],
      weeklyTargetCount: 3,
    },
    {
      id: uid("t"),
      title: "健身 / 羽毛球",
      category: "workout",
      durationMin: 60,
      energy: "high",
      priority: 4,
      splitAllowed: false,
      daysOfWeek: [2, 4, 6],
      weeklyTargetCount: 2,
    },
    {
      id: uid("t"),
      title: "整理资料",
      category: "other",
      durationMin: 25,
      energy: "low",
      priority: 2,
      splitAllowed: true,
      daysOfWeek: [0],
      weeklyTargetCount: 1,
    },
  ];

  state.completed = {};
  state.localDayOverrides = {};
  state.lastSchedule = null;
  state.lastWeekPlan = null;
  state.ui.aiFocus = null;
  clearSelectedWeekdays("data-weekday-fixed");
  clearSelectedWeekdays("data-weekday-task");
  $("taskWeeklyTarget").value = "0";
  persistData();
  persistPlanState();
  renderLists();
  renderAiFocusBanner();
  refreshScheduleFromRules({ resetCompletion: true }).catch((error) =>
    alert(`Quick example loaded, but schedule refresh failed: ${error.message}`)
  );
}

async function fetchWeekPlan({
  focusDate,
  loadDay = true,
  scrollToFirstBlock = false,
  resetCompletion = true,
  fallbackToFirstOkDay = false,
} = {}) {
  const payload = buildBasePlannerPayload();
  payload.date = focusDate || payload.date;
  updatePlanDateValue(payload.date);

  const res = await api("/api/week-schedule", {
    ...payload,
    startDate: mondayOfWeekIso(payload.date),
    dayCount: 7,
  });

  state.lastWeekPlan = prepareWeekPlan(res.result);
  renderWeekPlan(state.lastWeekPlan);
  persistPlanState();
  renderAiFocusBanner();

  if (!loadDay) return state.lastWeekPlan;

  let dayPlanDate = payload.date;
  let dayPlan = state.lastWeekPlan.days.find((day) => day.date === dayPlanDate);
  if ((!dayPlan || !dayPlan.ok) && fallbackToFirstOkDay) {
    const fallbackDate = resolveLoadableWeekDate(dayPlanDate);
    if (fallbackDate) {
      dayPlanDate = fallbackDate;
      updatePlanDateValue(fallbackDate);
      dayPlan = state.lastWeekPlan.days.find((day) => day.date === fallbackDate);
    }
  }

  if (!dayPlan) {
    throw new Error("当前日期不在当前周日程范围内");
  }

  if (!dayPlan.ok) {
    clearScheduleView();
    renderScheduleIssues(dayPlan.issues || []);
    throw new Error(dayPlan.error || "当日日程存在冲突");
  }

  setCurrentSchedule(dayPlan.result, { resetCompletion, scrollToFirstBlock });
  return state.lastWeekPlan;
}

async function generateSchedule() {
  const payload = buildBasePlannerPayload();
  await fetchWeekPlan({
    focusDate: payload.date,
    loadDay: true,
    scrollToFirstBlock: true,
    resetCompletion: true,
  });
}

async function generateWeekSchedule() {
  await fetchWeekPlan({
    focusDate: $("planDate").value || todayInputValue(),
    loadDay: true,
    scrollToFirstBlock: false,
    resetCompletion: true,
  });
}

function loadDayFromWeek(isoDate, options = {}) {
  const { resetCompletion = true, scrollToFirstBlock = true, fallbackToFirstOkDay = false, silent = false } = options;
  if (!state.lastWeekPlan?.days?.length) {
    ensureEditableWeekPlan();
  }
  if (!state.lastWeekPlan?.days?.length) return false;

  const targetDate = fallbackToFirstOkDay ? resolveLoadableWeekDate(isoDate) || isoDate : isoDate;
  updatePlanDateValue(targetDate);
  const dayPlan = state.lastWeekPlan.days.find((day) => day.date === targetDate);
  renderWeekPlan(state.lastWeekPlan);

  if (!dayPlan) {
    if (!silent) alert("当前日期不在当前周日程中");
    return false;
  }

  if (!dayPlan.ok) {
    clearScheduleView();
    renderScheduleIssues(dayPlan.issues || []);
    if (!silent) alert(dayPlan.error || "这一天存在冲突");
    return false;
  }

  setCurrentSchedule(dayPlan.result, { resetCompletion, scrollToFirstBlock });
  return true;
}

async function generateReminder() {
  if (!state.lastSchedule) {
    throw new Error("请先生成当日日程");
  }

  const res = await api("/api/reminder", {
    tone: $("tone").value || "snarky",
    wakeTime: $("wakeTime").value || "07:30",
    bedtime: $("bedtime").value || "23:30",
    stats: computeCompletionStats(state.lastSchedule),
  });

  $("reminder").textContent = res.result.text;
  $("downloadLink").classList.add("hidden");
  $("shareCanvas").style.display = "none";
}

function copyReminder() {
  const text = $("reminder").textContent || "";
  if (!text.trim()) return;
  navigator.clipboard?.writeText(text).catch(() => {});
}

function drawShareCard() {
  const schedule = state.lastSchedule;
  if (!schedule) return;

  const reminder = $("reminder").textContent || "";
  if (!reminder.trim() || reminder.includes("先生成当日日程")) return;

  const stats = computeCompletionStats(schedule);
  const canvas = $("shareCanvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.style.display = "block";

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#181b3a");
  gradient.addColorStop(0.5, "#0b1020");
  gradient.addColorStop(1, "#0a1820");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  blob(ctx, 260, 220, 240, "rgba(124,92,255,0.55)");
  blob(ctx, 860, 300, 260, "rgba(49,208,170,0.45)");
  blob(ctx, 780, 1080, 340, "rgba(255,92,122,0.25)");

  roundRect(ctx, 70, 80, canvas.width - 140, canvas.height - 160, 34);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "800 46px ui-sans-serif, system-ui, -apple-system, Segoe UI, PingFang SC, Microsoft YaHei";
  ctx.fillText("外包式自律 / 晚间提醒", 120, 175);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "600 26px ui-sans-serif, system-ui";
  ctx.fillText(
    `${schedule.dateLabel || "今日"} / 风格：${toneLabel($("tone").value)} / 完成 ${stats.percent}%`,
    120,
    220
  );

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "600 36px ui-sans-serif, system-ui";
  const lines = wrapText(ctx, reminder, 120, 320, canvas.width - 240, 52, 14);
  const lastY = 320 + lines.length * 52;

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 22px ui-sans-serif, system-ui";
  ctx.fillText("AI 日程规划 MVP / 先把今天排出来，再把今天执行掉", 120, canvas.height - 180);
  ctx.fillText(`生成时间：${new Date().toLocaleString()}`, 120, canvas.height - 140);

  const timelineTop = Math.min(canvas.height - 450, lastY + 50);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, 120, timelineTop, canvas.width - 240, 230, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "700 26px ui-sans-serif, system-ui";
  ctx.fillText("今日日程（节选）", 150, timelineTop + 46);

  ctx.font = "600 22px ui-sans-serif, system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  const blocks = schedule.blocks.filter((block) => block.type !== "buffer").slice(0, 6);
  let y = timelineTop + 85;
  for (const block of blocks) {
    ctx.fillText(`${block.start}-${block.end}  ${block.title}`, 150, y);
    y += 30;
  }

  const link = $("downloadLink");
  link.href = canvas.toDataURL("image/png");
  link.classList.remove("hidden");
}

function blob(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = String(text).split("");
  let line = "";
  let count = 0;
  const lines = [];

  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + count * lineHeight);
      lines.push(line);
      count += 1;
      line = ch;
      if (count >= maxLines - 1) break;
    } else {
      line = test;
    }
  }

  if (line && count < maxLines) {
    ctx.fillText(line, x, y + count * lineHeight);
    lines.push(line);
  }

  return lines;
}

async function refreshCommunity() {
  const res = await api("/api/community/top");
  const list = $("communityList");
  list.innerHTML = "";

  for (const post of res.posts) {
    const tags = (post.tags || []).join(" / ") || "无标签";
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="meta">
        <div class="name">${escapeHtml(post.text)}</div>
        <div class="sub">${escapeHtml(tags)} / 点赞 ${escapeHtml(String(post.likes || 0))}</div>
      </div>
      <button class="btn tiny" type="button" data-like="${escapeHtml(post.id)}">点赞</button>
    `;
    list.appendChild(el);
  }
}

async function postCurrentReminder() {
  const text = ($("reminder").textContent || "").trim();
  if (text.length < 5 || text.includes("先生成当日日程")) return;

  await api("/api/community/post", {
    text,
    tags: [toneLabel($("tone").value || "snarky")],
  });
  await refreshCommunity();
}

function hideContextMenu() {
  const menu = $("contextMenu");
  menu.classList.add("hidden");
  menu.innerHTML = "";
}

function openContextMenu({ x, y, items }) {
  const menu = $("contextMenu");
  menu.innerHTML = items
    .map((item) => {
      const attrs = [
        `data-action="${escapeHtml(item.action)}"`,
        item.runtimeId ? `data-runtime-id="${escapeHtml(item.runtimeId)}"` : "",
        item.startMin != null ? `data-start-min="${escapeHtml(String(item.startMin))}"` : "",
        item.date ? `data-date="${escapeHtml(item.date)}"` : "",
        item.surface ? `data-surface="${escapeHtml(item.surface)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" ${attrs} class="${item.danger ? "danger-item" : ""}">${escapeHtml(item.label)}</button>`;
    })
    .join("");

  menu.classList.remove("hidden");
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(12, Math.min(x, window.innerWidth - rect.width - 12))}px`;
  menu.style.top = `${Math.max(12, Math.min(y, window.innerHeight - rect.height - 12))}px`;
}

function scheduleMinuteFromPoint(clientY, gridEl) {
  const range = getCalendarRange();
  const rect = gridEl.getBoundingClientRect();
  const rawMin = range.startMin + (clientY - rect.top - DAY_CALENDAR_TOP_GUTTER) / getDayPixelsPerMinute();
  const snapped = roundToStep(rawMin, getSnapMinutes(), "nearest");
  return Math.max(range.startMin, Math.min(snapped, range.endMin - getSnapMinutes()));
}

function weekMinuteFromPoint(clientY, columnEl) {
  const rect = columnEl.getBoundingClientRect();
  const rawMin = FULL_DAY_START_MIN + (clientY - rect.top) / getWeekPixelsPerMinute();
  const snapped = roundToStep(rawMin, getSnapMinutes(), "nearest");
  return Math.max(FULL_DAY_START_MIN, Math.min(snapped, FULL_DAY_END_MIN - getSnapMinutes()));
}

function getEventEditorDate() {
  return (
    state.ui.editor?.date ||
    $("planDate")?.value ||
    state.lastSchedule?.date ||
    todayInputValue()
  );
}

function getDefaultRepeatWeekdays(date) {
  const parsed = parseIsoDate(date) || parseIsoDate(todayInputValue());
  return normalizeWeekdays([parsed.getDay()]) || [parsed.getDay()];
}

function buildFiniteRepeatDates(startDate, daysOfWeek, strategy, count, untilDate) {
  const start = parseIsoDate(startDate);
  if (!start) throw new Error("重复起始日期无效");

  const normalizedDays = normalizeWeekdays(daysOfWeek) || getDefaultRepeatWeekdays(startDate);
  const selectedDays = new Set(normalizedDays);
  selectedDays.add(start.getDay());

  const dates = [];
  const cursor = parseIsoDate(startDate);
  const safeCount = clampInt(count ?? 1, 1, 1, 365);

  if (strategy === "count") {
    for (let guard = 0; guard < 1095 && dates.length < safeCount; guard += 1) {
      const isoDate = toIsoDate(cursor);
      if (selectedDays.has(cursor.getDay()) && isoDate >= startDate) {
        dates.push(isoDate);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return normalizeAssignedDates(dates);
  }

  const until = parseIsoDate(untilDate);
  if (!until) throw new Error("请设置重复结束日期");
  if (toIsoDate(until) < startDate) {
    throw new Error("重复结束日期不能早于当前日期");
  }

  while (cursor <= until) {
    const isoDate = toIsoDate(cursor);
    if (selectedDays.has(cursor.getDay()) && isoDate >= startDate) {
      dates.push(isoDate);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return normalizeAssignedDates(dates);
}

function syncEventRecurrenceFields() {
  const enabled = Boolean($("eventRecurringEnabled")?.checked);
  const mode = $("eventRecurrenceMode")?.value || "forever";
  $("eventRecurrenceCountField")?.classList.toggle("hidden", !enabled || mode !== "count");
  $("eventRecurrenceUntilField")?.classList.toggle("hidden", !enabled || mode !== "until");
}

function syncEventModalView() {
  const blockType = $("eventBlockType").value || "task";
  const mode = $("eventMode").value || "edit";
  const isTask = blockType === "task";
  $("eventCategoryField").classList.toggle("hidden", !isTask);
  $("eventEnergyField").classList.toggle("hidden", !isTask);
  $("eventPriorityField").classList.toggle("hidden", !isTask);
  $("eventBufferField").classList.toggle("hidden", isTask);

  const showRecurrenceSection = isTask && mode === "create";
  $("eventRecurrenceSection")?.classList.toggle("hidden", !showRecurrenceSection);
  if (!showRecurrenceSection && $("eventRecurringEnabled")) {
    $("eventRecurringEnabled").checked = false;
  }
  syncEventRecurrenceFields();
}

function closeEventEditor() {
  state.ui.editor = null;
  $("eventModal").classList.add("hidden");
}

async function refreshAfterFixedRuleChange(focusDate) {
  await refreshScheduleFromRules({
    focusDate,
    resetCompletion: true,
  });
}

function openCalendarSettings() {
  $("calendarShowBuffers").checked = state.calendarSettings.showBuffers;
  $("calendarSnapMinutes").value = String(state.calendarSettings.snapMinutes);
  $("calendarSettingsModal").classList.remove("hidden");
  hideContextMenu();
}

function closeCalendarSettings() {
  $("calendarSettingsModal").classList.add("hidden");
}

function saveCalendarSettings(event) {
  event.preventDefault();

  state.calendarSettings = normalizeCalendarSettings({
    showBuffers: $("calendarShowBuffers").checked,
    snapMinutes: Number($("calendarSnapMinutes").value || DEFAULT_CALENDAR_SETTINGS.snapMinutes),
  });

  persistCalendarSettings();
  syncCalendarToolbar();
  if (state.lastSchedule) renderSchedule(state.lastSchedule);
  closeCalendarSettings();
}

function maybeAutoScroll(scrollEl, clientY) {
  if (!scrollEl) return;

  const rect = scrollEl.getBoundingClientRect();
  const margin = 48;
  let delta = 0;

  if (clientY < rect.top + margin) delta = -18;
  else if (clientY > rect.bottom - margin) delta = 18;

  if (delta !== 0) scrollEl.scrollTop += delta;
}

function cleanupDragListeners() {
  document.removeEventListener("pointermove", handleGlobalPointerMove);
  document.removeEventListener("pointerup", handleGlobalPointerUp);
  document.removeEventListener("pointercancel", handleGlobalPointerUp);
}

function hookListDeletes() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const fixedSelect = target.closest("[data-select-fixed]");
    if (fixedSelect instanceof HTMLElement) {
      state.ui.selectedFixedId = fixedSelect.getAttribute("data-select-fixed") || null;
      setInlineStatus("fixedEditorStatus", "");
      renderLists();
      return;
    }

    const taskSelect = target.closest("[data-select-task]");
    if (taskSelect instanceof HTMLElement) {
      state.ui.selectedTaskId = taskSelect.getAttribute("data-select-task") || null;
      setInlineStatus("taskEditorStatus", "");
      renderLists();
      return;
    }

    const fixedId = target.getAttribute("data-del-fixed");
    if (fixedId) {
      state.fixedEvents = state.fixedEvents.filter((item) => item.id !== fixedId);
      if (state.ui.selectedFixedId === fixedId) {
        state.ui.selectedFixedId = state.fixedEvents[0]?.id || null;
      }
      persistData();
      renderLists();
      refreshScheduleFromRules().catch((error) => {
        setInlineStatus("fixedEditorStatus", `Timed item deleted, but refresh failed: ${error.message}`, {
          isError: true,
        });
      });
      return;
    }

    const taskId = target.getAttribute("data-del-task");
    if (taskId) {
      state.tasks = state.tasks.filter((item) => item.id !== taskId);
      if (state.ui.selectedTaskId === taskId) {
        state.ui.selectedTaskId = state.tasks[0]?.id || null;
      }
      persistData();
      renderLists();
      refreshScheduleFromRules().catch((error) => {
        setInlineStatus("taskEditorStatus", `Task rule deleted, but refresh failed: ${error.message}`, {
          isError: true,
        });
      });
      return;
    }

    const loadDayTarget = target.closest("[data-load-day]");
    if (loadDayTarget instanceof HTMLElement) {
      const loadDay = loadDayTarget.getAttribute("data-load-day");
      if (!loadDay) return;
      setScheduleMode("day");
      loadDayFromWeek(loadDay);
      return;
    }

    if (!target.closest("#contextMenu")) {
      hideContextMenu();
    }
  });
}

function hookCommunityLike() {
  $("communityList").addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const id = target.getAttribute("data-like");
    if (!id) return;

    await api("/api/community/like", { id });
    await refreshCommunity();
  });
}

function initForms() {
  $("fixedForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = $("fixedTitle").value.trim();
    const start = $("fixedStart").value;
    const end = $("fixedEnd").value;
    const bufferMin = clampInt($("fixedBuffer").value || "0", 0, 0, 180);
    const daysOfWeek = getSelectedWeekdays("data-weekday-fixed");
    if (!title || !start || !end) return;

    const existing = getSelectedFixedRule();
    if (existing) {
      existing.title = title;
      existing.start = start;
      existing.end = end;
      existing.bufferMin = bufferMin;
      existing.daysOfWeek = normalizeAssignedDates(existing.assignedDates) ? existing.daysOfWeek : daysOfWeek;
      existing.assignedDates = normalizeAssignedDates(existing.assignedDates);
      setInlineStatus("fixedEditorStatus", "Timed item saved.");
    } else {
      const nextId = uid("fx");
      state.fixedEvents.push({ id: nextId, title, start, end, bufferMin, daysOfWeek, assignedDates: null });
      state.ui.selectedFixedId = nextId;
      setInlineStatus("fixedEditorStatus", "Timed item created.");
    }

    persistData();
    renderLists();
    try {
      await refreshScheduleFromRules();
    } catch (error) {
      setInlineStatus("fixedEditorStatus", `Timed item saved, but refresh failed: ${error.message}`, {
        isError: true,
      });
    }
  });

  $("taskForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = $("taskTitle").value.trim();
    const category = $("taskCategory").value;
    const durationMin = Number.parseInt($("taskDuration").value || "30", 10);
    const energy = $("taskEnergy").value;
    const priority = Number.parseInt($("taskPriority").value || "3", 10);
    const splitAllowed = $("taskSplit").checked;
    const weeklyTargetCount = clampInt($("taskWeeklyTarget").value || "0", 0, 0, 7);
    const daysOfWeek = getSelectedWeekdays("data-weekday-task");
    if (!title || !Number.isFinite(durationMin)) return;

    const existing = getSelectedTaskRule();
    if (existing) {
      existing.title = title;
      existing.category = category;
      existing.durationMin = durationMin;
      existing.energy = energy;
      existing.priority = priority;
      existing.splitAllowed = splitAllowed;
      existing.daysOfWeek = daysOfWeek;
      existing.weeklyTargetCount = weeklyTargetCount;
      setInlineStatus("taskEditorStatus", "Task rule saved.");
    } else {
      const nextId = uid("t");
      state.tasks.push({
        id: nextId,
        title,
        category,
        durationMin,
        energy,
        priority,
        splitAllowed,
        daysOfWeek,
        weeklyTargetCount,
      });
      state.ui.selectedTaskId = nextId;
      setInlineStatus("taskEditorStatus", "Task rule created.");
    }

    persistData();
    renderLists();
    try {
      await refreshScheduleFromRules();
    } catch (error) {
      setInlineStatus("taskEditorStatus", `Task rule saved, but refresh failed: ${error.message}`, {
        isError: true,
      });
    }
  });
}

function hookActionButtons() {
  $("btnQuickStart").addEventListener("click", () => quickStart());
  $("btnGenerate").addEventListener("click", () => {
    setScheduleMode("day");
    generateSchedule().catch((error) => {
      if (!Array.isArray(error.details) || error.details.length === 0) {
        alert(error.message);
      } else {
        renderScheduleIssues(error.details);
      }
    });
  });
  $("btnReminder").addEventListener("click", () => generateReminder().catch((error) => alert(error.message)));
  $("btnCopyReminder").addEventListener("click", () => copyReminder());
  $("btnShare").addEventListener("click", () => drawShareCard());
  $("btnRefreshCommunity").addEventListener("click", () => refreshCommunity().catch((error) => alert(error.message)));
  $("btnPostReminder").addEventListener("click", () => postCurrentReminder().catch((error) => alert(error.message)));
  $("btnCalendarSettings").addEventListener("click", () => openCalendarSettings());

  $("toggleBuffers").addEventListener("change", (event) => {
    state.calendarSettings.showBuffers = Boolean(event.target.checked);
    persistCalendarSettings();
    syncCalendarToolbar();
    if (state.lastSchedule) renderSchedule(state.lastSchedule);
  });
}

function hookBaseInputChanges() {
  ["planDate", "wakeTime", "bedtime"].forEach((id) => {
    $(id).addEventListener("change", async () => {
      persistPlannerPrefsFromForm();
      if (id === "planDate") {
        syncScheduleMonthCursorToDate($("planDate").value || todayInputValue());
      }
      renderScheduleChrome();

      if (id === "planDate" && weekPlanContainsDate($("planDate").value)) {
        loadDayFromWeek($("planDate").value, {
          resetCompletion: false,
          scrollToFirstBlock: false,
          silent: false,
        });
        return;
      }

      try {
        await refreshScheduleFromRules();
      } catch (error) {
        alert(error.message);
      }
    });
  });

  $("tone").addEventListener("change", () => {
    persistPlannerPrefsFromForm();
    renderScheduleChrome();
  });
}

function hookModalInteractions() {
  $("eventForm").addEventListener("submit", (event) => saveEventEditor(event));
  $("btnDeleteEvent").addEventListener("click", () => deleteCurrentEventBlock());
  $("btnCancelEvent").addEventListener("click", () => closeEventEditor());
  $("btnCloseEventModal").addEventListener("click", () => closeEventEditor());
  $("eventRecurringEnabled")?.addEventListener("change", () => syncEventModalView());
  $("eventRecurrenceMode")?.addEventListener("change", () => syncEventRecurrenceFields());

  $("calendarSettingsForm").addEventListener("submit", (event) => saveCalendarSettings(event));
  $("btnCancelCalendarSettings").addEventListener("click", () => closeCalendarSettings());
  $("btnCloseCalendarSettings").addEventListener("click", () => closeCalendarSettings());
  $("btnCloseConflictResolution")?.addEventListener("click", () => closeConflictResolutionModal("dismiss"));
  $("btnEditConflictResolution")?.addEventListener("click", () => closeConflictResolutionModal("edit"));
  $("btnConfirmConflictResolution")?.addEventListener("click", () => closeConflictResolutionModal("confirm"));
  $("btnCloseTaskScope")?.addEventListener("click", () => closeTaskScopeModal("dismiss"));
  $("btnTaskScopeSingle")?.addEventListener("click", () => closeTaskScopeModal("single"));
  $("btnTaskScopeFollowing")?.addEventListener("click", () => closeTaskScopeModal("following"));
  $("btnTaskScopeAll")?.addEventListener("click", () => closeTaskScopeModal("all"));
  $("btnCloseScheduleUndo")?.addEventListener("click", () => hideScheduleUndoToast());
  $("btnScheduleUndo")?.addEventListener("click", () => undoLastScheduleOperation());
  $("btnScheduleUndoApply")?.addEventListener("click", () => hideScheduleUndoToast());

  $("eventModal").addEventListener("click", (event) => {
    if (event.target === $("eventModal")) closeEventEditor();
  });
  $("calendarSettingsModal").addEventListener("click", (event) => {
    if (event.target === $("calendarSettingsModal")) closeCalendarSettings();
  });
  $("conflictResolutionModal")?.addEventListener("click", (event) => {
    if (event.target === $("conflictResolutionModal")) closeConflictResolutionModal("dismiss");
  });
  $("taskScopeModal")?.addEventListener("click", (event) => {
    if (event.target === $("taskScopeModal")) closeTaskScopeModal("dismiss");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    hideContextMenu();

    if (state.ui.drag) {
      const previousDrag = state.ui.drag;
      cleanupDragListeners();
      state.ui.drag = null;
      hideDragHint();
      previousDrag.rerender();
    }

    if (!$("eventModal").classList.contains("hidden")) closeEventEditor();
    if (!$("calendarSettingsModal").classList.contains("hidden")) closeCalendarSettings();
    if (!$("aiApplyModal")?.classList.contains("hidden")) closeAiApplyModal();
    if (!$("conflictResolutionModal")?.classList.contains("hidden")) closeConflictResolutionModal("dismiss");
    if (!$("taskScopeModal")?.classList.contains("hidden")) closeTaskScopeModal("dismiss");
    if (!$("scheduleUndoToast")?.classList.contains("hidden")) hideScheduleUndoToast();
  });

  document.addEventListener("scroll", () => hideContextMenu(), true);
  window.addEventListener("resize", () => hideContextMenu());
}

function openWeekBlockContextMenu(date, runtimeId, x, y) {
  const block = findWeekBlock(date, runtimeId);
  if (!block) return;

  const items = [];
  if (block.type === "task") {
    items.push({ action: "edit-event", label: "快速编辑", runtimeId, date, surface: "week" });
    items.push({ action: "delete-task", label: "删除任务", runtimeId, date, surface: "week", danger: true });
  } else if (block.type === "fixed") {
    items.push({ action: "edit-event", label: "编辑定时事项", runtimeId, date, surface: "week" });
  }

  items.push({ action: "load-week-day", label: "打开当日日程", date, surface: "week" });
  items.push({ action: "open-settings", label: "日历设置" });
  openContextMenu({ x, y, items });
}

function openWeekGridContextMenu(date, startMin, x, y) {
  openContextMenu({
    x,
    y,
    items: [
      { action: "create-task", label: `在 ${minutesToTime(startMin)} 新建事项`, startMin, date, surface: "week" },
      { action: "load-week-day", label: `打开 ${minutesToTime(startMin)} 所在日程`, date, surface: "week" },
      { action: "open-settings", label: "日历设置" },
    ],
  });
}

function hookChatAssistant() {
  const form = $("chatForm");
  const input = $("chatInput");
  const clearBtn = $("btnChatClear");
  const chatMessages = $("chatMessages");

  if (!form || !input || !clearBtn || !chatMessages) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await submitChatMessage(text);
  });

  clearBtn.addEventListener("click", () => {
    state.chatHistory = [
      {
        id: uid("chatmsg"),
        role: "assistant",
        content: "聊天记录已清空。继续告诉我你今天想怎么安排。",
        actions: [],
      },
    ];
    persistChatHistory();
    renderChatMessages();
  });

  chatMessages.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const btn = target.closest("[data-chat-apply-index]");
    if (!btn || !(btn instanceof HTMLElement)) return;

    const index = Number.parseInt(btn.getAttribute("data-chat-apply-index") || "", 10);
    if (!Number.isFinite(index)) return;

    const message = state.chatHistory[index];
    const actions = normalizeAiActions(message?.actions || []);
    if (!actions.length) return;

    state.ui.pendingAiProposal = actions;
    openAiApplyModal(actions);
    updateAiProposalUi();
  });

  $("btnAiProposalReview")?.addEventListener("click", () => {
    const actions = state.ui.pendingAiProposal || [];
    if (!actions.length) return;
    openAiApplyModal(actions);
  });

  $("btnAiProposalDiscard")?.addEventListener("click", () => {
    clearPendingAiProposal();
  });

  document.querySelectorAll("[data-chat-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prompt = btn.getAttribute("data-chat-prompt") || "";
      if (!prompt) return;
      input.value = prompt;
      input.focus();
    });
  });
}

function hookAiApplyModal() {
  const modal = $("aiApplyModal");
  const btnClose = $("btnCloseAiApply");
  const btnCancel = $("btnCancelAiApply");
  const btnConfirm = $("btnConfirmAiApply");
  if (!modal || !btnClose || !btnCancel || !btnConfirm) return;

  const close = () => closeAiApplyModal();
  btnClose.addEventListener("click", close);
  btnCancel.addEventListener("click", close);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  btnConfirm.addEventListener("click", async () => {
    try {
      const actions = state.ui.pendingAiProposal || [];
      await ensureScheduleHydrated({ preferMode: "day", renderLoading: true });
      const result = applyAiActions(actions);
      closeAiApplyModal();
      if (result.changed > 0) {
        clearPendingAiProposal();
        focusScheduleFromAiResult(result);
      } else {
        alert("No valid changes were applied.");
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

function closeConflictResolutionModal(result = "dismiss") {
  const modal = $("conflictResolutionModal");
  if (!modal) return;

  modal.classList.add("hidden");
  const pending = state.ui.conflictResolution;
  state.ui.conflictResolution = null;
  pending?.resolve?.(result);
}

function openConflictResolutionModal(config = {}) {
  const modal = $("conflictResolutionModal");
  const titleEl = $("conflictResolutionTitle");
  const summaryEl = $("conflictResolutionSummary");
  const detailsEl = $("conflictResolutionDetails");
  const confirmBtn = $("btnConfirmConflictResolution");
  const editBtn = $("btnEditConflictResolution");
  if (!modal || !titleEl || !summaryEl || !detailsEl || !confirmBtn || !editBtn) {
    return Promise.resolve("confirm");
  }

  if (state.ui.conflictResolution?.resolve) {
    state.ui.conflictResolution.resolve("dismiss");
  }

  const {
    title = "发现时间冲突",
    summary = "这次改动会带来以下影响：",
    issues = [],
    confirmLabel = "仍然保存",
    editLabel = "继续修改",
  } = config;

  titleEl.textContent = title;
  summaryEl.textContent = summary;
  detailsEl.innerHTML = (Array.isArray(issues) ? issues : [])
    .map((issue) => {
      const level = issue?.level === "error" ? "error" : "warn";
      return `<div class="modal-detail-item ${level}">${escapeHtml(issue?.message || "")}</div>`;
    })
    .join("");
  confirmBtn.textContent = confirmLabel;
  editBtn.textContent = editLabel;
  modal.classList.remove("hidden");

  return new Promise((resolve) => {
    state.ui.conflictResolution = { resolve };
  });
}

async function requestPlacementConfirmation(validation, options = {}) {
  if (!validation || validation.level === "ok") return true;
  if (!Array.isArray(validation.issues) || validation.issues.length === 0) return false;

  const result = await openConflictResolutionModal({
    title: options.title || "发现时间冲突",
    summary: options.summary || "这次改动会带来以下影响：",
    issues:
      Array.isArray(validation.issues) && validation.issues.length > 0
        ? validation.issues
        : [{ level: validation.level, message: validation.message || "存在时间冲突" }],
    confirmLabel: options.confirmLabel || "仍然保存",
    editLabel: options.editLabel || "继续修改",
  });

  return result === "confirm";
}

function closeTaskScopeModal(result = "dismiss") {
  const modal = $("taskScopeModal");
  if (!modal) return;

  modal.classList.add("hidden");
  const pending = state.ui.taskScopeResolution;
  state.ui.taskScopeResolution = null;
  pending?.resolve?.(result);
}

function openTaskScopeModal(config = {}) {
  const modal = $("taskScopeModal");
  const summaryEl = $("taskScopeSummary");
  const btnSingle = $("btnTaskScopeSingle");
  const btnFollowing = $("btnTaskScopeFollowing");
  const btnAll = $("btnTaskScopeAll");
  if (!modal || !summaryEl || !btnSingle || !btnAll || !btnFollowing) {
    return Promise.resolve("single_day");
  }

  if (state.ui.taskScopeResolution?.resolve) {
    state.ui.taskScopeResolution.resolve("dismiss");
  }

  const {
    summary = "这个任务在当前周里有多个重复实例。请选择这次修改的应用范围。",
    singleLabel = "只调整这一天",
    followingLabel = "",
    allLabel = "应用到所有重复任务",
  } = config;

  summaryEl.textContent = summary;
  btnSingle.textContent = singleLabel;
  btnFollowing.textContent = followingLabel || "只调整这一天之后";
  btnFollowing.classList.toggle("hidden", !followingLabel);
  btnAll.textContent = allLabel;
  modal.classList.remove("hidden");

  return new Promise((resolve) => {
    state.ui.taskScopeResolution = { resolve };
  });
}

async function requestTaskEditScope(block, options = {}) {
  if (!isRepeatableTaskBlock(block)) return "single_day";
  const count = countTaskOccurrencesInCurrentWeek(block.id);
  const focusDate = parseIsoDate(options.focusDate) ? options.focusDate : state.lastSchedule?.date || todayInputValue();
  const followingCount = countTaskOccurrencesInCurrentWeekFromDate(block.id, focusDate);

  const result = await openTaskScopeModal({
    summary:
      options.summary ||
      (count > 1
        ? `${block.title || "这个任务"} 在当前周里共有 ${count} 个重复实例。请选择这次调整的应用范围。`
        : `${block.title || "这个任务"} 来自重复任务规则。请选择只改今天，还是把这次改动同步到所有重复任务。`),
    singleLabel: options.singleLabel || "只调整这一天",
    followingLabel:
      options.followingLabel ||
      (count > 1 && followingCount > 0 ? `调整 ${focusDate} 及之后的重复任务` : ""),
    allLabel: options.allLabel || "应用到所有重复任务",
  });

  if (result === "all") return "all_repeating";
  if (result === "following") return "following_repeating";
  if (result === "single") return "single_day";
  return "dismiss";
}

async function resolveTaskEditScope(block, options = {}) {
  return requestTaskEditScope(block, options);
}

async function requestFixedEditScope(block, options = {}) {
  const rule = block?.id ? getFixedRuleById(block.id) : null;
  if (!rule) return "single_day";
  if (!isRepeatableFixedRule(rule)) return "all_repeating";
  const count = countFixedOccurrencesInCurrentWeek(block.id);

  const result = await openTaskScopeModal({
    summary:
      options.summary ||
      (count > 1
        ? `${block.title || "这个定时事项"} 在当前周里共有 ${count} 个重复实例。请选择这次调整的应用范围。`
        : `${block.title || "这个定时事项"} 来自重复规则。请选择只改今天，还是把这次改动同步到所有重复项。`),
    singleLabel: options.singleLabel || "只调整这一天",
    followingLabel: "",
    allLabel: options.allLabel || "应用到所有重复项",
  });

  if (result === "all") return "all_repeating";
  if (result === "single") return "single_day";
  return "dismiss";
}

async function resolveFixedEditScope(block, options = {}) {
  return requestFixedEditScope(block, options);
}

function ensureDragHintElement() {
  let el = $("dragHint");
  if (el) return el;

  el = document.createElement("div");
  el.id = "dragHint";
  el.className = "drag-hint hidden";
  document.body.appendChild(el);
  return el;
}

function hideDragHint() {
  const el = $("dragHint");
  if (!el) return;
  el.classList.add("hidden");
}

function showDragHint(message, level, x, y) {
  const el = ensureDragHintElement();
  el.textContent = message;
  el.classList.remove("hidden", "warn", "error");
  if (level === "error") el.classList.add("error");
  else if (level === "warn") el.classList.add("warn");

  const offsetX = 14;
  const offsetY = 20;
  el.style.left = `${x + offsetX}px`;
  el.style.top = `${y + offsetY}px`;

  const rect = el.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - 10;
  const maxTop = window.innerHeight - rect.height - 10;
  el.style.left = `${Math.max(10, Math.min(x + offsetX, maxLeft))}px`;
  el.style.top = `${Math.max(10, Math.min(y + offsetY, maxTop))}px`;
}

function getScheduleForDragSurface(drag) {
  if (drag.surface === "week") {
    return findWeekDayEntry(drag.date)?.result || null;
  }
  return state.lastSchedule || null;
}

function computeDragValidation(drag) {
  const schedule = getScheduleForDragSurface(drag);
  if (!schedule) {
    return { level: "error", message: "未找到对应日程" };
  }

  if (drag.previewEndMin <= drag.previewStartMin) {
    return { level: "error", message: "结束时间必须晚于开始时间" };
  }

  if (drag.previewStartMin < schedule.dayStartMin || drag.previewEndMin > schedule.dayEndMin) {
    return {
      level: "error",
      message: `超出当日日程范围 ${minutesToTime(schedule.dayStartMin)}-${minutesToTime(schedule.dayEndMin)}`,
    };
  }

  const selfBlock = drag.resolveBlock();
  if (!selfBlock) {
    return { level: "error", message: "目标任务不存在" };
  }

  const preview = {
    ...selfBlock,
    startMin: drag.previewStartMin,
    endMin: drag.previewEndMin,
  };
  return computePlacementValidation(schedule, preview, selfBlock.runtimeId);
}

function resolveEditorBlock(surface, date, runtimeId) {
  if (!runtimeId) return null;
  if (surface === "week") return findWeekBlock(date, runtimeId);
  return findBlock(runtimeId);
}

function updateWeekDayAfterLocalChange(date, options = {}) {
  ensureEditableWeekPlan();
  const dayEntry = findWeekDayEntry(date);
  if (!dayEntry || !dayEntry.ok) return;

  dayEntry.result = prepareSchedule(dayEntry.result);
  saveLocalDayOverride(date, dayEntry.result);
  dayEntry.summary = summarizeScheduleResult(dayEntry.result);
  recalculateWeekPlanTotals(state.lastWeekPlan);
  persistPlanState();
  renderWeekPlan(state.lastWeekPlan);

  if (state.lastSchedule?.date === date) {
    setCurrentSchedule(dayEntry.result, {
      resetCompletion: false,
      scrollToRuntimeId: options.scrollToRuntimeId || null,
      scrollToFirstBlock: false,
    });
  }
}

async function applyFixedRuleEditById(fixedId, patch, focusDate, options = {}) {
  const undoSnapshot = options.undoSnapshot || captureScheduleUndoSnapshot();
  const index = state.fixedEvents.findIndex((item) => item.id === fixedId);
  if (index < 0) {
    throw new Error("定时事项规则不存在");
  }

  const previousEvent = cloneData(state.fixedEvents[index]);
  const previousSchedule = state.lastSchedule ? cloneData(state.lastSchedule) : null;
  const previousWeekPlan = state.lastWeekPlan ? cloneData(state.lastWeekPlan) : null;
  const previousCompleted = cloneData(state.completed);
  const targetDate = focusDate || $("planDate").value || todayInputValue();
  const changedDates = [...new Set(findFixedOccurrencesInCurrentWeek(fixedId).map((occurrence) => occurrence.date))];
  if (changedDates.length === 0) {
    changedDates.push(targetDate);
  }

  state.fixedEvents[index] = {
    ...state.fixedEvents[index],
    ...patch,
    start: patch.start || state.fixedEvents[index].start,
    end: patch.end || state.fixedEvents[index].end,
    bufferMin: clampInt(patch.bufferMin ?? state.fixedEvents[index].bufferMin ?? 0, 0, 0, 180),
  };

  persistData();
  renderLists();

  try {
    await refreshAfterFixedRuleChange(targetDate);
    registerScheduleUndo(undoSnapshot, {
      changedDates,
      label: "已更新重复定时事项",
    });
  } catch (error) {
    state.fixedEvents[index] = previousEvent;
    state.lastWeekPlan = previousWeekPlan;
    persistPlanState();
    state.completed = previousCompleted;
    persistData();
    renderLists();

    if (previousWeekPlan) renderWeekPlan(previousWeekPlan);
    else clearWeekPlan();

    if (previousSchedule) {
      state.lastSchedule = previousSchedule;
      renderSchedule(previousSchedule);
    } else {
      clearScheduleView();
    }

    throw error;
  }
}

async function applyFixedRuleEditFromBlock(runtimeId, patch) {
  const block = findBlock(runtimeId);
  if (!block || block.type !== "fixed") {
    throw new Error("未找到对应定时事项");
  }

  await applyFixedRuleEditById(block.id, patch, state.lastSchedule?.date || $("planDate").value || todayInputValue());
}

function removeTaskBlock(runtimeId, options = {}) {
  const surface = options.surface || "day";
  const date = options.date || state.lastSchedule?.date || $("planDate").value || todayInputValue();
  const undoSnapshot = options.undoSnapshot || captureScheduleUndoSnapshot();
  if (surface === "week") {
    const dayEntry = findWeekDayEntry(date);
    if (!dayEntry?.ok) return;
    dayEntry.result.blocks = dayEntry.result.blocks.filter((block) => block.runtimeId !== runtimeId);
    delete state.completed[runtimeId];
    persistData();
    updateWeekDayAfterLocalChange(date);
    registerScheduleUndo(undoSnapshot, {
      changedDates: [date],
      label: "已删除任务",
    });
    return;
  }

  if (!state.lastSchedule) return;
  state.lastSchedule.blocks = state.lastSchedule.blocks.filter((block) => block.runtimeId !== runtimeId);
  delete state.completed[runtimeId];
  saveLocalDayOverride(state.lastSchedule.date, state.lastSchedule);
  persistData();
  persistPlanState();
  renderSchedule(state.lastSchedule);
  syncCurrentScheduleToWeekPlan();
  registerScheduleUndo(undoSnapshot, {
    changedDates: [state.lastSchedule.date],
    label: "已删除任务",
  });
}

function openBlockContextMenu(runtimeId, x, y) {
  const block = findBlock(runtimeId);
  if (!block) return;

  const items = [];
  if (block.type === "task") {
    items.push({ action: "edit-event", label: "快速编辑", runtimeId, surface: "day" });
    items.push({
      action: "toggle-complete",
      label: state.completed[runtimeId] ? "标记未完成" : "标记完成",
      runtimeId,
      surface: "day",
    });
    items.push({ action: "delete-task", label: "删除任务", runtimeId, surface: "day", danger: true });
  } else if (block.type === "fixed") {
    items.push({ action: "edit-event", label: "编辑定时事项", runtimeId, surface: "day" });
  }

  items.push({ action: "open-settings", label: "日历设置" });
  openContextMenu({ x, y, items });
}

function openGridContextMenu(startMin, x, y) {
  openContextMenu({
    x,
    y,
    items: [
      { action: "create-task", label: `在 ${minutesToTime(startMin)} 新建事项`, startMin, surface: "day" },
      { action: "open-settings", label: "日历设置" },
    ],
  });
}

function openEventEditor(config = {}) {
  const surface = config.surface || "day";
  const date = config.date || state.lastSchedule?.date || $("planDate").value || todayInputValue();
  const runtimeId = config.runtimeId || null;
  const block = resolveEditorBlock(surface, date, runtimeId);
  const blockType = config.blockType || block?.type || "task";
  const mode = config.mode || (block ? "edit" : "create");
  const taskRule = block?.id ? getTaskRuleById(block.id) : null;
  const fixedRule = block?.id ? getFixedRuleById(block.id) : null;
  const defaultStart = roundToStep(config.startMin ?? block?.startMin ?? FULL_DAY_START_MIN, getSnapMinutes(), "nearest");
  const defaultEnd = Math.min(
    FULL_DAY_END_MIN,
    block?.endMin ?? defaultStart + Math.max(30, getSnapMinutes())
  );

  $("eventBlockId").value = runtimeId || "";
  $("eventMode").value = mode;
  $("eventBlockType").value = blockType;
  $("eventTitle").value = block?.title || "";
  $("eventStart").value = formatTimeForInput(defaultStart);
  $("eventEnd").value = formatTimeForInput(Math.max(defaultStart + 5, defaultEnd));
  $("eventCategory").value = block?.category || taskRule?.category || "other";
  $("eventEnergy").value = block?.energy || taskRule?.energy || "medium";
  $("eventPriority").value = String(block?.priority ?? taskRule?.priority ?? 3);
  $("eventBuffer").value = String(block?.bufferMin ?? fixedRule?.bufferMin ?? 0);
  $("eventRecurringEnabled").checked = false;
  $("eventRecurrenceMode").value = "forever";
  $("eventRecurrenceCount").value = "8";
  $("eventRecurrenceUntil").value = addDaysIso(date, 28);
  setSelectedWeekdays("data-weekday-event", getDefaultRepeatWeekdays(date));

  $("eventModalTitle").textContent =
    mode === "create" ? "新建事项" : blockType === "fixed" ? "编辑定时事项" : "快速编辑任务";
  $("eventModalHint").textContent =
    blockType === "fixed"
      ? surface === "week"
        ? "会回写定时事项规则，并重算本周日程与所选日期。"
        : "会回写定时事项规则，并重新生成所选日期日程。"
      : surface === "week"
        ? mode === "create"
          ? "默认会把事项加入这一天。开启重复后，会改为创建定时事项规则并自动同步周/日视图。"
          : "周视图中的改动只影响当前这一天，并同步更新当日日历。"
        : mode === "create"
          ? "默认只加入当前这一天。开启重复后，会创建定时事项规则并自动同步周/日视图。"
          : "任务块调整只影响当前加载的这一天。";

  state.ui.editor = { mode, runtimeId, blockType, surface, date };
  syncEventModalView();
  $("btnDeleteEvent").classList.toggle("hidden", !(blockType === "task" && mode === "edit"));
  $("eventModal").classList.remove("hidden");
  hideContextMenu();

  window.setTimeout(() => {
    $("eventTitle").focus();
    $("eventTitle").select();
  }, 0);
}

function readEventFormPayload() {
  const title = $("eventTitle").value.trim();
  const startMin = parseTimeToMinutes($("eventStart").value);
  const endMin = parseTimeToMinutes($("eventEnd").value);
  const blockType = $("eventBlockType").value;

  if (!title) throw new Error("标题不能为空");
  if (startMin == null || endMin == null) throw new Error("开始或结束时间无效");
  if (endMin <= startMin) throw new Error("结束时间必须晚于开始时间");
  if (startMin < FULL_DAY_START_MIN || endMin > FULL_DAY_END_MIN) {
    throw new Error(`时间必须在 ${FULL_DAY_START}-${FULL_DAY_END} 范围内`);
  }

  const editor = state.ui.editor || {
    mode: $("eventMode").value || "edit",
    date: getEventEditorDate(),
  };
  const recurrenceEnabled =
    editor.mode === "create" && blockType === "task" && Boolean($("eventRecurringEnabled")?.checked);
  const repeatWeekdays = recurrenceEnabled
    ? normalizeWeekdays([
        ...(getSelectedWeekdays("data-weekday-event") || []),
        ...(getDefaultRepeatWeekdays(editor.date) || []),
      ])
    : null;
  const repeatMode = $("eventRecurrenceMode")?.value || "forever";
  const recurrence =
    recurrenceEnabled
      ? {
          enabled: true,
          mode: repeatMode,
          daysOfWeek: repeatWeekdays,
          assignedDates:
            repeatMode === "forever"
              ? null
              : buildFiniteRepeatDates(
                  editor.date,
                  repeatWeekdays,
                  repeatMode,
                  $("eventRecurrenceCount")?.value || "1",
                  $("eventRecurrenceUntil")?.value || editor.date
                ),
        }
      : { enabled: false, mode: "single", daysOfWeek: null, assignedDates: null };

  return {
    title,
    startMin,
    endMin,
    category: $("eventCategory").value,
    energy: $("eventEnergy").value,
    priority: clampInt($("eventPriority").value || "3", 3, 1, 5),
    bufferMin: clampInt($("eventBuffer").value || "0", 0, 0, 180),
    blockType,
    recurrence,
  };
}

function beginDragSession(pointerEvent, eventEl, block, config) {
  const scrollEl = config.scrollEl || null;
  state.ui.drag = {
    pointerId: pointerEvent.pointerId,
    runtimeId: config.runtimeId,
    mode: config.mode,
    surface: config.surface,
    date: config.date || null,
    originalStartMin: block.startMin,
    originalEndMin: block.endMin,
    previewStartMin: block.startMin,
    previewEndMin: block.endMin,
    startClientY: pointerEvent.clientY,
    startScrollTop: scrollEl ? scrollEl.scrollTop : 0,
    scrollEl,
    element: eventEl,
    timeEl: config.timeEl || null,
    pixelsPerMinute: config.pixelsPerMinute,
    rangeStartMin: config.rangeStartMin,
    rangeEndMin: config.rangeEndMin,
    offsetTopPx: config.offsetTopPx || 0,
    minVisualHeight: config.minVisualHeight,
    resolveBlock: config.resolveBlock,
    rerender: config.rerender,
    commit: config.commit,
    validation: { level: "ok", message: "" },
  };

  eventEl.classList.add("dragging");
  try {
    eventEl.setPointerCapture(pointerEvent.pointerId);
  } catch {
    // no-op
  }

  pointerEvent.preventDefault();
  hideContextMenu();
  document.addEventListener("pointermove", handleGlobalPointerMove);
  document.addEventListener("pointerup", handleGlobalPointerUp);
  document.addEventListener("pointercancel", handleGlobalPointerUp);
}

function applyDragPreview(drag) {
  if (!drag.element) return;

  const top = drag.offsetTopPx + (drag.previewStartMin - drag.rangeStartMin) * drag.pixelsPerMinute;
  const height = Math.max(drag.minVisualHeight, (drag.previewEndMin - drag.previewStartMin) * drag.pixelsPerMinute);

  drag.element.style.top = `${top}px`;
  drag.element.style.height = `${height}px`;
  drag.element.classList.toggle("compact", height < (drag.surface === "week" ? 52 : 72));
  if (drag.timeEl) {
    drag.timeEl.textContent = `${minutesToTime(drag.previewStartMin)} - ${minutesToTime(drag.previewEndMin)}`;
  }

  drag.element.classList.toggle("drag-invalid", drag.validation.level === "error");
  drag.element.classList.toggle("drag-warning", drag.validation.level === "warn");
  drag.element.classList.toggle("drag-ok", drag.validation.level === "ok");
}

function beginDrag(pointerEvent, eventEl, mode) {
  const runtimeId = eventEl.dataset.runtimeId;
  const block = findBlock(runtimeId);
  if (!block || !state.lastSchedule) return;

  beginDragSession(pointerEvent, eventEl, block, {
    runtimeId,
    mode,
    surface: "day",
    pixelsPerMinute: getDayPixelsPerMinute(),
    rangeStartMin: FULL_DAY_START_MIN,
    rangeEndMin: FULL_DAY_END_MIN,
    offsetTopPx: DAY_CALENDAR_TOP_GUTTER,
    minVisualHeight: 28,
    scrollEl: getWorkspaceScrollContainer(),
    timeEl: eventEl.querySelector("[data-role='time']"),
    resolveBlock: () => findBlock(runtimeId),
    rerender: () => renderSchedule(state.lastSchedule),
    commit: async (drag, targetBlock) => {
      if (targetBlock.type === "fixed") {
        applyFixedPayloadToSingleDay(drag.runtimeId, {
          title: targetBlock.title,
          startMin: drag.previewStartMin,
          endMin: drag.previewEndMin,
          bufferMin: targetBlock.bufferMin,
        }, {
          surface: "day",
          date: state.lastSchedule?.date || $("planDate").value || todayInputValue(),
        });
        return;
      }

      applyTaskPayloadToSingleDay(drag.runtimeId, {
        title: targetBlock.title,
        category: targetBlock.category,
        energy: targetBlock.energy,
        priority: targetBlock.priority,
        startMin: drag.previewStartMin,
        endMin: drag.previewEndMin,
      }, {
        surface: "day",
        date: state.lastSchedule?.date || $("planDate").value || todayInputValue(),
      });
    },
  });
}

function beginWeekDrag(pointerEvent, eventEl, mode) {
  const runtimeId = eventEl.dataset.runtimeId;
  const date = eventEl.dataset.weekDate;
  const block = findWeekBlock(date, runtimeId);
  if (!block) return;

  beginDragSession(pointerEvent, eventEl, block, {
    runtimeId,
    mode,
    date,
    surface: "week",
    pixelsPerMinute: getWeekPixelsPerMinute(),
    rangeStartMin: FULL_DAY_START_MIN,
    rangeEndMin: FULL_DAY_END_MIN,
    offsetTopPx: 0,
    minVisualHeight: 22,
    scrollEl: getWorkspaceScrollContainer(),
    timeEl: eventEl.querySelector(".week-preview-time"),
    resolveBlock: () => findWeekBlock(date, runtimeId),
    rerender: () => renderWeekPlan(state.lastWeekPlan),
    commit: async (drag, targetBlock) => {
      if (targetBlock.type === "fixed") {
        applyFixedPayloadToSingleDay(drag.runtimeId, {
          title: targetBlock.title,
          startMin: drag.previewStartMin,
          endMin: drag.previewEndMin,
          bufferMin: targetBlock.bufferMin,
        }, {
          surface: "week",
          date,
        });
        return;
      }

      applyTaskPayloadToSingleDay(drag.runtimeId, {
        title: targetBlock.title,
        category: targetBlock.category,
        energy: targetBlock.energy,
        priority: targetBlock.priority,
        startMin: drag.previewStartMin,
        endMin: drag.previewEndMin,
      }, {
        surface: "week",
        date,
      });
    },
  });
}

function handleGlobalPointerMove(event) {
  const drag = state.ui.drag;
  if (!drag || event.pointerId !== drag.pointerId) return;

  maybeAutoScroll(drag.scrollEl, event.clientY);

  const duration = drag.originalEndMin - drag.originalStartMin;
  const minDuration = Math.max(10, getSnapMinutes());
  const scrollDelta = (drag.scrollEl ? drag.scrollEl.scrollTop : 0) - drag.startScrollTop;
  const deltaMin = roundToStep(
    (event.clientY - drag.startClientY + scrollDelta) / drag.pixelsPerMinute,
    getSnapMinutes(),
    "nearest"
  );

  let nextStart = drag.originalStartMin;
  let nextEnd = drag.originalEndMin;

  if (drag.mode === "move") {
    nextStart = roundToStep(drag.originalStartMin + deltaMin, getSnapMinutes(), "nearest");
    nextStart = Math.max(drag.rangeStartMin, Math.min(nextStart, drag.rangeEndMin - duration));
    nextEnd = nextStart + duration;
  } else if (drag.mode === "start") {
    nextStart = roundToStep(drag.originalStartMin + deltaMin, getSnapMinutes(), "nearest");
    nextStart = Math.max(drag.rangeStartMin, Math.min(nextStart, drag.originalEndMin - minDuration));
    nextEnd = drag.originalEndMin;
  } else {
    nextEnd = roundToStep(drag.originalEndMin + deltaMin, getSnapMinutes(), "nearest");
    nextEnd = Math.min(drag.rangeEndMin, Math.max(nextEnd, drag.originalStartMin + minDuration));
    nextStart = drag.originalStartMin;
  }

  drag.previewStartMin = nextStart;
  drag.previewEndMin = nextEnd;
  drag.validation = computeDragValidation(drag);
  applyDragPreview(drag);

  if (drag.validation.level === "error") {
    const prefix =
      Array.isArray(drag.validation.issues) && drag.validation.issues.length > 0 ? "冲突" : "非法时间";
    showDragHint(`${prefix}: ${drag.validation.message}`, "error", event.clientX, event.clientY);
  } else if (drag.validation.level === "warn") {
    showDragHint(`提示: ${drag.validation.message}`, "warn", event.clientX, event.clientY);
  } else {
    showDragHint(
      `${minutesToTime(nextStart)}-${minutesToTime(nextEnd)} | 吸附 ${getSnapMinutes()} 分钟`,
      "ok",
      event.clientX,
      event.clientY
    );
  }
}

async function handleGlobalPointerUp(event) {
  const drag = state.ui.drag;
  if (!drag || event.pointerId !== drag.pointerId) return;

  cleanupDragListeners();
  state.ui.drag = null;
  hideDragHint();

  try {
    drag.element.releasePointerCapture?.(drag.pointerId);
  } catch {
    // no-op
  }

  const targetBlock = drag.resolveBlock();
  if (!targetBlock) {
    drag.rerender();
    return;
  }

  const changed =
    drag.previewStartMin !== drag.originalStartMin || drag.previewEndMin !== drag.originalEndMin;

  if (!changed) {
    drag.rerender();
    return;
  }

  let scope = "single_day";
  if (targetBlock.type === "task") {
    scope = await resolveTaskEditScope(targetBlock, {
      summary: `${targetBlock.title || "这个任务"} 是重复任务。请选择这次拖拽调整的应用范围。`,
      focusDate: drag.date || state.lastSchedule?.date || $("planDate").value || todayInputValue(),
      singleLabel: "只调整这一天",
      followingLabel: "只调整此日期后的重复任务",
      allLabel: "应用到所有重复任务",
    });
    if (scope === "dismiss") {
      drag.rerender();
      return;
    }
  } else if (targetBlock.type === "fixed") {
    scope = await resolveFixedEditScope(targetBlock, {
      summary: `${targetBlock.title || "这个定时事项"} 是重复事项。请选择这次拖拽调整的应用范围。`,
      singleLabel: "只调整这一天",
      allLabel: "应用到所有重复项",
    });
    if (scope === "dismiss") {
      drag.rerender();
      return;
    }
  }

  const validation =
    scope === "all_repeating" || scope === "following_repeating"
      ? targetBlock.type === "task"
        ? computeRepeatingTaskValidation(targetBlock.id, {
            title: targetBlock.title,
            category: targetBlock.category,
            energy: targetBlock.energy,
            priority: targetBlock.priority,
            startMin: drag.previewStartMin,
            endMin: drag.previewEndMin,
          }, {
            scope,
            focusDate: drag.date || state.lastSchedule?.date || $("planDate").value || todayInputValue(),
          })
        : computeRepeatingFixedValidation(targetBlock.id, {
            title: targetBlock.title,
            startMin: drag.previewStartMin,
            endMin: drag.previewEndMin,
            bufferMin: targetBlock.bufferMin,
          })
      : computeDragValidation(drag);
  if (validation.level !== "ok") {
    if (!Array.isArray(validation.issues) || validation.issues.length === 0) {
      alert(`无法保存拖拽结果：${validation.message}`);
      drag.rerender();
      return;
    }

    const confirmed = await requestPlacementConfirmation(validation, {
      title: "检测到时间冲突",
      summary: "这次拖拽会带来以下影响：",
      confirmLabel: "仍然应用",
      editLabel: "继续调整",
    });
    if (!confirmed) {
      drag.rerender();
      return;
    }
  }

  try {
    if (scope === "all_repeating" && targetBlock.type === "task") {
      applyTaskPayloadToAllRepeatingOccurrences(
        targetBlock.id,
        {
          title: targetBlock.title,
          category: targetBlock.category,
          energy: targetBlock.energy,
          priority: targetBlock.priority,
          startMin: drag.previewStartMin,
          endMin: drag.previewEndMin,
        },
        {
          focusDate: drag.date || state.lastSchedule?.date || $("planDate").value || todayInputValue(),
        }
      );
      return;
    }

    if (scope === "following_repeating" && targetBlock.type === "task") {
      applyTaskPayloadToFollowingRepeatingOccurrences(
        targetBlock.id,
        {
          title: targetBlock.title,
          category: targetBlock.category,
          energy: targetBlock.energy,
          priority: targetBlock.priority,
          startMin: drag.previewStartMin,
          endMin: drag.previewEndMin,
        },
        {
          focusDate: drag.date || state.lastSchedule?.date || $("planDate").value || todayInputValue(),
        }
      );
      return;
    }

    if (scope === "all_repeating" && targetBlock.type === "fixed") {
      await applyFixedRuleEditById(
        targetBlock.id,
        {
          title: targetBlock.title,
          start: minutesToTime(drag.previewStartMin),
          end: minutesToTime(drag.previewEndMin),
          bufferMin: targetBlock.bufferMin,
        },
        drag.date || state.lastSchedule?.date || $("planDate").value || todayInputValue()
      );
      return;
    }

    await drag.commit(drag, targetBlock);
  } catch (error) {
    alert(error.message);
    drag.rerender();
  }
}

function computeEventEditorValidation(editor, payload) {
  const schedule = editor.surface === "week" ? findWeekDayEntry(editor.date)?.result || null : state.lastSchedule;
  if (!schedule) {
    return { level: "ok", message: "", issues: [] };
  }

  const existingBlock =
    editor.mode === "edit" ? resolveEditorBlock(editor.surface, editor.date, editor.runtimeId) : null;
  if (payload.blockType === "fixed") {
    return computePlacementValidation(
      schedule,
      {
        ...(existingBlock || {}),
        id: existingBlock?.id || null,
        type: "fixed",
        title: payload.title,
        startMin: payload.startMin,
        endMin: payload.endMin,
        bufferMin: payload.bufferMin,
      },
      existingBlock?.runtimeId || null
    );
  }

  return computePlacementValidation(
    schedule,
    {
      runtimeId: existingBlock?.runtimeId || "__draft__",
      type: "task",
      title: payload.title,
      startMin: payload.startMin,
      endMin: payload.endMin,
    },
    existingBlock?.runtimeId || null
  );
}

function computeRepeatingTaskValidation(taskId, payload, options = {}) {
  const focusDate = parseIsoDate(options.focusDate) ? options.focusDate : null;
  const occurrences =
    options.scope === "following_repeating" && focusDate
      ? findTaskOccurrencesInCurrentWeekFromDate(taskId, focusDate)
      : findTaskOccurrencesInCurrentWeek(taskId);
  const issues = [];
  for (const occurrence of occurrences) {
    const validation = computePlacementValidation(
      occurrence.dayEntry.result,
      {
        ...occurrence.block,
        title: payload.title,
        startMin: payload.startMin,
        endMin: payload.endMin,
      },
      occurrence.block.runtimeId
    );

    for (const issue of validation.issues || []) {
      issues.push({
        level: issue.level,
        message: `${occurrence.dateLabel}: ${issue.message}`,
      });
    }
  }

  if (
    occurrences.length === 0 &&
    state.lastSchedule?.blocks?.some(
      (block) => block.type === "task" && block.id === taskId && (!focusDate || state.lastSchedule.date >= focusDate)
    )
  ) {
    const dateLabel = state.lastSchedule.dateLabel || formatScheduleDateLabel(state.lastSchedule.date);
    const matchingBlocks = state.lastSchedule.blocks.filter(
      (block) => block.type === "task" && block.id === taskId && (!focusDate || state.lastSchedule.date >= focusDate)
    );
    for (const block of matchingBlocks) {
      const validation = computePlacementValidation(
        state.lastSchedule,
        {
          ...block,
          title: payload.title,
          startMin: payload.startMin,
          endMin: payload.endMin,
        },
        block.runtimeId
      );
      for (const issue of validation.issues || []) {
        issues.push({
          level: issue.level,
          message: `${dateLabel}: ${issue.message}`,
        });
      }
    }
  }

  return summarizePlacementValidation(issues);
}

function computeRepeatingFixedValidation(fixedId, payload) {
  const occurrences = findFixedOccurrencesInCurrentWeek(fixedId);
  const issues = [];
  for (const occurrence of occurrences) {
    const validation = computePlacementValidation(
      occurrence.dayEntry.result,
      {
        ...occurrence.block,
        id: fixedId,
        title: payload.title,
        startMin: payload.startMin,
        endMin: payload.endMin,
        bufferMin: payload.bufferMin,
      },
      occurrence.block.runtimeId
    );

    for (const issue of validation.issues || []) {
      issues.push({
        level: issue.level,
        message: `${occurrence.dateLabel}: ${issue.message}`,
      });
    }
  }

  if (occurrences.length === 0 && state.lastSchedule?.blocks?.some((block) => block.type === "fixed" && block.id === fixedId)) {
    const dateLabel = state.lastSchedule.dateLabel || formatScheduleDateLabel(state.lastSchedule.date);
    const matchingBlocks = state.lastSchedule.blocks.filter((block) => block.type === "fixed" && block.id === fixedId);
    for (const block of matchingBlocks) {
      const validation = computePlacementValidation(
        state.lastSchedule,
        {
          ...block,
          id: fixedId,
          title: payload.title,
          startMin: payload.startMin,
          endMin: payload.endMin,
          bufferMin: payload.bufferMin,
        },
        block.runtimeId
      );
      for (const issue of validation.issues || []) {
        issues.push({
          level: issue.level,
          message: `${dateLabel}: ${issue.message}`,
        });
      }
    }
  }

  return summarizePlacementValidation(issues);
}

function saveEventEditorForSurface(editor, payload) {
  if (editor.surface !== "week") return false;

  if (editor.mode === "create") {
    createTaskBlockOnSurface(payload, {
      surface: "week",
      date: editor.date,
    });
    return true;
  }

  applyTaskPayloadToSingleDay(editor.runtimeId, payload, {
    surface: "week",
    date: editor.date,
  });
  return true;
}

async function saveEventEditor(event) {
  event.preventDefault();

  try {
    const payload = readEventFormPayload();
    const editor = state.ui.editor || {
      mode: $("eventMode").value || "edit",
      runtimeId: $("eventBlockId").value || null,
      blockType: $("eventBlockType").value || "task",
      surface: "day",
      date: state.lastSchedule?.date || $("planDate").value || todayInputValue(),
    };
    const editableBlock = editor.mode === "edit" ? resolveEditorBlock(editor.surface, editor.date, editor.runtimeId) : null;
    const currentTaskBlock = payload.blockType === "task" ? editableBlock : null;
    const currentFixedBlock = payload.blockType === "fixed" ? editableBlock : null;

    if (editor.mode === "create" && payload.blockType === "task" && payload.recurrence?.enabled) {
      const nextRule = {
        title: payload.title,
        start: minutesToTime(payload.startMin),
        end: minutesToTime(payload.endMin),
        bufferMin: 0,
        daysOfWeek: payload.recurrence.mode === "forever" ? payload.recurrence.daysOfWeek : null,
        assignedDates: payload.recurrence.mode === "forever" ? null : payload.recurrence.assignedDates,
      };
      await createFixedRule(nextRule, { focusDate: editor.date });
      closeEventEditor();
      return;
    }

    if (payload.blockType === "fixed") {
      if (!currentFixedBlock || currentFixedBlock.type !== "fixed") {
        throw new Error("定时事项不存在");
      }

      let scope = "single_day";
      scope = await resolveFixedEditScope(currentFixedBlock, {
        summary: `${currentFixedBlock.title || "这个定时事项"} 是重复事项。请选择这次编辑的应用范围。`,
        singleLabel: "只调整这一天",
        allLabel: "应用到所有重复项",
      });
      if (scope === "dismiss") return;

      const validation =
        scope === "all_repeating" && currentFixedBlock.id
          ? computeRepeatingFixedValidation(currentFixedBlock.id, payload)
          : computeEventEditorValidation(editor, payload);
      if (validation.level !== "ok") {
        const confirmed = await requestPlacementConfirmation(validation, {
          title: "检测到时间冲突",
          summary: "保存后会带来以下影响：",
          confirmLabel: "仍然保存",
          editLabel: "继续修改",
        });
        if (!confirmed) return;
      }

      if (scope === "all_repeating") {
        await applyFixedRuleEditById(
          currentFixedBlock.id,
          {
            title: payload.title,
            start: minutesToTime(payload.startMin),
            end: minutesToTime(payload.endMin),
            bufferMin: payload.bufferMin,
          },
          editor.date
        );
      } else {
        applyFixedPayloadToSingleDay(editor.runtimeId, payload, {
          surface: editor.surface,
          date: editor.date,
        });
      }

      closeEventEditor();
      return;
    }

    let scope = "single_day";
    if (currentTaskBlock?.type === "task") {
      scope = await resolveTaskEditScope(currentTaskBlock, {
        summary: `${currentTaskBlock.title || "这个任务"} 是重复任务。请选择这次编辑的应用范围。`,
        focusDate: editor.date,
        singleLabel: "只调整这一天",
        followingLabel: "只调整此日期后的重复任务",
        allLabel: "应用到所有重复任务",
      });
      if (scope === "dismiss") return;
    }

    const validation =
      (scope === "all_repeating" || scope === "following_repeating") && currentTaskBlock?.id
        ? computeRepeatingTaskValidation(currentTaskBlock.id, payload, {
            scope,
            focusDate: editor.date,
          })
        : computeEventEditorValidation(editor, payload);
    if (validation.level !== "ok") {
      const confirmed = await requestPlacementConfirmation(validation, {
        title: "检测到时间冲突",
        summary: "保存后会带来以下影响：",
        confirmLabel: "仍然保存",
        editLabel: "继续修改",
      });
      if (!confirmed) return;
    }

    if (scope === "all_repeating" && currentTaskBlock?.id) {
      applyTaskPayloadToAllRepeatingOccurrences(currentTaskBlock.id, payload, {
        focusDate: editor.date,
      });
      closeEventEditor();
      return;
    }

    if (scope === "following_repeating" && currentTaskBlock?.id) {
      applyTaskPayloadToFollowingRepeatingOccurrences(currentTaskBlock.id, payload, {
        focusDate: editor.date,
      });
      closeEventEditor();
      return;
    }

    if (saveEventEditorForSurface(editor, payload)) {
      closeEventEditor();
      return;
    }

    if (editor.mode === "create") {
      createTaskBlockOnSurface(payload, {
        surface: editor.surface,
        date: editor.date,
      });
      closeEventEditor();
      return;
    }

    if (!state.lastSchedule) {
      throw new Error("当前日程为空，请先创建任务块");
    }

    applyTaskPayloadToSingleDay(editor.runtimeId, payload, {
      surface: editor.surface,
      date: editor.date,
    });
    closeEventEditor();
  } catch (error) {
    alert(error.message);
  }
}

function deleteCurrentEventBlock() {
  const editor = state.ui.editor || {};
  if (!editor.runtimeId) return;
  removeTaskBlock(editor.runtimeId, { surface: editor.surface || "day", date: editor.date });
  closeEventEditor();
}

function hookScheduleInteractions() {
  const schedule = $("schedule");

  schedule.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionTarget = target.closest("[data-action]");
    if (!actionTarget) return;

    const action = actionTarget.getAttribute("data-action");
    if (action === "toggle-complete") {
      event.stopPropagation();
      toggleTaskComplete(actionTarget.getAttribute("data-runtime-id"));
    }
  });

  schedule.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const eventEl = target.closest(".calendar-event[data-editable='1']");
    if (!eventEl) return;
    openEventEditor({ mode: "edit", runtimeId: eventEl.dataset.runtimeId, surface: "day" });
  });

  schedule.addEventListener("contextmenu", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const eventEl = target.closest(".calendar-event");
    if (eventEl) {
      event.preventDefault();
      openBlockContextMenu(eventEl.dataset.runtimeId, event.clientX, event.clientY);
      return;
    }

    const gridEl = target.closest(".calendar-grid");
    if (!gridEl) return;

    event.preventDefault();
    const startMin = scheduleMinuteFromPoint(event.clientY, gridEl);
    if (startMin != null) {
      openGridContextMenu(startMin, event.clientX, event.clientY);
    }
  });

  schedule.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-action='toggle-complete']")) return;

    const eventEl = target.closest(".calendar-event[data-editable='1']");
    if (!eventEl) return;

    const handle = target.closest(".event-resize");
    const mode = handle?.getAttribute("data-resize") || "move";
    beginDrag(event, eventEl, mode);
  });
}

function hookWeekInteractions() {
  const weekPlan = $("weekPlan");

  weekPlan.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const eventEl = target.closest(".week-preview-event[data-editable='1']");
    if (!eventEl) return;
    openEventEditor({
      mode: "edit",
      runtimeId: eventEl.dataset.runtimeId,
      surface: "week",
      date: eventEl.dataset.weekDate,
    });
  });

  weekPlan.addEventListener("contextmenu", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const eventEl = target.closest(".week-preview-event");
    if (eventEl) {
      event.preventDefault();
      openWeekBlockContextMenu(eventEl.dataset.weekDate, eventEl.dataset.runtimeId, event.clientX, event.clientY);
      return;
    }

    const column = target.closest(".week-day-column");
    if (!column || !column.dataset.weekDate) return;

    event.preventDefault();
    const startMin = weekMinuteFromPoint(event.clientY, column);
    openWeekGridContextMenu(column.dataset.weekDate, startMin, event.clientX, event.clientY);
  });

  weekPlan.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const eventEl = target.closest(".week-preview-event[data-editable='1']");
    if (!eventEl) return;

    const handle = target.closest(".week-event-resize");
    const mode = handle?.getAttribute("data-resize") || "move";
    beginWeekDrag(event, eventEl, mode);
  });
}

function hookScheduleZoomShortcuts() {
  const scheduleView = $("viewSchedule");
  if (!scheduleView) return;

  scheduleView.addEventListener(
    "wheel",
    (event) => {
      if (state.ui.activeView !== "schedule") return;
      if (event.ctrlKey) {
        event.preventDefault();

        const direction = event.deltaY < 0 ? 1 : -1;
        adjustScheduleZoom(state.ui.scheduleMode === "week" ? "week" : "day", direction);
        return;
      }

      if (!event.altKey || state.ui.scheduleMode !== "week") return;
      const weekFrame =
        (event.target instanceof HTMLElement && event.target.closest("#scheduleWeekPanel")?.querySelector(".schedule-visual-frame")) ||
        document.querySelector("#scheduleWeekPanel .schedule-visual-frame");
      if (!(weekFrame instanceof HTMLElement)) return;

      event.preventDefault();
      weekFrame.scrollLeft += event.deltaY + event.deltaX;
    },
    { passive: false }
  );
}

function hookContextMenuActions() {
  $("contextMenu").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button[data-action]");
    if (!button) return;

    const action = button.getAttribute("data-action");
    const runtimeId = button.getAttribute("data-runtime-id");
    const startMin = Number.parseInt(button.getAttribute("data-start-min") || "", 10);
    const date = button.getAttribute("data-date") || "";
    const surface = button.getAttribute("data-surface") || "day";
    hideContextMenu();

    if (action === "edit-event" && runtimeId) {
      openEventEditor({ mode: "edit", runtimeId, surface, date });
      return;
    }

    if (action === "toggle-complete" && runtimeId) {
      toggleTaskComplete(runtimeId);
      return;
    }

    if ((action === "remove-task" || action === "delete-task") && runtimeId) {
      removeTaskBlock(runtimeId, { surface, date });
      return;
    }

    if (action === "create-task" && Number.isFinite(startMin)) {
      openEventEditor({ mode: "create", blockType: "task", startMin, surface, date });
      return;
    }

    if (action === "load-week-day" && date) {
      setScheduleMode("day");
      loadDayFromWeek(date, { resetCompletion: false, scrollToFirstBlock: false });
      return;
    }

    if (action === "open-settings") {
      openCalendarSettings();
    }
  });
}

function renderWeekSummaryCard(container, plan) {
  const summaryCard = document.createElement("div");
  summaryCard.className = "week-day";
  const assignmentLines = (plan.taskAssignments || [])
    .map((task) => {
      const datesText = task.dates.length > 0 ? task.dates.join("、") : "未分配";
      return `<div class="week-line">${escapeHtml(task.title)}: ${escapeHtml(String(task.assignedCount))}/${escapeHtml(
        String(task.desiredCount)
      )} 次 / ${escapeHtml(datesText)}</div>`;
    })
    .join("");
  const warningLines = (plan.assignmentIssues || [])
    .map((issue) => `<div class="week-line">- ${escapeHtml(issue.message || "")}</div>`)
    .join("");

  summaryCard.innerHTML = `
    <div class="week-day-head">
      <div class="week-day-title">本周汇总</div>
      <div class="week-day-meta">${escapeHtml(String(plan.dayCount))} 天</div>
    </div>
    <div class="week-day-stats">
      <span class="tag">可生成 ${escapeHtml(String(plan.totals.okDays || 0))} 天</span>
      <span class="tag">冲突 ${escapeHtml(String(plan.totals.errorDays || 0))} 天</span>
      <span class="tag">任务 ${escapeHtml(String(plan.totals.taskMinutes || 0))} 分钟</span>
      <span class="tag">定时 ${escapeHtml(String(plan.totals.fixedMinutes || 0))} 分钟</span>
      <span class="tag">未排入 ${escapeHtml(String(plan.totals.unscheduledCount || 0))} 项</span>
    </div>
    <div class="week-lines">
      ${assignmentLines || '<div class="week-line">当前没有“每周 N 次”任务。</div>'}
      ${warningLines}
    </div>
  `;
  container.appendChild(summaryCard);
}

function renderWeekPlanGrid(container, plan, selectedDate) {
  const weekPixelsPerMinute = getWeekPixelsPerMinute();
  const previewHeight = Math.max(420, (FULL_DAY_END_MIN - FULL_DAY_START_MIN) * weekPixelsPerMinute);
  const weekShell = document.createElement("div");
  weekShell.className = "week-calendar-shell";

  const header = document.createElement("div");
  header.className = "week-calendar-header";
  header.innerHTML = `<div class="week-calendar-corner">时间</div>`;

  for (const day of plan.days) {
    const headerCell = document.createElement("div");
    const classes = ["week-calendar-day-head"];
    if (day.date === selectedDate) classes.push("selected");
    if (day.date === state.ui.aiFocus?.date) classes.push("ai-focus");
    if (!day.ok) classes.push("error");
    else if ((day.summary?.issueCount || 0) > 0) classes.push("warning");
    headerCell.className = classes.join(" ");
    headerCell.innerHTML = `
      <button class="week-load-button" type="button" data-load-day="${escapeHtml(day.date)}">
        <div class="week-calendar-day-title">${escapeHtml(day.dateLabel)}</div>
        <div class="week-calendar-day-meta">
          ${
            day.ok
              ? `${escapeHtml(String(day.summary?.taskCount || 0))} 项任务 / ${escapeHtml(
                  String(day.summary?.fixedEventCount || 0)
                )} 项定时`
              : "当天存在冲突"
          }
        </div>
      </button>
    `;
    header.appendChild(headerCell);
  }

  const body = document.createElement("div");
  body.className = "week-calendar-body";
  body.style.height = `${previewHeight}px`;

  const timeColumn = document.createElement("div");
  timeColumn.className = "week-time-column";

  for (let minute = FULL_DAY_START_MIN; minute <= FULL_DAY_END_MIN; minute += 30) {
    const top = (minute - FULL_DAY_START_MIN) * weekPixelsPerMinute;
    const label = document.createElement("div");
    label.className = "week-time-label";
    label.style.top = `${top}px`;
    label.textContent = minutesToTime(minute);
    timeColumn.appendChild(label);
  }

  const daysLayer = document.createElement("div");
  daysLayer.className = "week-days-layer";

  for (const day of plan.days) {
    const column = document.createElement("div");
    const columnClasses = ["week-day-column"];
    if (day.date === selectedDate) columnClasses.push("selected");
    if (day.date === state.ui.aiFocus?.date) columnClasses.push("ai-focus");
    if (!day.ok) columnClasses.push("error");
    column.className = columnClasses.join(" ");
    column.dataset.weekDate = day.date;

    for (let minute = FULL_DAY_START_MIN; minute <= FULL_DAY_END_MIN; minute += 30) {
      const top = (minute - FULL_DAY_START_MIN) * weekPixelsPerMinute;
      const line = document.createElement("div");
      line.className = `week-grid-line ${minute % 60 === 0 ? "hour" : ""}`.trim();
      line.style.top = `${top}px`;
      column.appendChild(line);
    }

    if (!day.ok) {
      const errorCard = document.createElement("div");
      errorCard.className = "week-day-error";
      errorCard.innerHTML = `
        <div class="week-day-error-title">无法生成</div>
        <div>${escapeHtml(day.error || "存在冲突")}</div>
      `;
      column.appendChild(errorCard);
      daysLayer.appendChild(column);
      continue;
    }

    const previewBlocks = (day.result?.blocks || []).filter((block) => block.type !== "buffer");
    const layoutMap = computeEventLayout(previewBlocks);

    if (previewBlocks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "week-day-empty";
      empty.textContent = "空白";
      column.appendChild(empty);
    }

    for (const block of previewBlocks) {
      const position = layoutMap.get(block.runtimeId) || { column: 0, columnCount: 1 };
      const top = (block.startMin - FULL_DAY_START_MIN) * weekPixelsPerMinute;
      const height = Math.max(22, (block.endMin - block.startMin) * weekPixelsPerMinute);
      const widthPercent = 100 / position.columnCount;
      const isAiFocused =
        day.date === state.ui.aiFocus?.date &&
        Array.isArray(state.ui.aiFocus?.runtimeIds) &&
        state.ui.aiFocus.runtimeIds.includes(block.runtimeId);
      const eventEl = document.createElement("article");
      eventEl.className = `week-preview-event ${eventClassName(block)}${height < 52 ? " compact" : ""}${
        isAiFocused ? " ai-focus" : ""
      }`;
      eventEl.dataset.weekDate = day.date;
      eventEl.dataset.runtimeId = block.runtimeId;
      eventEl.dataset.blockType = block.type;
      eventEl.dataset.editable = block.editable ? "1" : "0";
      eventEl.style.top = `${top}px`;
      eventEl.style.height = `${height}px`;
      eventEl.style.left = `calc(${position.column * widthPercent}% + 4px)`;
      eventEl.style.width = `calc(${widthPercent}% - 8px)`;
      eventEl.title = `${block.start}-${block.end} ${block.title}`;
      eventEl.innerHTML = `
        <div class="week-preview-time">${escapeHtml(block.start)} - ${escapeHtml(block.end)}</div>
        <div class="week-preview-title">${escapeHtml(block.title)}</div>
      `;

      if (block.editable) {
        const startHandle = document.createElement("div");
        startHandle.className = "week-event-resize start";
        startHandle.dataset.resize = "start";

        const endHandle = document.createElement("div");
        endHandle.className = "week-event-resize end";
        endHandle.dataset.resize = "end";

        eventEl.appendChild(startHandle);
        eventEl.appendChild(endHandle);
      }

      column.appendChild(eventEl);
    }

    if ((day.summary?.unscheduledCount || 0) > 0) {
      const marker = document.createElement("div");
      marker.className = "week-unscheduled-marker";
      marker.textContent = `未排入 ${day.summary.unscheduledCount}`;
      column.appendChild(marker);
    }

    daysLayer.appendChild(column);
  }

  body.appendChild(timeColumn);
  body.appendChild(daysLayer);
  weekShell.appendChild(header);
  weekShell.appendChild(body);
  container.appendChild(weekShell);
}

function renderWeekPlanLanes(container, plan, selectedDate) {
  const lanePixelsPerMinute = 1.15 * state.scheduleViewPrefs.weekZoom;
  const laneWidth = Math.round((FULL_DAY_END_MIN - FULL_DAY_START_MIN) * lanePixelsPerMinute);
  const eventHeight = 42;
  const eventGap = 8;
  const trackPaddingTop = 14;

  const shell = document.createElement("div");
  shell.className = "week-lanes-shell";

  const axisRow = document.createElement("div");
  axisRow.className = "week-lanes-axis-row";

  const axisSide = document.createElement("div");
  axisSide.className = "week-lanes-axis-side";
  axisSide.textContent = "Day / 24h";
  axisRow.appendChild(axisSide);

  const axisTrack = document.createElement("div");
  axisTrack.className = "week-lanes-axis-track";
  axisTrack.style.width = `${laneWidth}px`;

  for (let minute = FULL_DAY_START_MIN; minute <= FULL_DAY_END_MIN; minute += 60) {
    const marker = document.createElement("div");
    marker.className = `week-lanes-axis-hour ${minute % 120 === 0 ? "major" : ""}`.trim();
    marker.style.left = `${minute * lanePixelsPerMinute}px`;
    if (minute < FULL_DAY_END_MIN) {
      const label = document.createElement("div");
      label.className = "week-lanes-axis-label";
      label.textContent = minutesToTime(minute);
      marker.appendChild(label);
    }
    axisTrack.appendChild(marker);
  }

  axisRow.appendChild(axisTrack);
  shell.appendChild(axisRow);

  for (const day of plan.days) {
    const row = document.createElement("div");
    const rowClasses = ["week-lane-row"];
    if (day.date === selectedDate) rowClasses.push("selected");
    if (day.date === state.ui.aiFocus?.date) rowClasses.push("ai-focus");
    if (!day.ok) rowClasses.push("error");
    else if ((day.summary?.issueCount || 0) > 0) rowClasses.push("warning");
    row.className = rowClasses.join(" ");

    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "week-lane-day-button";
    dayButton.setAttribute("data-load-day", day.date);
    dayButton.innerHTML = `
      <div class="week-lane-day-title">${escapeHtml(day.dateLabel)}</div>
      <div class="week-lane-day-meta">
        ${
          day.ok
            ? `${escapeHtml(String(day.summary?.taskCount || 0))} tasks / ${escapeHtml(
                String(day.summary?.fixedEventCount || 0)
              )} timed`
            : "conflict"
        }
      </div>
      <div class="week-lane-day-note">${day.ok ? "Open Day view" : escapeHtml(day.error || "Cannot generate")}</div>
    `;
    row.appendChild(dayButton);

    const track = document.createElement("div");
    track.className = "week-lane-track";
    track.style.width = `${laneWidth}px`;

    if (!day.ok) {
      track.style.height = "96px";
      const errorCard = document.createElement("div");
      errorCard.className = "week-lane-error";
      errorCard.innerHTML = `
        <div class="week-lane-error-title">Conflict</div>
        <div>${escapeHtml(day.error || "存在冲突")}</div>
      `;
      track.appendChild(errorCard);
      row.appendChild(track);
      shell.appendChild(row);
      continue;
    }

    const previewBlocks = (day.result?.blocks || []).filter((block) => block.type !== "buffer");
    const layoutMap = computeEventLayout(previewBlocks);
    const laneCount = Math.max(
      1,
      previewBlocks.reduce((max, block) => Math.max(max, layoutMap.get(block.runtimeId)?.columnCount || 1), 1)
    );
    const trackHeight = Math.max(88, trackPaddingTop * 2 + laneCount * eventHeight + Math.max(0, laneCount - 1) * eventGap);
    track.style.height = `${trackHeight}px`;

    for (let minute = FULL_DAY_START_MIN; minute <= FULL_DAY_END_MIN; minute += 60) {
      const line = document.createElement("div");
      line.className = `week-lane-grid-line ${minute % 120 === 0 ? "major" : ""}`.trim();
      line.style.left = `${minute * lanePixelsPerMinute}px`;
      track.appendChild(line);
    }

    if (previewBlocks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "week-lane-empty";
      empty.textContent = "No scheduled tasks";
      track.appendChild(empty);
    }

    for (const block of previewBlocks) {
      const position = layoutMap.get(block.runtimeId) || { column: 0, columnCount: 1 };
      const isAiFocused =
        day.date === state.ui.aiFocus?.date &&
        Array.isArray(state.ui.aiFocus?.runtimeIds) &&
        state.ui.aiFocus.runtimeIds.includes(block.runtimeId);
      const left = block.startMin * lanePixelsPerMinute;
      const rawWidth = (block.endMin - block.startMin) * lanePixelsPerMinute;
      const width = Math.max(56, Math.min(laneWidth - left - 6, rawWidth - 6));
      const top = trackPaddingTop + position.column * (eventHeight + eventGap);
      const eventEl = document.createElement("button");
      eventEl.type = "button";
      eventEl.className = `week-lane-event ${eventClassName(block)}${width < 120 ? " compact" : ""}${
        isAiFocused ? " ai-focus" : ""
      }`;
      eventEl.setAttribute("data-load-day", day.date);
      eventEl.title = `${block.start}-${block.end} ${block.title}`;
      eventEl.style.left = `${left}px`;
      eventEl.style.top = `${top}px`;
      eventEl.style.width = `${width}px`;
      eventEl.style.height = `${eventHeight}px`;
      eventEl.innerHTML = `
        <div class="week-lane-event-time">${escapeHtml(block.start)} - ${escapeHtml(block.end)}</div>
        <div class="week-lane-event-title">${escapeHtml(block.title)}</div>
        <div class="week-lane-event-meta">${escapeHtml(buildEventMeta(block))}</div>
      `;
      track.appendChild(eventEl);
    }

    if ((day.summary?.unscheduledCount || 0) > 0) {
      const marker = document.createElement("div");
      marker.className = "week-lane-unscheduled";
      marker.textContent = `Unscheduled ${day.summary.unscheduledCount}`;
      track.appendChild(marker);
    }

    row.appendChild(track);
    shell.appendChild(row);
  }

  container.appendChild(shell);
}

function renderWeekPlan(plan) {
  const container = $("weekPlan");
  container.innerHTML = "";
  container.className = "week-plan";
  const displayPlan = getRenderableWeekPlan(plan);

  const selectedDate = $("planDate").value || todayInputValue();
  $("weekRange").textContent = `${displayPlan.startDate} ~ ${displayPlan.endDate}`;
  renderWeekPlanGrid(container, displayPlan, selectedDate);
}

function boot() {
  ensureChatSeed();
  state.ui.scheduleMode = state.workspacePrefs.defaultScheduleMode;
  applyPlannerPrefsToForm();
  updatePlanDateValue($("planDate").value || todayInputValue());
  restorePersistedWorkspace();
  renderLists();
  renderWorkspacePrefsForm();
  renderShellChrome();
  renderScheduleChrome();
  renderChatMessages();
  renderScheduleMode();
  renderDayUtilityPanel();
  renderWeekLayoutMode();
  renderSettingsSection();
  renderRulesMode();
  renderAiFocusBanner();
  updateAiProposalUi();
  hookWorkspaceChrome();
  hookListDeletes();
  hookCommunityLike();
  hookChatAssistant();
  hookAiApplyModal();
  hookDesktopActions();
  hookContextMenuActions();
  hookScheduleInteractions();
  hookWeekInteractions();
  hookScheduleZoomShortcuts();
  hookModalInteractions();
  initForms();
  hookActionButtons();
  hookBaseInputChanges();
  resetReminderCard();
  if (state.lastWeekPlan) renderWeekPlan(state.lastWeekPlan);
  else clearWeekPlan();

  if (state.lastSchedule) renderSchedule(state.lastSchedule);
  else renderSchedule(null);

  setActiveView(resolveInitialWorkspaceView());
  ensureScheduleHydrated({ preferMode: state.ui.scheduleMode }).catch(() => {});
  loadAiConfigIntoForm().catch(() => {});
  initDesktopUi().catch(() => {});
  refreshCommunity().catch(() => {});
  updateProgressPill();
}

boot();

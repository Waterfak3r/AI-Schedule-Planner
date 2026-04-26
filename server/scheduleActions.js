const { clampInt, isPlainObject } = require("./utils");

const SUPPORTED_ACTION_TYPES = ["add_task_block", "move_block", "remove_block"];

function normalizeActionType(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliasMap = {
    add: "add_task_block",
    add_block: "add_task_block",
    add_task: "add_task_block",
    create: "add_task_block",
    create_task: "add_task_block",
    create_block: "add_task_block",
    insert: "add_task_block",
    insert_task: "add_task_block",
    new_task: "add_task_block",
    schedule_task: "add_task_block",
    move: "move_block",
    move_task: "move_block",
    move_task_block: "move_block",
    reschedule: "move_block",
    shift: "move_block",
    update_time: "move_block",
    update_block: "move_block",
    relocate: "move_block",
    remove: "remove_block",
    delete: "remove_block",
    remove_task: "remove_block",
    delete_task: "remove_block",
    cancel_task: "remove_block",
  };

  if (SUPPORTED_ACTION_TYPES.includes(key)) {
    return key;
  }

  return aliasMap[key] || "";
}

function normalizeTimeText(value) {
  return String(value || "").trim().replace(/[\uFF1A]/g, ":");
}

function normalizeCategory(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["study", "code", "workout", "other"].includes(key) ? key : "other";
}

function normalizeEnergy(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["high", "medium", "low"].includes(key) ? key : "medium";
}

function buildNormalizedAction(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const type = normalizeActionType(source.type || source.action || source.kind || source.operation || source.op);
  const title = String(source.title || source.name || source.taskTitle || source.task || "").trim();
  const fallbackMatch = String(
    source.match || source.target || source.targetTitle || source.titleMatch || ""
  ).trim();
  const matchTitle = String(source.matchTitle || fallbackMatch || title).trim();

  return {
    type,
    title,
    matchTitle,
    start: normalizeTimeText(source.start || source.startTime || source.from || source.begin),
    end: normalizeTimeText(source.end || source.endTime || source.to || source.finish),
    category: normalizeCategory(source.category),
    energy: normalizeEnergy(source.energy),
    priority: clampInt(source.priority ?? 3, 1, 5),
  };
}

function validateNormalizedAction(action) {
  const errors = [];

  if (!action.type) {
    errors.push("Unsupported action type");
    return errors;
  }

  if (action.type === "add_task_block") {
    if (!action.title) errors.push("title is required");
    if (!action.start) errors.push("start is required");
    if (!action.end) errors.push("end is required");
  }

  if (action.type === "move_block") {
    if (!action.matchTitle) errors.push("matchTitle is required");
    if (!action.start) errors.push("start is required");
    if (!action.end) errors.push("end is required");
  }

  if (action.type === "remove_block" && !action.matchTitle) {
    errors.push("matchTitle is required");
  }

  return errors;
}

function normalizeActionInput(raw) {
  const action = buildNormalizedAction(raw);
  const errors = validateNormalizedAction(action);
  return { action, errors };
}

function normalizeActionObject(raw) {
  const normalized = normalizeActionInput(raw);
  return normalized.errors.length === 0 ? normalized.action : null;
}

function normalizeActionList(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((action) => normalizeActionObject(action)).filter(Boolean);
}

function normalizeActionInputs(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((raw, index) => ({
    index,
    raw,
    ...normalizeActionInput(raw),
  }));
}

module.exports = {
  SUPPORTED_ACTION_TYPES,
  normalizeActionType,
  normalizeTimeText,
  normalizeCategory,
  normalizeEnergy,
  normalizeActionInput,
  normalizeActionObject,
  normalizeActionList,
  normalizeActionInputs,
};

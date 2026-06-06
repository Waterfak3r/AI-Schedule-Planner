const { normalizeActionList } = require("./scheduleActions");
const { minutesToTime, parseTimeToMinutes } = require("./time");

const DEFAULT_MODEL = process.env.RELAY_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
const DEFAULT_BASE_URL =
  process.env.RELAY_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const DEFAULT_PATH = process.env.RELAY_CHAT_PATH || "/chat/completions";
const DEFAULT_API_KEY_HEADER = process.env.RELAY_API_KEY_HEADER || "Authorization";
const DEFAULT_API_KEY_PREFIX = process.env.RELAY_API_KEY_PREFIX || "Bearer ";
const DEFAULT_TIMEOUT_MS = 30_000;

class AIConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "AIConfigError";
  }
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-20);
}

function buildSystemPrompt(context = {}) {
  const parts = [
    "You are an AI planning coach inside a schedule planner app.",
    "Respond with concise, actionable guidance.",
    "Prefer practical next steps and realistic time blocks.",
    "If user asks for schedule help, use provided context.",
    "When user asks you to directly modify, import, update, move, add, or remove schedule items, always append a machine-readable JSON block.",
    "Use exactly this wrapper:",
    "<SCHEDULE_ACTIONS_JSON>{\"actions\":[...]}</SCHEDULE_ACTIONS_JSON>",
    "Supported action types:",
    "1) add_task_block: {\"type\":\"add_task_block\",\"title\":\"...\",\"start\":\"HH:MM\",\"end\":\"HH:MM\",\"category\":\"study|code|workout|other\",\"energy\":\"high|medium|low\",\"priority\":1-5}",
    "2) move_block: {\"type\":\"move_block\",\"matchTitle\":\"...\",\"start\":\"HH:MM\",\"end\":\"HH:MM\"}",
    "3) remove_block: {\"type\":\"remove_block\",\"matchTitle\":\"...\"}",
    "When the user wants direct schedule changes, do not skip the JSON block.",
    "Use exact existing task titles in matchTitle when moving or removing blocks.",
    "If the user gives a new time for a title that already exists in Loaded blocks, use move_block unless they clearly ask to add another/new extra instance.",
    "Use add_task_block for genuinely new items, or when the user explicitly says to add another instance.",
    "Normalize casual time expressions, including Chinese numerals and punctuation variants such as 八点20, 8：三十, 九点;40, 七点半, noon, and 3pm, into HH:MM 24-hour time.",
    "If a direct add or move request has a clear item and start time but no end time or duration, default it to a 30-minute block and clearly say the duration is uncertain and the user should adjust it if needed.",
    "For sequential multi-event wording, a later event start can be used as the previous event's end boundary, but do not create an action for the later event unless it also has an end time or duration.",
    "If the request is vague planning advice without both a concrete item and concrete timing, do not append schedule actions. Examples that must return no JSON action: 安排一下, 晚上安排点东西, 明天学习一下, I need to study tomorrow, move it later, delete that.",
    "When Loaded blocks contain titles such as 写代码, 背单词, 复习数学, or 课程, map common aliases to the exact title before choosing move/remove: code/coding/code block -> 写代码, vocab/words -> 背单词, math review/math -> 复习数学, class/course -> 课程.",
    "Do not include JSON wrapper unless user intent is to apply or modify schedule.",
    "Chinese direct-edit requests are direct schedule changes too: for example, 把复习安排到19:00到19:30 means add_task_block with title 复习, start 19:00, end 19:30.",
  ];

  if (context?.planDate) {
    parts.push(`Current plan date: ${context.planDate}.`);
  }
  if (context?.wakeTime && context?.bedtime) {
    parts.push(`Active window: ${context.wakeTime} - ${context.bedtime}.`);
  }
  if (context?.scheduleSummary) {
    parts.push(`Schedule summary: ${context.scheduleSummary}.`);
  }
  if (Array.isArray(context?.scheduleBlocks) && context.scheduleBlocks.length > 0) {
    const blockDigest = context.scheduleBlocks
      .slice(0, 20)
      .map((block) => `${block.start || "??:??"}-${block.end || "??:??"} ${block.title || "Untitled"} [${block.type || "task"}]`)
      .join("; ");
    parts.push(`Loaded blocks: ${blockDigest}.`);
  }

  return parts.join(" ");
}

function extractActions(text) {
  const src = String(text || "");
  const reg = /<SCHEDULE_ACTIONS_JSON>([\s\S]*?)<\/SCHEDULE_ACTIONS_JSON>/i;
  const m = reg.exec(src);
  if (!m) {
    let parseError = false;
    // Fallback 1: fenced json block
    const fenced = /```json\s*([\s\S]*?)```/i.exec(src);
    if (fenced) {
      try {
        const parsed = JSON.parse(fenced[1].trim());
        const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
        const cleaned = src.replace(fenced[0], "").trim();
        return { cleanedText: cleaned, actions, parseError };
      } catch {
        parseError = true;
      }
    }

    // Fallback 2: inline object containing "actions"
    const inline = /\{[\s\S]*"actions"\s*:\s*\[[\s\S]*\][\s\S]*\}/i.exec(src);
    if (inline) {
      try {
        const parsed = JSON.parse(inline[0].trim());
        const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
        const cleaned = src.replace(inline[0], "").trim();
        return { cleanedText: cleaned, actions, parseError };
      } catch {
        parseError = true;
      }
    }

    return { cleanedText: src.trim(), actions: [], parseError };
  }

  const jsonText = m[1].trim();
  let parsed = null;
  let parseError = false;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = null;
    parseError = true;
  }

  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  const cleaned = (src.slice(0, m.index) + src.slice(m.index + m[0].length)).trim();

  return {
    cleanedText: cleaned,
    actions,
    parseError,
  };
}

function getLastUserMessage(messages) {
  const lastUser = [...(messages || [])].reverse().find((item) => item.role === "user");
  return String(lastUser?.content || "").trim();
}

function extractNormalizedActions(text) {
  const parsed = extractActions(text);
  return {
    cleanedText: parsed.cleanedText,
    actions: normalizeActionList(parsed.actions),
    parseError: parsed.parseError,
  };
}

function padHour(value) {
  return String(Number.parseInt(String(value), 10)).padStart(2, "0");
}

function normalizeClockText(hour, minute) {
  return `${padHour(hour)}:${String(minute).padStart(2, "0")}`;
}

function extractSimpleTimeRange(text) {
  const src = String(text || "").replace(/\uFF1A/g, ":");
  const match = /(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|~|～|—|–|－|到|至)\s*([01]?\d|2[0-3]):([0-5]\d)(?!\d)/u.exec(src);
  if (!match) return null;

  return {
    raw: match[0],
    index: match.index,
    start: normalizeClockText(match[1], match[2]),
    end: normalizeClockText(match[3], match[4]),
  };
}

function cleanupDerivedTitle(value) {
  return String(value || "")
    .replace(/[“”"'`]/g, "")
    .replace(/^(?:请|麻烦|帮我|给我|我想|我要|需要|please)\s*/iu, "")
    .replace(/(?:今天|今晚|明天|后天|上午|下午|晚上|中午|早上|tonight|today|tomorrow)/giu, "")
    .replace(/(?:日程|计划|任务|事项|schedule|task)/giu, "")
    .replace(/[，。,.!?！？；;：:]+$/u, "")
    .trim()
    .replace(/\s+/g, " ");
}

function inferAddActionTitle(userText, timeRange) {
  const text = String(userText || "").replace(/\uFF1A/g, ":");
  const withoutTime = text.replace(timeRange.raw, " ");
  const patterns = [
    /(?:把|将)\s*([^，。,.!?！？；;]+?)\s*(?:安排|排|放|加入|添加|新增|创建)(?:到|在|进)?/u,
    /(?:安排|排|添加|新增|加上|创建)\s*([^，。,.!?！？；;]+?)(?:到|在|从|于|为|$)/u,
    /\b(?:add|schedule|insert|create)\s+(.+?)\s+(?:from|at|between|to)\b/iu,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(withoutTime);
    const title = cleanupDerivedTitle(match?.[1]);
    if (title) return title.slice(0, 80);
  }

  return "";
}

function inferCategoryFromTitle(title) {
  const text = String(title || "").toLowerCase();
  if (/复习|学习|作业|背|阅读|课|review|study|homework|read/.test(text)) return "study";
  if (/代码|编程|开发|bug|code|debug|program/.test(text)) return "code";
  if (/运动|健身|跑步|训练|workout|gym|run|exercise/.test(text)) return "workout";
  return "other";
}

function shouldSkipLocalAddDerivation(text) {
  return /(?:删除|移除|取消|移动|挪到|改到|提前|推迟|remove|delete|cancel|move|reschedule|postpone|delay)/iu.test(
    String(text || "")
  );
}

function resolveCasualHour(hourValue, marker, inheritedEvening) {
  let hour = parseChineseNumber(hourValue);
  if (hour == null || hour < 0 || hour > 23) return null;

  const mark = String(marker || "");
  const isEvening = /(?:下午|晚上|今晚)/u.test(mark) || inheritedEvening;
  const isMorning = /(?:上午|早上|明早|明天早上)/u.test(mark);

  if (isEvening && !isMorning && hour >= 1 && hour < 12) {
    hour += 12;
  } else if (/中午/u.test(mark) && hour >= 1 && hour < 11) {
    hour += 12;
  }

  return hour;
}

function resolveCasualMinute(minuteValue) {
  const raw = String(minuteValue || "").trim();
  if (!raw) return 0;
  if (raw === "半") return 30;
  const parsed = parseChineseNumber(raw);
  return parsed != null && parsed >= 0 && parsed <= 59 ? parsed : null;
}

function extractCasualTimeMentions(text) {
  const src = String(text || "");
  const pattern =
    /(今晚|晚上|下午|中午|上午|早上|明早|明天早上)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:点|时)(?:\s*(半|[0-5]?\d|[一二两三四五六七八九十]{1,3}))?/gu;
  const mentions = [];
  let match = null;
  let inheritedEvening = false;

  while ((match = pattern.exec(src))) {
    const marker = match[1] || "";
    if (/(?:下午|晚上|今晚)/u.test(marker)) inheritedEvening = true;
    if (/(?:上午|早上|明早|明天早上)/u.test(marker)) inheritedEvening = false;

    const hour = resolveCasualHour(match[2], marker, inheritedEvening);
    const minute = resolveCasualMinute(match[3]);
    if (hour == null || minute == null) continue;

    mentions.push({
      raw: match[0],
      index: match.index,
      endIndex: match.index + match[0].length,
      time: normalizeClockText(hour, minute),
    });
  }

  return mentions;
}

function cleanupSequentialTitle(value) {
  return cleanupDerivedTitle(value)
    .replace(/^(?:要到|要去|要|到|去|在|大概|大约|左右|，|,|\s)+/u, "")
    .replace(/(?:然后|接着|随后|之后)[\s\S]*$/u, "")
    .replace(/^[，。,.!?！？；;：:\s]+|[，。,.!?！？；;：:\s]+$/gu, "")
    .trim()
    .slice(0, 80);
}

function deriveLocalSequentialBoundaryAction(userText) {
  const text = String(userText || "");
  if (!/(?:然后|接着|随后|之后)/u.test(text)) return null;

  const mentions = extractCasualTimeMentions(text);
  if (mentions.length < 2) return null;

  const first = mentions[0];
  const second = mentions[1];
  const connectorMatch = /(?:然后|接着|随后|之后)/u.exec(text.slice(first.endIndex, second.index));
  if (!connectorMatch) return null;

  const connectorIndex = first.endIndex + connectorMatch.index;
  const title = cleanupSequentialTitle(text.slice(first.endIndex, connectorIndex));
  if (!title) return null;
  const actions = [
    {
      type: "add_task_block",
      title,
      matchTitle: title,
      start: first.time,
      end: second.time,
      category: inferCategoryFromTitle(title),
      energy: "medium",
      priority: 3,
    },
  ];

  const secondTitle = cleanupSequentialTitle(text.slice(second.endIndex));
  if (secondTitle) {
    actions.push({
      type: "add_task_block",
      title: secondTitle,
      matchTitle: secondTitle,
      start: second.time,
      end: defaultEndTimeFromStart(second.time),
      category: inferCategoryFromTitle(secondTitle),
      energy: "medium",
      priority: 3,
    });
  }

  return {
    text: appendDefaultDurationNotice(
      `已准备把“${title}”安排在 ${first.time}-${second.time}${secondTitle ? `，并把“${secondTitle}”暂定为 ${second.time}-${defaultEndTimeFromStart(second.time)}` : ""}。`,
      secondTitle ? 1 : 0
    ),
    actions,
  };
}

function deriveLocalAddActionsFromUserText(messages) {
  const userText = getLastUserMessage(messages);
  if (!userText || shouldSkipLocalAddDerivation(userText)) return null;

  const timeRange = extractSimpleTimeRange(userText);
  if (!timeRange) return deriveLocalSequentialBoundaryAction(userText);

  const title = inferAddActionTitle(userText, timeRange);
  if (!title) return null;

  return {
    text: `已准备把“${title}”安排在 ${timeRange.start}-${timeRange.end}。`,
    actions: [
      {
        type: "add_task_block",
        title,
        matchTitle: title,
        start: timeRange.start,
        end: timeRange.end,
        category: inferCategoryFromTitle(title),
        energy: "medium",
        priority: 3,
      },
    ],
  };
}

function shouldReplaceClarificationText(text) {
  return /(?:请告诉我|告诉我|not enough information|tell me|could you|what .*task|任务\/活动名称)/iu.test(
    String(text || "")
  );
}

function normalizeLooseText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\uFF1A]/g, ":")
    .replace(/[\uFF1B]/g, ";")
    .replace(/\s+/g, " ");
}

function normalizeAliasKey(value) {
  return normalizeLooseText(value)
    .replace(/[“”"'`]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\bblocks?\b/g, "block")
    .replace(/\s+/g, " ")
    .trim();
}

function getContextScheduleBlocks(context) {
  return Array.isArray(context?.scheduleBlocks) ? context.scheduleBlocks : [];
}

function aliasesForKnownBlockTitle(title) {
  const normalizedTitle = normalizeAliasKey(title);
  const aliases = new Set([normalizedTitle]);

  if (normalizedTitle === "写代码") {
    ["代码", "写代", "写代吗", "code", "coding", "code block", "coding block"].forEach((item) =>
      aliases.add(item)
    );
  }

  if (normalizedTitle === "背单词") {
    ["单词", "vocab", "vocabulary", "word", "words"].forEach((item) => aliases.add(item));
  }

  if (normalizedTitle === "复习数学") {
    ["数学", "数学复习", "math", "math review", "mathematics"].forEach((item) => aliases.add(item));
  }

  if (normalizedTitle === "课程") {
    ["课", "上课", "class", "course", "lesson"].forEach((item) => aliases.add(item));
  }

  return aliases;
}

function resolveExistingBlockTitle(value, context) {
  const needle = normalizeAliasKey(value);
  if (!needle) return "";

  for (const block of getContextScheduleBlocks(context)) {
    const title = String(block?.title || "").trim();
    if (!title) continue;
    const aliases = aliasesForKnownBlockTitle(title);
    if (aliases.has(needle)) return title;
  }

  return "";
}

function textMentionsExistingTitle(userText, title, context) {
  const text = normalizeAliasKey(userText);
  if (!text) return false;

  const direct = resolveExistingBlockTitle(title, context);
  const targetTitle = direct || String(title || "").trim();
  for (const alias of aliasesForKnownBlockTitle(targetTitle)) {
    if (!alias) continue;
    if (text.includes(alias)) return true;
  }

  return false;
}

function userRequestsExtraInstance(text) {
  return /(?:再加|再添加|另加|另一个|加一个|加个|新增|添加|新建|创建|another|extra|additional|new\s+(?:task|block|item)|add\s+another)/iu.test(
    String(text || "")
  );
}

function hasExplicitTimeRange(text) {
  const src = normalizeLooseText(text);
  if (!src) return false;

  return (
    /\bfrom\b[\s\S]{0,60}\bto\b/i.test(src) ||
    /\bbetween\b[\s\S]{0,60}\band\b/i.test(src) ||
    /(?:\d|[一二三四五六七八九十两零〇半])[\s\S]{0,12}(?:-|~|～|—|–|－|到|至|\bto\b|until|til|through)[\s\S]{0,12}(?:\d|[一二三四五六七八九十两零〇半]|noon|midnight)/iu.test(
      src
    )
  );
}

function hasDuration(text) {
  return /(?:\d+\s*(?:min|mins|minutes?|hours?|hrs?)|half\s+an?\s+hour|\d+\s*(?:分钟|小时|个小时)|半小时|半个小时|一小时|一个小时|两小时|两个小时|大概\s*\d+\s*(?:分钟|小时|个小时))/iu.test(
    String(text || "")
  );
}

function hasConcreteTimingForAddOrMove(text) {
  return hasExplicitTimeRange(text) || hasDuration(text);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chineseDigit(value) {
  const map = {
    "\u96f6": 0,
    "\u3007": 0,
    "\u4e00": 1,
    "\u4e8c": 2,
    "\u4e24": 2,
    "\u4e09": 3,
    "\u56db": 4,
    "\u4e94": 5,
    "\u516d": 6,
    "\u4e03": 7,
    "\u516b": 8,
    "\u4e5d": 9,
  };
  return map[value];
}

function parseChineseNumber(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  if (text === "\u5341") return 10;
  if (text.startsWith("\u5341")) {
    const tail = chineseDigit(text.slice(1));
    return tail == null ? null : 10 + tail;
  }
  const tenIndex = text.indexOf("\u5341");
  if (tenIndex > 0) {
    const head = chineseDigit(text.slice(0, tenIndex));
    const tailText = text.slice(tenIndex + 1);
    const tail = tailText ? chineseDigit(tailText) : 0;
    return head == null || tail == null ? null : head * 10 + tail;
  }
  return chineseDigit(text);
}

function toChineseNumber(value) {
  const n = Number(value);
  const digits = ["\u96f6", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d", "\u4e03", "\u516b", "\u4e5d"];
  if (!Number.isInteger(n) || n < 0 || n > 99) return "";
  if (n < 10) return digits[n];
  if (n === 10) return "\u5341";
  if (n < 20) return `\u5341${digits[n - 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${digits[tens]}\u5341${ones ? digits[ones] : ""}`;
}

function timeMentionPatterns(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || ""));
  if (!match) return [];

  const hour24 = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  const hour12 = hour24 % 12 || 12;
  const minuteText = String(minute).padStart(2, "0");
  const hourTexts = Array.from(new Set([String(hour24), String(hour12), String(hour12).padStart(2, "0")]));
  const chineseHourTexts = Array.from(new Set([toChineseNumber(hour24), toChineseNumber(hour12)].filter(Boolean)));
  const chineseMinute = toChineseNumber(minute);
  const patterns = [];

  if (hour24 === 12 && minute === 0) patterns.push("\\bnoon\\b", "\u4e2d\u5348");
  if (hour24 === 0 && minute === 0) patterns.push("\\bmidnight\\b", "\u96f6\u70b9");

  for (const hour of hourTexts) {
    patterns.push(`${escapeRegExp(hour)}\\s*[:\uFF1A;；.]\\s*${minuteText}`);
    if (minute > 0 && chineseMinute) {
      patterns.push(`${escapeRegExp(hour)}\\s*[:\uFF1A;；.]\\s*${chineseMinute}`);
    }
    if (minute === 0) {
      patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)(?:\\s*\u6574)?`);
      patterns.push(`${escapeRegExp(hour)}\\s*p\\.?m\\.?`);
      patterns.push(`${escapeRegExp(hour)}\\s*a\\.?m\\.?`);
      patterns.push(`\\b(?:at|around|about|by)\\s+${escapeRegExp(hour)}\\b`);
    } else {
      const minuteShort = minuteText.replace(/^0/, "");
      const minutePrefix = minute < 10 ? "(?:\u96f6|0)?" : "";
      patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)\\s*${minutePrefix}${minuteShort}`);
      patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)\\s*[:\uFF1A;；.]\\s*${minuteText}`);
      patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)\\s*[:\uFF1A;；.]\\s*${minuteShort}`);
      if (minute === 30) patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)\\s*\u534a`);
      if (minute === 15) patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)\\s*\u4e00\u523b`);
      if (minute === 45) patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)\\s*\u4e09\u523b`);
      if (chineseMinute) {
        patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)\\s*(?:\u96f6)?${chineseMinute}`);
        patterns.push(`${escapeRegExp(hour)}\\s*(?:\u70b9|\u65f6)\\s*[:\uFF1A;；.]\\s*${chineseMinute}`);
      }
    }
  }

  for (const chineseHour of chineseHourTexts) {
    if (minute === 0) {
      patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)(?:\\s*\u6574)?`);
    } else if (minute === 30) {
      patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)\\s*\u534a`);
    } else {
      const minuteShort = minuteText.replace(/^0/, "");
      const minutePrefix = minute < 10 ? "(?:\u96f6|0)?" : "";
      patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)\\s*${minutePrefix}${minuteShort}`);
      patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)\\s*[:\uFF1A;；.]\\s*${minuteText}`);
      patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)\\s*[:\uFF1A;；.]\\s*${minuteShort}`);
      if (minute === 15) patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)\\s*\u4e00\u523b`);
      if (minute === 45) patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)\\s*\u4e09\u523b`);
      if (chineseMinute) {
        patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)\\s*(?:\u96f6)?${chineseMinute}`);
        patterns.push(`${chineseHour}\\s*(?:\u70b9|\u65f6)\\s*[:\uFF1A;；.]\\s*${chineseMinute}`);
      }
    }
  }

  return patterns;
}

function timeMentionedInText(time, text) {
  const src = String(text || "");
  return timeMentionPatterns(time).some((pattern) => new RegExp(pattern, "iu").test(src));
}

function actionHasConcreteTiming(text, action) {
  if (hasDuration(text)) return true;
  return timeMentionedInText(action.start, text) && timeMentionedInText(action.end, text);
}

function actionHasStartMention(text, action) {
  return timeMentionedInText(action.start, text);
}

function defaultEndTimeFromStart(start) {
  const startMin = parseTimeToMinutes(start);
  if (startMin == null) return "";
  return minutesToTime(Math.min(startMin + 30, 24 * 60));
}

function applyDefaultDuration(action) {
  const defaultEnd = defaultEndTimeFromStart(action.start);
  if (!defaultEnd) return action;
  return {
    ...action,
    end: defaultEnd,
  };
}

function appendDefaultDurationNotice(text, count) {
  if (!count) return text;
  const base = String(text || "").trim();
  const notice =
    count > 1
      ? `其中 ${count} 个事项缺少结束时间，我先按 30 分钟生成；这些时间段不确定，请你在日程里自行修改。`
      : "有 1 个事项缺少结束时间，我先按 30 分钟生成；这个时间段不确定，请你在日程里自行修改。";
  return base ? `${base}\n\n${notice}` : notice;
}

function localActionAlreadyCovered(existingActions, candidate) {
  const candidateTitle = normalizeAliasKey(candidate.title || candidate.matchTitle);
  return existingActions.some((action) => {
    const actionTitle = normalizeAliasKey(action.title || action.matchTitle);
    const sameEventKeyword =
      /考试|exam/i.test(actionTitle) && /考试|exam/i.test(candidateTitle);
    return (
      action.type === candidate.type &&
      action.start === candidate.start &&
      action.end === candidate.end &&
      (actionTitle.includes(candidateTitle) || candidateTitle.includes(actionTitle) || sameEventKeyword)
    );
  });
}

function mergeSequentialFallbackActions(userText, existingActions) {
  const derived = deriveLocalSequentialBoundaryAction(userText);
  if (!derived) {
    return { actions: existingActions, defaultedDurationCount: 0 };
  }

  const merged = [...existingActions];
  let defaultedDurationCount = 0;
  for (const action of derived.actions) {
    if (localActionAlreadyCovered(merged, action)) continue;
    merged.push(action);
    if (action.end === defaultEndTimeFromStart(action.start) && !timeMentionedInText(action.end, userText)) {
      defaultedDurationCount += 1;
    }
  }

  return { actions: merged, defaultedDurationCount };
}

function isVagueScheduleRequest(text) {
  const src = normalizeLooseText(text);
  if (!src) return false;

  if (hasConcreteTimingForAddOrMove(src)) return false;
  if (/(?:取消|删除|移除|去掉|不要了|删掉|remove|delete|cancel|drop|take out|skip|no .+today)/iu.test(src)) {
    return /(?:那个|这个|那项|这项|它|\bit\b|\bthat\b)/iu.test(src);
  }

  return /^(?:安排一下|帮我安排一下|晚上安排点东西|明天学习一下|i need to study tomorrow|move it later|delete that)$/iu.test(
    src
  );
}

function buildActionClarificationText(userText, reason) {
  if (reason === "missing-time-range") {
    return "我看到了开始时间，但还需要结束时间或持续时长，确认后才能修改日程。";
  }

  if (reason === "vague") {
    return "这条请求还缺少明确的事项或时间，我需要更具体的信息后才能修改日程。";
  }

  return "这条请求的信息还不够，我需要明确的事项和时间后才能修改日程。";
}

function sanitizeScheduleActions({ inputMessages, context, cleanedText, actions }) {
  const userText = getLastUserMessage(inputMessages);
  const safeActions = Array.isArray(actions) ? actions : [];
  if (safeActions.length === 0) {
    return { cleanedText, actions: safeActions };
  }

  const vagueRequest = isVagueScheduleRequest(userText);
  const sanitized = [];
  let droppedReason = "";
  let defaultedDurationCount = 0;

  for (const action of safeActions) {
    if (vagueRequest && action.type !== "remove_block") {
      droppedReason = "vague";
      continue;
    }

    if (action.type === "add_task_block") {
      const shouldDefaultDuration = !actionHasConcreteTiming(userText, action) && actionHasStartMention(userText, action);
      if (!actionHasConcreteTiming(userText, action) && !shouldDefaultDuration) {
        droppedReason = "missing-time-range";
        continue;
      }

      const actionWithTiming = shouldDefaultDuration ? applyDefaultDuration(action) : action;
      if (shouldDefaultDuration) defaultedDurationCount += 1;
      const existingTitle = resolveExistingBlockTitle(action.title || action.matchTitle, context);
      if (existingTitle && !userRequestsExtraInstance(userText)) {
        sanitized.push({
          ...actionWithTiming,
          type: "move_block",
          title: "",
          matchTitle: existingTitle,
        });
        continue;
      }

      sanitized.push(actionWithTiming);
      continue;
    }

    if (action.type === "move_block") {
      const shouldDefaultDuration = !actionHasConcreteTiming(userText, action) && actionHasStartMention(userText, action);
      if (!actionHasConcreteTiming(userText, action) && !shouldDefaultDuration) {
        droppedReason = "missing-time-range";
        continue;
      }

      const actionWithTiming = shouldDefaultDuration ? applyDefaultDuration(action) : action;
      if (shouldDefaultDuration) defaultedDurationCount += 1;
      const existingTitle = resolveExistingBlockTitle(action.matchTitle || action.title, context);
      sanitized.push({
        ...actionWithTiming,
        matchTitle: existingTitle || action.matchTitle,
      });
      continue;
    }

    if (action.type === "remove_block") {
      const existingTitle = resolveExistingBlockTitle(action.matchTitle || action.title, context);
      const matchTitle = existingTitle || action.matchTitle;
      if (!textMentionsExistingTitle(userText, matchTitle, context)) {
        droppedReason = "vague";
        continue;
      }

      sanitized.push({
        ...action,
        matchTitle,
      });
      continue;
    }

    sanitized.push(action);
  }

  if (sanitized.length > 0) {
    const merged = mergeSequentialFallbackActions(userText, sanitized);
    defaultedDurationCount += merged.defaultedDurationCount;
    return {
      cleanedText: appendDefaultDurationNotice(cleanedText, defaultedDurationCount),
      actions: merged.actions,
    };
  }

  return {
    cleanedText: buildActionClarificationText(userText, droppedReason) || cleanedText,
    actions: [],
  };
}

function buildPreparedActionText(actions) {
  const safeActions = Array.isArray(actions) ? actions : [];
  if (safeActions.length === 0) return "";

  const first = safeActions[0] || {};
  const title = String(first.title || first.matchTitle || "该任务").trim();
  const countText = safeActions.length > 1 ? `等 ${safeActions.length} 项调整` : "";

  if (first.type === "add_task_block") {
    return `已准备把“${title}”安排在 ${first.start}-${first.end}${countText}。`;
  }

  if (first.type === "move_block") {
    return `已准备把“${title}”移动到 ${first.start}-${first.end}${countText}。`;
  }

  if (first.type === "remove_block") {
    return `已准备删除“${title}”${countText}。`;
  }

  return `已准备 ${safeActions.length} 项日程调整。`;
}

function reconcileScheduleActionOutput({ inputMessages, context, cleanedText, actions }) {
  const safeActions = Array.isArray(actions) ? actions : [];

  if (safeActions.length > 0) {
    const sanitized = sanitizeScheduleActions({
      inputMessages,
      context,
      cleanedText,
      actions: safeActions,
    });

    if (sanitized.actions.length === 0) {
      return sanitized;
    }

    if (!cleanedText || shouldReplaceClarificationText(cleanedText)) {
      return {
        cleanedText: buildPreparedActionText(sanitized.actions) || sanitized.cleanedText || cleanedText,
        actions: sanitized.actions,
      };
    }

    return { cleanedText: sanitized.cleanedText || cleanedText, actions: sanitized.actions };
  }

  const derived = deriveLocalAddActionsFromUserText(inputMessages);
  if (!derived) return { cleanedText, actions: safeActions };

  return {
    cleanedText: derived.text,
    actions: derived.actions,
  };
}

function buildActionExtractionMessages({ inputMessages, assistantText, context }) {
  const lastUserText = getLastUserMessage(inputMessages) || "(empty)";
  const blockDigest =
    Array.isArray(context?.scheduleBlocks) && context.scheduleBlocks.length > 0
      ? context.scheduleBlocks
          .slice(0, 20)
          .map((block) => `${block.start || "??:??"}-${block.end || "??:??"} ${block.title || "Untitled"} [${block.type || "task"}]`)
          .join("\n")
      : String(context?.scheduleSummary || "none");

  return [
    {
      role: "system",
      content:
        "Convert schedule-editing intent into strict JSON only. Output only {\"actions\":[...]} with supported action types add_task_block, move_block, remove_block. Use HH:MM 24-hour time. Normalize casual time expressions, including Chinese numerals and punctuation variants such as 八点20, 8：三十, 九点;40, 七点半, noon, and 3pm. Use exact existing task titles for matchTitle when moving or removing. If the user gives a new time for a title already present in Current schedule blocks, use move_block unless they clearly ask to add another/new extra instance. Use add_task_block for genuinely new items. Map aliases to existing exact titles when possible: code/coding/code block -> 写代码, vocab/words -> 背单词, math review/math -> 复习数学, class/course -> 课程. If the user clearly wants direct schedule changes, prefer actionable JSON instead of returning an empty list. Chinese examples like '把复习安排到19:00到19:30' are enough information: use '复习' as the title. For sequential multi-event wording, a later event start can be used as the previous event's end boundary. If a direct add or move request has a clear item and start time but no end time or duration, default it to a 30-minute block. If the request is vague planning advice without both a concrete item and concrete timing, output {\"actions\":[]}. Examples with no action: 安排一下, 晚上安排点东西, 明天学习一下, I need to study tomorrow, move it later, delete that. If there is not enough information for a safe direct change, output {\"actions\":[]}.",
    },
    {
      role: "user",
      content: `User request:\n${lastUserText}\n\nAssistant answer:\n${assistantText || "(empty)"}\n\nPlan date: ${context?.planDate || ""}\nActive window: ${context?.wakeTime || ""} - ${context?.bedtime || ""}\nCurrent schedule blocks:\n${blockDigest}\n\nReturn JSON only.`,
    },
  ];
}

function looksLikeSchedulingIntent(messages) {
  const text = getLastUserMessage(messages);
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const englishKeywords = [
    "schedule",
    "plan",
    "arrange",
    "modify",
    "adjust",
    "reschedule",
    "move",
    "shift",
    "swap",
    "postpone",
    "delay",
    "bring forward",
    "add",
    "insert",
    "create",
    "remove",
    "delete",
    "cancel",
    "apply",
    "import",
    "change my schedule",
  ];
  const chineseKeywords = [
    "\u65e5\u7a0b",
    "\u8ba1\u5212",
    "\u5b89\u6392",
    "\u89c4\u5212",
    "\u8c03\u6574",
    "\u4fee\u6539",
    "\u66f4\u6539",
    "\u8c03\u6574\u65f6\u95f4",
    "\u79fb\u52a8",
    "\u632a\u5230",
    "\u63d0\u524d",
    "\u63a8\u8fdf",
    "\u6539\u5230",
    "\u52a0\u4e0a",
    "\u6dfb\u52a0",
    "\u65b0\u589e",
    "\u5220\u9664",
    "\u79fb\u9664",
    "\u53d6\u6d88",
    "\u5bfc\u5165",
    "\u5957\u7528",
    "\u4e00\u952e\u5bfc\u5165",
  ];
  const hasTimePattern =
    /\b([01]?\d|2[0-3])[:\uFF1A][0-5]\d\b/.test(text) ||
    /(?:^|[^\d])([01]?\d|2[0-3])\s*[\u70b9\u65f6](?:\s*\u534a)?/.test(text);

  return (
    englishKeywords.some((keyword) => lowerText.includes(keyword)) ||
    chineseKeywords.some((keyword) => text.includes(keyword)) ||
    hasTimePattern
  );
}

function normalizeTimeoutMs(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.max(1_000, Math.min(120_000, parsed));
}

function buildChatUrl(baseUrl, chatPath) {
  const safeBase = String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  const safePath = String(chatPath || DEFAULT_PATH).trim().replace(/^\/+/, "");
  return `${safeBase}/${safePath}`;
}

async function fetchWithTimeout(url, options, timeoutMs, label) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestChatOnce({ baseUrl, chatPath, model, requestMessages, authCandidates }) {
  let lastFailure = null;
  let json = null;
  const timeoutMs = normalizeTimeoutMs(process.env.RELAY_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS);
  const chatUrl = buildChatUrl(baseUrl, chatPath);

  for (const [headerName, headerValue] of authCandidates) {
    const headers = {
      "Content-Type": "application/json",
      [headerName]: headerValue,
    };

    const response = await fetchWithTimeout(
      chatUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: requestMessages,
          temperature: 0.5,
        }),
      },
      timeoutMs,
      "AI API request"
    );

    const raw = await response.text();
    json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (response.ok) {
      return { json, raw, ok: true };
    }

    const msg = json?.error?.message || raw || `AI API request failed (${response.status})`;
    lastFailure = new Error(msg);
    if (!isLikelyAuthError(response.status, json, raw)) {
      throw lastFailure;
    }
  }

  if (lastFailure) throw lastFailure;
  throw new Error("AI API request failed");
}

async function requestChatStreamOnce({
  baseUrl,
  chatPath,
  model,
  requestMessages,
  authCandidates,
  onDelta,
  onMeta,
}) {
  let lastFailure = null;
  const timeoutMs = normalizeTimeoutMs(process.env.RELAY_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS);
  const chatUrl = buildChatUrl(baseUrl, chatPath);

  for (const [headerName, headerValue] of authCandidates) {
    const headers = {
      "Content-Type": "application/json",
      [headerName]: headerValue,
    };

    const response = await fetchWithTimeout(
      chatUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: requestMessages,
          temperature: 0.5,
          stream: true,
        }),
      },
      timeoutMs,
      "AI API stream request"
    );

    if (!response.ok || !response.body) {
      const raw = await response.text();
      let json = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      const msg = json?.error?.message || raw || `AI API stream request failed (${response.status})`;
      lastFailure = new Error(msg);
      if (!isLikelyAuthError(response.status, json, raw)) {
        throw lastFailure;
      }
      continue;
    }

    if (typeof onMeta === "function") {
      onMeta({ model: response.headers.get("x-model") || model });
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");

      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex >= 0) {
        const packet = buffer.slice(0, separatorIndex).trim();
        buffer = buffer.slice(separatorIndex + 2);

        if (packet.startsWith("data:")) {
          const dataText = packet
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");

          if (dataText === "[DONE]") {
            return { text: fullText };
          }

          try {
            const data = JSON.parse(dataText);
            const delta = data?.choices?.[0]?.delta?.content;
            const token = typeof delta === "string" ? delta : "";
            if (token) {
              fullText += token;
              if (typeof onDelta === "function") {
                onDelta(token);
              }
            }
          } catch {
            // Ignore malformed stream chunks and continue.
          }
        }

        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    if (buffer.trim()) {
      const tail = buffer.trim();
      if (tail.startsWith("data:")) {
        const dataText = tail
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (dataText && dataText !== "[DONE]") {
          try {
            const data = JSON.parse(dataText);
            const delta = data?.choices?.[0]?.delta?.content;
            const token = typeof delta === "string" ? delta : "";
            if (token) {
              fullText += token;
              if (typeof onDelta === "function") {
                onDelta(token);
              }
            }
          } catch {
            // no-op
          }
        }
      }
    }

    return { text: fullText };
  }

  if (lastFailure) throw lastFailure;
  throw new Error("AI API stream request failed");
}

function extractTextFromChatCompletion(json) {
  const first = json?.choices?.[0]?.message?.content;
  if (typeof first === "string") return first.trim();

  if (Array.isArray(first)) {
    const text = first
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
    return text;
  }

  return "";
}

function normalizeApiKey(rawKey) {
  let key = String(rawKey || "").trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

function buildAuthHeaderValue(apiKey, prefix) {
  const key = normalizeApiKey(apiKey);
  const safePrefix = String(prefix || "");
  if (!safePrefix) return key;

  const lowerPrefix = safePrefix.trim().toLowerCase();
  const lowerKey = key.toLowerCase();
  if (lowerPrefix === "bearer" && lowerKey.startsWith("bearer ")) return key;

  return `${safePrefix}${key}`;
}

function buildAuthHeaderCandidates(apiKey, configuredHeader, configuredPrefix) {
  const key = normalizeApiKey(apiKey);
  const entries = [
    [configuredHeader || "Authorization", buildAuthHeaderValue(key, configuredPrefix || "Bearer ")],
    ["Authorization", buildAuthHeaderValue(key, "Bearer ")],
    ["Authorization", key],
    ["x-api-key", key],
    ["api-key", key],
  ];

  const unique = [];
  const seen = new Set();
  for (const [header, value] of entries) {
    const h = String(header || "").trim();
    const v = String(value || "").trim();
    if (!h || !v) continue;
    const sig = `${h.toLowerCase()}::${v}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push([h, v]);
  }
  return unique;
}

function isLikelyAuthError(status, json, raw) {
  if (status === 401 || status === 403) return true;
  const msg = String(json?.error?.message || raw || "").toLowerCase();
  return msg.includes("token") || msg.includes("auth") || msg.includes("unauthor") || msg.includes("api key");
}

async function generateChatReply({ messages, context }) {
  const apiKey = process.env.RELAY_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError("RELAY_API_KEY is not configured");
  }

  const model = process.env.RELAY_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const baseUrl = (process.env.RELAY_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const chatPath = process.env.RELAY_CHAT_PATH || DEFAULT_PATH;
  const apiKeyHeader = process.env.RELAY_API_KEY_HEADER || DEFAULT_API_KEY_HEADER;
  const apiKeyPrefix = process.env.RELAY_API_KEY_PREFIX || DEFAULT_API_KEY_PREFIX;
  const inputMessages = normalizeMessages(messages);

  if (inputMessages.length === 0) {
    throw new Error("messages is required");
  }

  const requestMessages = [
    { role: "system", content: buildSystemPrompt(context) },
    ...inputMessages.map((item) => ({ role: item.role, content: item.content })),
  ];

  const authCandidates = buildAuthHeaderCandidates(apiKey, apiKeyHeader, apiKeyPrefix);
  const first = await requestChatOnce({
    baseUrl,
    chatPath,
    model,
    requestMessages,
    authCandidates,
  });
  const firstText = extractTextFromChatCompletion(first.json);
  let { cleanedText, actions, parseError } = extractNormalizedActions(firstText);

  if (actions.length === 0 && looksLikeSchedulingIntent(inputMessages)) {
    const second = await requestChatOnce({
      baseUrl,
      chatPath,
      model,
      requestMessages: buildActionExtractionMessages({
        inputMessages,
        assistantText: firstText,
        context,
      }),
      authCandidates,
    });

    const secondText = extractTextFromChatCompletion(second.json);
    const parsed = extractNormalizedActions(secondText);
    parseError = parseError || parsed.parseError;
    if (parsed.actions.length > 0) {
      actions = parsed.actions;
    }
  }

  ({ cleanedText, actions } = reconcileScheduleActionOutput({
    inputMessages,
    context,
    cleanedText,
    actions,
  }));

  if (!cleanedText && actions.length === 0) {
    if (parseError) {
      cleanedText = "I prepared a schedule change, but the action payload could not be parsed safely.";
    } else {
      throw new Error("AI response is empty");
    }
  }

  return {
    text: cleanedText || "I already prepared an applicable schedule adjustment proposal.",
    actions,
    model: first.json?.model || model,
    usage: first.json?.usage || null,
  };
}

async function generateChatReplyStream({ messages, context, onDelta, onMeta }) {
  const apiKey = process.env.RELAY_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIConfigError("RELAY_API_KEY is not configured");
  }

  const model = process.env.RELAY_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const baseUrl = (process.env.RELAY_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const chatPath = process.env.RELAY_CHAT_PATH || DEFAULT_PATH;
  const apiKeyHeader = process.env.RELAY_API_KEY_HEADER || DEFAULT_API_KEY_HEADER;
  const apiKeyPrefix = process.env.RELAY_API_KEY_PREFIX || DEFAULT_API_KEY_PREFIX;
  const inputMessages = normalizeMessages(messages);

  if (inputMessages.length === 0) {
    throw new Error("messages is required");
  }

  const requestMessages = [
    { role: "system", content: buildSystemPrompt(context) },
    ...inputMessages.map((item) => ({ role: item.role, content: item.content })),
  ];

  const authCandidates = buildAuthHeaderCandidates(apiKey, apiKeyHeader, apiKeyPrefix);
  const streamed = await requestChatStreamOnce({
    baseUrl,
    chatPath,
    model,
    requestMessages,
    authCandidates,
    onDelta,
    onMeta,
  });

  let { cleanedText, actions, parseError } = extractNormalizedActions(streamed.text);

  if (actions.length === 0 && looksLikeSchedulingIntent(inputMessages)) {
    const second = await requestChatOnce({
      baseUrl,
      chatPath,
      model,
      requestMessages: buildActionExtractionMessages({
        inputMessages,
        assistantText: streamed.text,
        context,
      }),
      authCandidates,
    });

    const secondText = extractTextFromChatCompletion(second.json);
    const parsed = extractNormalizedActions(secondText);
    parseError = parseError || parsed.parseError;
    if (parsed.actions.length > 0) {
      actions = parsed.actions;
    }
  }

  ({ cleanedText, actions } = reconcileScheduleActionOutput({
    inputMessages,
    context,
    cleanedText,
    actions,
  }));

  if (!cleanedText && actions.length === 0) {
    if (parseError) {
      cleanedText = "I prepared a schedule change, but the action payload could not be parsed safely.";
    } else {
      throw new Error("AI response is empty");
    }
  }

  return {
    text: cleanedText || "I already prepared an applicable schedule adjustment proposal.",
    actions,
    model,
    usage: null,
  };
}

module.exports = {
  generateChatReply,
  generateChatReplyStream,
  AIConfigError,
};

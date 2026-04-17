const DEFAULT_MODEL = process.env.RELAY_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
const DEFAULT_BASE_URL =
  process.env.RELAY_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const DEFAULT_PATH = process.env.RELAY_CHAT_PATH || "/chat/completions";
const DEFAULT_API_KEY_HEADER = process.env.RELAY_API_KEY_HEADER || "Authorization";
const DEFAULT_API_KEY_PREFIX = process.env.RELAY_API_KEY_PREFIX || "Bearer ";

class AIConfigError extends Error {}

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
    "Do not include JSON wrapper unless user intent is to apply or modify schedule.",
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
    // Fallback 1: fenced json block
    const fenced = /```json\s*([\s\S]*?)```/i.exec(src);
    if (fenced) {
      try {
        const parsed = JSON.parse(fenced[1].trim());
        const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
        const cleaned = src.replace(fenced[0], "").trim();
        return { cleanedText: cleaned, actions };
      } catch {
        // continue
      }
    }

    // Fallback 2: inline object containing "actions"
    const inline = /\{[\s\S]*"actions"\s*:\s*\[[\s\S]*\][\s\S]*\}/i.exec(src);
    if (inline) {
      try {
        const parsed = JSON.parse(inline[0].trim());
        const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
        const cleaned = src.replace(inline[0], "").trim();
        return { cleanedText: cleaned, actions };
      } catch {
        // ignore
      }
    }

    return { cleanedText: src.trim(), actions: [] };
  }

  const jsonText = m[1].trim();
  let parsed = null;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = null;
  }

  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  const cleaned = (src.slice(0, m.index) + src.slice(m.index + m[0].length)).trim();

  return {
    cleanedText: cleaned,
    actions,
  };
}

function getLastUserMessage(messages) {
  const lastUser = [...(messages || [])].reverse().find((item) => item.role === "user");
  return String(lastUser?.content || "").trim();
}

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
  if (key === "add_task_block" || key === "move_block" || key === "remove_block") {
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

function normalizeActionObject(raw) {
  const type = normalizeActionType(raw?.type || raw?.action || raw?.kind || raw?.operation || raw?.op);
  if (!type) return null;

  const title = String(raw?.title || raw?.name || raw?.taskTitle || raw?.task || "").trim();
  const fallbackMatch = String(raw?.match || raw?.target || raw?.targetTitle || raw?.titleMatch || "").trim();
  const matchTitle = String(raw?.matchTitle || fallbackMatch || title).trim();
  const start = normalizeTimeText(raw?.start || raw?.startTime || raw?.from || raw?.begin);
  const end = normalizeTimeText(raw?.end || raw?.endTime || raw?.to || raw?.finish);
  const action = {
    type,
    title,
    matchTitle,
    start,
    end,
    category: normalizeCategory(raw?.category),
    energy: normalizeEnergy(raw?.energy),
    priority: Number.isFinite(Number(raw?.priority)) ? Number(raw.priority) : 3,
  };

  if (type === "add_task_block" && (!action.title || !action.start || !action.end)) return null;
  if (type === "move_block" && (!action.matchTitle || !action.start || !action.end)) return null;
  if (type === "remove_block" && !action.matchTitle) return null;

  return action;
}

function normalizeActionList(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((action) => normalizeActionObject(action)).filter(Boolean);
}

function extractNormalizedActions(text) {
  const parsed = extractActions(text);
  return {
    cleanedText: parsed.cleanedText,
    actions: normalizeActionList(parsed.actions),
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
        "Convert schedule-editing intent into strict JSON only. Output only {\"actions\":[...]} with supported action types add_task_block, move_block, remove_block. Use HH:MM 24-hour time. Use exact existing task titles for matchTitle when moving or removing. If the user clearly wants direct schedule changes, prefer actionable JSON instead of returning an empty list. If there is not enough information for a safe direct change, output {\"actions\":[]}.",
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

async function requestChatOnce({ baseUrl, chatPath, model, requestMessages, authCandidates }) {
  let lastFailure = null;
  let json = null;

  for (const [headerName, headerValue] of authCandidates) {
    const headers = {
      "Content-Type": "application/json",
      [headerName]: headerValue,
    };

    const response = await fetch(`${baseUrl}${chatPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: requestMessages,
        temperature: 0.5,
      }),
    });

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

  for (const [headerName, headerValue] of authCandidates) {
    const headers = {
      "Content-Type": "application/json",
      [headerName]: headerValue,
    };

    const response = await fetch(`${baseUrl}${chatPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: requestMessages,
        temperature: 0.5,
        stream: true,
      }),
    });

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
  let { cleanedText, actions } = extractNormalizedActions(firstText);

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
    if (parsed.actions.length > 0) {
      actions = parsed.actions;
    }
  }

  if (!cleanedText && actions.length === 0) {
    throw new Error("AI response is empty");
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

  let { cleanedText, actions } = extractNormalizedActions(streamed.text);

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
    if (parsed.actions.length > 0) {
      actions = parsed.actions;
    }
  }

  if (!cleanedText && actions.length === 0) {
    throw new Error("AI response is empty");
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

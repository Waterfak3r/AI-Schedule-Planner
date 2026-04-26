const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const {
  buildDaySchedule,
  buildWeekSchedule,
  PlannerInputError,
  ScheduleValidationError,
} = require("./scheduleEngine");
const { previewScheduleActions, applyScheduleActions } = require("./scheduleActionService");
const { generateSleepReminder } = require("./reminderEngine");
const { CommunityStore } = require("./communityStore");
const { generateChatReply, generateChatReplyStream, AIConfigError } = require("./aiClient");

const ROOT_DIR = process.env.APP_ROOT_DIR
  ? path.resolve(process.env.APP_ROOT_DIR)
  : path.join(__dirname, "..");
const PUBLIC_DIR = process.env.APP_PUBLIC_DIR
  ? path.resolve(process.env.APP_PUBLIC_DIR)
  : path.join(ROOT_DIR, "public");
const DATA_DIR = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(ROOT_DIR, "data");

function loadEnvFile() {
  const envPath = process.env.APP_ENV_PATH
    ? path.resolve(process.env.APP_ENV_PATH)
    : path.join(ROOT_DIR, ".env");

  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const communityStore = new CommunityStore(path.join(DATA_DIR, "community.json"));

class RequestBodyError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "RequestBodyError";
    this.statusCode = statusCode;
  }
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function sendSseEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function readJsonBody(req, { maxBytes = 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    let settled = false;

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const resolveOnce = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    req.on("data", (chunk) => {
      if (settled) return;

      size += chunk.length;
      if (size > maxBytes) {
        rejectOnce(new RequestBodyError("Request body too large", 413));
        return;
      }
      raw += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (settled) return;

      if (!raw.trim()) {
        resolveOnce({});
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          rejectOnce(new RequestBodyError("Request body must be a JSON object"));
          return;
        }

        resolveOnce(parsed);
      } catch {
        rejectOnce(new RequestBodyError("Request body must be valid JSON"));
      }
    });

    req.on("error", rejectOnce);
  });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function isPathInside(parentDir, candidatePath) {
  const relative = path.relative(parentDir, candidatePath);
  return relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveStaticPath(urlPath) {
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const decoded = decodeURIComponent(safePath);
  const publicRoot = path.resolve(PUBLIC_DIR);
  const relativePath = decoded.replace(/^[/\\]+/, "");
  const resolved = path.resolve(publicRoot, relativePath);

  if (!isPathInside(publicRoot, resolved)) {
    return null;
  }

  return resolved;
}

async function serveStatic(res, urlPath) {
  let resolved = null;
  try {
    resolved = resolveStaticPath(urlPath);
  } catch {
    sendText(res, 400, "Bad Request");
    return;
  }

  if (!resolved) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(resolved);
    if (stat.isDirectory()) {
      sendText(res, 404, "Not Found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypeFor(resolved),
      "Cache-Control": "no-store",
    });
    fs.createReadStream(resolved).pipe(res);
  } catch {
    sendText(res, 404, "Not Found");
  }
}

function notFound(res) {
  sendJson(res, 404, { ok: false, error: "Not Found" });
}

function badRequest(res, message) {
  sendJson(res, 400, { ok: false, error: message });
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasUsableMessages(messages) {
  return Array.isArray(messages) && messages.some((item) => String(item?.content || "").trim().length > 0);
}

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

function createAppServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const method = (req.method || "GET").toUpperCase();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, {
          ok: true,
          name: "ai-schedule-planner-mvp",
          time: new Date().toISOString(),
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/schedule") {
        const body = await readJsonBody(req);
        const result = buildDaySchedule(body);
        sendJson(res, 200, { ok: true, result });
        return;
      }

      if (method === "POST" && url.pathname === "/api/week-schedule") {
        const body = await readJsonBody(req);
        if (!isIsoDate(body.startDate ?? body.date)) {
          badRequest(res, "startDate is required (YYYY-MM-DD)");
          return;
        }

        const result = buildWeekSchedule(body);
        sendJson(res, 200, { ok: true, result });
        return;
      }

      if (method === "POST" && url.pathname === "/api/reminder") {
        const body = await readJsonBody(req);
        const result = generateSleepReminder(body);
        sendJson(res, 200, { ok: true, result });
        return;
      }

      if (method === "POST" && url.pathname === "/api/schedule-actions/preview") {
        const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
        const result = previewScheduleActions(body);
        sendJson(res, 200, { ok: true, result });
        return;
      }

      if (method === "POST" && url.pathname === "/api/schedule-actions/apply") {
        const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
        const result = applyScheduleActions(body);
        sendJson(res, 200, { ok: true, result });
        return;
      }

      if (method === "POST" && url.pathname === "/api/chat") {
        const body = await readJsonBody(req, { maxBytes: 128 * 1024 });
        if (!hasUsableMessages(body.messages)) {
          badRequest(res, "messages is required");
          return;
        }

        const result = await generateChatReply({
          messages: body.messages,
          context: body.context || {},
        });
        if (process.env.CHAT_DEBUG === "1") {
          const lastUser = Array.isArray(body.messages)
            ? [...body.messages].reverse().find((m) => m?.role === "user")?.content || ""
            : "";
          const preview = String(lastUser).slice(0, 120).replace(/\s+/g, " ");
          console.log(
            `[CHAT_DEBUG] model=${result.model || ""} actions=${Array.isArray(result.actions) ? result.actions.length : 0} user="${preview}"`
          );
        }
        sendJson(res, 200, { ok: true, result });
        return;
      }

      if (method === "POST" && url.pathname === "/api/chat/stream") {
        const body = await readJsonBody(req, { maxBytes: 128 * 1024 });
        if (!hasUsableMessages(body.messages)) {
          badRequest(res, "messages is required");
          return;
        }

        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
        });

        let finished = false;
        const closeSafely = () => {
          if (finished) return;
          finished = true;
          try {
            res.end();
          } catch {
            // no-op
          }
        };

        req.on("close", closeSafely);

        try {
          const result = await generateChatReplyStream({
            messages: body.messages,
            context: body.context || {},
            onDelta: (token) => {
              if (!finished) sendSseEvent(res, "token", { token });
            },
            onMeta: (meta) => {
              if (!finished) sendSseEvent(res, "meta", meta || {});
            },
          });

          if (!finished) {
            sendSseEvent(res, "done", { result });
          }
        } catch (error) {
          if (!finished) {
            sendSseEvent(res, "error", { error: error?.message || "AI stream failed" });
          }
        } finally {
          closeSafely();
        }

        return;
      }

      if (method === "GET" && url.pathname === "/api/community/top") {
        const top = await communityStore.getTop({ limit: 30 });
        sendJson(res, 200, { ok: true, posts: top });
        return;
      }

      if (method === "GET" && url.pathname === "/api/community/random") {
        const post = await communityStore.getRandom();
        sendJson(res, 200, { ok: true, post });
        return;
      }

      if (method === "POST" && url.pathname === "/api/community/post") {
        const body = await readJsonBody(req, { maxBytes: 16 * 1024 });
        if (typeof body.text !== "string" || body.text.trim().length < 5) {
          badRequest(res, "text is required (min 5 chars)");
          return;
        }

        const created = await communityStore.addPost({
          text: body.text.trim(),
          tags: Array.isArray(body.tags) ? body.tags.slice(0, 6).map(String) : [],
        });
        sendJson(res, 200, { ok: true, post: created });
        return;
      }

      if (method === "POST" && url.pathname === "/api/community/like") {
        const body = await readJsonBody(req, { maxBytes: 8 * 1024 });
        if (typeof body.id !== "string" || !body.id.trim()) {
          badRequest(res, "id is required");
          return;
        }

        const updated = await communityStore.like(body.id.trim());
        if (!updated) {
          notFound(res);
          return;
        }

        sendJson(res, 200, { ok: true, post: updated });
        return;
      }

      if (method === "GET") {
        await serveStatic(res, url.pathname);
        return;
      }

      notFound(res);
    } catch (error) {
      if (error instanceof ScheduleValidationError) {
        sendJson(res, 400, { ok: false, error: error.message, details: error.issues });
        return;
      }

      if (error instanceof PlannerInputError) {
        sendJson(res, 400, { ok: false, error: error.message });
        return;
      }

      if (error instanceof RequestBodyError) {
        sendJson(res, error.statusCode || 400, { ok: false, error: error.message });
        return;
      }

      if (error instanceof AIConfigError) {
        sendJson(res, 400, { ok: false, error: error.message });
        return;
      }

      sendJson(res, 500, { ok: false, error: error?.message || "Internal Server Error" });
    }
  });
}

async function startServer(options = {}) {
  const requestedPort = Number.parseInt(String(options.port ?? process.env.PORT ?? "3000"), 10);
  const configuredHost = options.host ?? process.env.HOST;
  const host =
    configuredHost == null || String(configuredHost).trim() === ""
      ? "127.0.0.1"
      : String(configuredHost).trim();
  const port = Number.isFinite(requestedPort) ? requestedPort : 3000;

  await ensureDataDir();
  await communityStore.ensure();

  const server = createAppServer();

  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("listening", handleListening);
      reject(error);
    };

    const handleListening = () => {
      server.off("error", handleError);
      const address = server.address();
      const resolvedPort =
        address && typeof address === "object" && Number.isFinite(address.port) ? address.port : port;
      const resolvedHost = host || "127.0.0.1";
      const url = `http://${resolvedHost}:${resolvedPort}`;

      resolve({
        server,
        host: resolvedHost,
        port: resolvedPort,
        url,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    };

    server.once("error", handleError);
    server.once("listening", handleListening);

    server.listen(port, host);
  });
}

module.exports = {
  startServer,
  createAppServer,
  paths: {
    ROOT_DIR,
    PUBLIC_DIR,
    DATA_DIR,
  },
};

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");

const ROOT_DIR = path.join(__dirname, "..");
const PRODUCT_NAME = "AI Schedule Planner";
const APP_ICON_PATH = path.join(ROOT_DIR, "build", "icon.ico");

app.setName(PRODUCT_NAME);

let mainWindow = null;
let serverControl = null;
let runtimeInfo = null;

const AI_CONFIG_KEYS = [
  "RELAY_API_KEY",
  "RELAY_BASE_URL",
  "RELAY_MODEL",
  "RELAY_CHAT_PATH",
  "RELAY_API_KEY_HEADER",
  "RELAY_API_KEY_PREFIX",
];
const WORKSPACE_STATE_FILE = "workspace-state.json";
const DEFAULT_RELAY_BASE_URL = process.env.RELAY_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const DEFAULT_RELAY_CHAT_PATH = process.env.RELAY_CHAT_PATH || "/chat/completions";
const DEFAULT_RELAY_MODEL = process.env.RELAY_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
const AI_DETECT_TIMEOUT_MS = 10000;

async function ensureRuntimeFiles() {
  const userDataDir = app.getPath("userData");
  const dataDir = path.join(userDataDir, "data");
  const envPath = path.join(userDataDir, ".env");
  const publicDir = path.join(ROOT_DIR, "public");
  const envTemplatePath = path.join(ROOT_DIR, ".env.example");

  await fsp.mkdir(dataDir, { recursive: true });

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envTemplatePath)) {
      await fsp.copyFile(envTemplatePath, envPath);
    } else {
      await fsp.writeFile(envPath, "", "utf8");
    }
  }

  process.env.APP_ROOT_DIR = ROOT_DIR;
  process.env.APP_PUBLIC_DIR = publicDir;
  process.env.APP_DATA_DIR = dataDir;
  process.env.APP_ENV_PATH = envPath;
  if (!process.env.PORT) {
    process.env.PORT = "0";
  }

  runtimeInfo = {
    isDesktop: true,
    isPackaged: app.isPackaged,
    productName: PRODUCT_NAME,
    version: app.getVersion(),
    userDataDir,
    dataDir,
    envPath,
    workspaceStatePath: path.join(dataDir, WORKSPACE_STATE_FILE),
  };

  return runtimeInfo;
}

function parseEnvText(raw) {
  const map = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1);
    if (!key) continue;
    map[key] = value;
  }
  return map;
}

function buildEnvText(map) {
  const orderedKeys = [
    "RELAY_API_KEY",
    "RELAY_BASE_URL",
    "RELAY_MODEL",
    "RELAY_CHAT_PATH",
    "RELAY_API_KEY_HEADER",
    "RELAY_API_KEY_PREFIX",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "OPENAI_BASE_URL",
    "PORT",
  ];

  const lines = [];
  for (const key of orderedKeys) {
    if (!(key in map)) continue;
    lines.push(`${key}=${map[key] ?? ""}`);
  }

  for (const key of Object.keys(map)) {
    if (orderedKeys.includes(key)) continue;
    lines.push(`${key}=${map[key] ?? ""}`);
  }

  return `${lines.join("\n")}\n`;
}

async function readEnvMap() {
  const info = await ensureRuntimeFiles();
  const raw = await fsp.readFile(info.envPath, "utf8").catch(() => "");
  return parseEnvText(raw);
}

async function writeEnvMap(map) {
  const info = await ensureRuntimeFiles();
  await fsp.writeFile(info.envPath, buildEnvText(map), "utf8");
}

async function getAiConfig() {
  const envMap = await readEnvMap();
  const config = {};
  for (const key of AI_CONFIG_KEYS) {
    config[key] = String(envMap[key] || "");
  }
  return config;
}

function trimTrailingSlashes(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeChatPath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function uniqueStrings(values) {
  const unique = [];
  const seen = new Set();

  for (const value of values) {
    const next = String(value || "").trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    unique.push(next);
  }

  return unique;
}

function normalizeApiKey(rawKey) {
  let key = String(rawKey || "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
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
  if (lowerPrefix === "bearer" && lowerKey.startsWith("bearer ")) {
    return key;
  }

  return `${safePrefix}${key}`;
}

function isLikelyAuthError(status, raw) {
  if (status === 401 || status === 403) return true;
  const message = String(raw || "").toLowerCase();
  return (
    message.includes("token") ||
    message.includes("auth") ||
    message.includes("unauthor") ||
    message.includes("api key") ||
    message.includes("access key")
  );
}

function extractEmbeddedEndpoint(rawBaseUrl) {
  const trimmed = trimTrailingSlashes(rawBaseUrl);
  if (!trimmed) {
    return { baseUrl: "", inferredChatPath: "" };
  }

  if (/\/chat\/completions$/i.test(trimmed)) {
    return {
      baseUrl: trimmed.slice(0, -"/chat/completions".length),
      inferredChatPath: "/chat/completions",
    };
  }

  return { baseUrl: trimmed, inferredChatPath: "" };
}

function buildBaseUrlCandidates(rawBaseUrl) {
  const extracted = extractEmbeddedEndpoint(rawBaseUrl);
  const seed = extracted.baseUrl || trimTrailingSlashes(rawBaseUrl) || DEFAULT_RELAY_BASE_URL;
  const lowerSeed = seed.toLowerCase();

  return {
    inferredChatPath: extracted.inferredChatPath,
    baseCandidates: uniqueStrings([
      seed,
      /\/v1$/i.test(lowerSeed) ? "" : `${seed}/v1`,
      /\/openai\/v1$/i.test(lowerSeed) ? "" : `${seed}/openai/v1`,
    ]),
  };
}

function buildAuthProbeCandidates(apiKey, configuredHeader, configuredPrefix) {
  const key = normalizeApiKey(apiKey);
  const explicitHeader = String(configuredHeader || "").trim();
  const explicitPrefix = String(configuredPrefix ?? "");
  const entries = [];

  if (key && (explicitHeader || explicitPrefix !== "")) {
    entries.push({
      header: explicitHeader || "Authorization",
      prefix: explicitPrefix,
      value: buildAuthHeaderValue(key, explicitPrefix),
    });
  }

  entries.push(
    { header: "Authorization", prefix: "Bearer ", value: buildAuthHeaderValue(key, "Bearer ") },
    { header: "Authorization", prefix: "", value: buildAuthHeaderValue(key, "") },
    { header: "x-api-key", prefix: "", value: key },
    { header: "api-key", prefix: "", value: key }
  );

  const unique = [];
  const seen = new Set();
  for (const entry of entries) {
    const header = String(entry.header || "").trim();
    const value = String(entry.value || "").trim();
    if (!header || !value) continue;
    const signature = `${header.toLowerCase()}::${value}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push({ header, prefix: entry.prefix, value });
  }

  return unique;
}

function normalizeAiConfigInput(nextConfig) {
  return {
    RELAY_API_KEY: String(nextConfig?.RELAY_API_KEY || "").trim(),
    RELAY_BASE_URL: String(nextConfig?.RELAY_BASE_URL || "").trim(),
    RELAY_MODEL: String(nextConfig?.RELAY_MODEL || "").trim(),
    RELAY_CHAT_PATH: normalizeChatPath(nextConfig?.RELAY_CHAT_PATH || ""),
    RELAY_API_KEY_HEADER: String(nextConfig?.RELAY_API_KEY_HEADER || "").trim(),
    RELAY_API_KEY_PREFIX: String(nextConfig?.RELAY_API_KEY_PREFIX ?? ""),
  };
}

function buildFallbackAiConfig(normalizedConfig, inferredChatPath, baseCandidates) {
  const keepExplicitPrefix =
    normalizedConfig.RELAY_API_KEY_PREFIX !== "" || normalizedConfig.RELAY_API_KEY_HEADER.length > 0;

  return {
    ...normalizedConfig,
    RELAY_BASE_URL: baseCandidates[0] || DEFAULT_RELAY_BASE_URL,
    RELAY_CHAT_PATH: normalizeChatPath(normalizedConfig.RELAY_CHAT_PATH || inferredChatPath || DEFAULT_RELAY_CHAT_PATH),
    RELAY_API_KEY_HEADER: normalizedConfig.RELAY_API_KEY_HEADER || "Authorization",
    RELAY_API_KEY_PREFIX: keepExplicitPrefix ? normalizedConfig.RELAY_API_KEY_PREFIX : "Bearer ",
    RELAY_MODEL: normalizedConfig.RELAY_MODEL || DEFAULT_RELAY_MODEL,
  };
}

function extractModelIds(payload) {
  const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
  return list.map((item) => String(item?.id || "").trim()).filter(Boolean);
}

async function probeModelsEndpoint(baseUrl, authCandidate) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_DETECT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        [authCandidate.header]: authCandidate.value,
      },
      signal: controller.signal,
    });
    const raw = await response.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (response.ok) {
      return {
        ok: true,
        models: extractModelIds(json),
      };
    }

    return {
      ok: false,
      authError: isLikelyAuthError(response.status, json?.error?.message || raw),
      error: json?.error?.message || raw || `Request failed (${response.status})`,
    };
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return {
      ok: false,
      authError: false,
      error: isAbort ? "Request timed out while probing /models." : error?.message || "Request failed.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function autoDetectAiConfig(nextConfig) {
  const normalizedConfig = normalizeAiConfigInput(nextConfig);
  const { baseCandidates, inferredChatPath } = buildBaseUrlCandidates(normalizedConfig.RELAY_BASE_URL);
  const fallbackConfig = buildFallbackAiConfig(normalizedConfig, inferredChatPath, baseCandidates);

  if (!normalizedConfig.RELAY_API_KEY) {
    return {
      resolvedConfig: fallbackConfig,
      probe: {
        ok: false,
        skipped: true,
        reason: "API key is empty, skipped auto-detect.",
      },
    };
  }

  const authCandidates = buildAuthProbeCandidates(
    normalizedConfig.RELAY_API_KEY,
    normalizedConfig.RELAY_API_KEY_HEADER,
    normalizedConfig.RELAY_API_KEY_PREFIX
  );

  let attempts = 0;
  let lastError = "Could not verify the API endpoint automatically.";

  for (const baseUrl of baseCandidates) {
    for (const authCandidate of authCandidates) {
      attempts += 1;
      const probe = await probeModelsEndpoint(baseUrl, authCandidate);
      if (probe.ok) {
        const detectedModel = normalizedConfig.RELAY_MODEL || probe.models[0] || DEFAULT_RELAY_MODEL;
        return {
          resolvedConfig: {
            ...fallbackConfig,
            RELAY_BASE_URL: baseUrl,
            RELAY_API_KEY_HEADER: authCandidate.header,
            RELAY_API_KEY_PREFIX: authCandidate.prefix,
            RELAY_MODEL: detectedModel,
          },
          probe: {
            ok: true,
            attempts,
            baseUrl,
            chatPath: fallbackConfig.RELAY_CHAT_PATH,
            authHeader: authCandidate.header,
            authPrefix: authCandidate.prefix,
            detectedModel,
            modelsCount: probe.models.length,
          },
        };
      }

      lastError = probe.error || lastError;
      if (!probe.authError) {
        break;
      }
    }
  }

  return {
    resolvedConfig: fallbackConfig,
    probe: {
      ok: false,
      skipped: false,
      attempts,
      error: lastError,
    },
  };
}

function ensureDataDirSync() {
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function getWorkspaceStatePathSync() {
  return path.join(ensureDataDirSync(), WORKSPACE_STATE_FILE);
}

function readWorkspaceStateSync() {
  const filePath = getWorkspaceStatePathSync();
  if (!fs.existsSync(filePath)) return {};

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeWorkspaceStateSync(nextState) {
  const filePath = getWorkspaceStatePathSync();
  const safeState = nextState && typeof nextState === "object" && !Array.isArray(nextState) ? nextState : {};
  fs.writeFileSync(filePath, JSON.stringify(safeState, null, 2), "utf8");
  return safeState;
}

function setWorkspaceValueSync(key, value) {
  const safeKey = String(key || "").trim();
  if (!safeKey) {
    return { ok: false, error: "Storage key is empty." };
  }

  const nextState = readWorkspaceStateSync();
  nextState[safeKey] = value;
  writeWorkspaceStateSync(nextState);
  return { ok: true };
}

async function saveAiConfig(nextConfig) {
  const detection = await autoDetectAiConfig(nextConfig);
  const envMap = await readEnvMap();

  for (const key of AI_CONFIG_KEYS) {
    const value = String(detection.resolvedConfig?.[key] || "");
    envMap[key] = value;
    if (value) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }

  await writeEnvMap(envMap);
  return {
    ...(await getAiConfig()),
    _probe: detection.probe,
  };
}

async function openPathTarget(targetPath, { reveal = false } = {}) {
  const safeTarget = String(targetPath || "").trim();
  if (!safeTarget) return { ok: false, error: "Path is empty" };

  const result = reveal ? shell.showItemInFolder(safeTarget) : await shell.openPath(safeTarget);
  if (result && typeof result === "string") {
    return { ok: false, error: result };
  }

  return { ok: true };
}

async function ensureServerStarted() {
  if (serverControl) return serverControl;

  await ensureRuntimeFiles();
  const { startServer } = require(path.join(ROOT_DIR, "server", "appServer.js"));
  serverControl = await startServer({
    port: process.env.PORT || 0,
    host: "127.0.0.1",
  });
  console.log(`[desktop] server ready at ${serverControl.url}`);
  return serverControl;
}

function createAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Config File",
          click: async () => {
            const result = await openPathTarget(runtimeInfo?.envPath, { reveal: true });
            if (!result.ok) {
              dialog.showErrorBox("Open Config Failed", result.error || "Could not open config file.");
            }
          },
        },
        {
          label: "Open Data Folder",
          click: async () => {
            const result = await openPathTarget(runtimeInfo?.dataDir);
            if (!result.ok) {
              dialog.showErrorBox("Open Data Failed", result.error || "Could not open data folder.");
            }
          },
        },
        { type: "separator" },
        { role: "quit", label: "Exit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", label: "Reload" },
        { role: "forceReload", label: "Force Reload" },
        { role: "toggleDevTools", label: "Toggle DevTools" },
        { type: "separator" },
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { role: "togglefullscreen", label: "Toggle Full Screen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    title: PRODUCT_NAME,
    icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    backgroundColor: "#0b1020",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  mainWindow.loadURL(serverUrl);
  console.log(`[desktop] window loading ${serverUrl}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:getRuntimeInfo", async () => runtimeInfo || ensureRuntimeFiles());
  ipcMain.handle("desktop:openConfigFile", async () => openPathTarget(runtimeInfo?.envPath, { reveal: true }));
  ipcMain.handle("desktop:openDataDirectory", async () => openPathTarget(runtimeInfo?.dataDir));
  ipcMain.handle("desktop:getAiConfig", async () => getAiConfig());
  ipcMain.handle("desktop:saveAiConfig", async (_event, nextConfig) => saveAiConfig(nextConfig));
  ipcMain.on("desktop:getWorkspaceStateSync", (event) => {
    event.returnValue = readWorkspaceStateSync();
  });
  ipcMain.on("desktop:setWorkspaceValueSync", (event, payload) => {
    try {
      event.returnValue = setWorkspaceValueSync(payload?.key, payload?.value);
    } catch (error) {
      event.returnValue = { ok: false, error: error?.message || "Workspace state write failed." };
    }
  });
}

async function shutdownServer() {
  if (!serverControl) return;
  try {
    await serverControl.close();
  } catch {
    // Ignore shutdown errors on app exit.
  } finally {
    serverControl = null;
  }
}

async function bootDesktopApp() {
  await ensureRuntimeFiles();
  const server = await ensureServerStarted();
  createAppMenu();
  registerIpcHandlers();
  createMainWindow(server.url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId("com.ai.scheduleplanner.desktop");

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(bootDesktopApp).catch((error) => {
    dialog.showErrorBox("Startup Failed", error?.message || "Unknown startup error");
    app.quit();
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length > 0 || mainWindow) return;
    const server = await ensureServerStarted();
    createMainWindow(server.url);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    shutdownServer().catch(() => {});
  });
}

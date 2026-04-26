const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "asp-server-test-"));
process.env.APP_DATA_DIR = tempDataDir;

const { startServer } = require("../server/appServer");

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function startMockAiServer(handlers) {
  let callIndex = 0;
  const calls = [];

  const server = http.createServer(async (req, res) => {
    const body = await readJsonBody(req);
    calls.push({ url: req.url, body, method: req.method });
    const handler = handlers[Math.min(callIndex, handlers.length - 1)];
    callIndex += 1;
    await handler({ req, res, body, calls, callIndex });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    calls,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

function sendChatJson(res, content) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      model: "mock-model",
      choices: [{ message: { content } }],
      usage: { total_tokens: 42 },
    })
  );
}

function sendChatStream(res, chunks) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    Connection: "keep-alive",
    "Cache-Control": "no-store",
  });

  for (const chunk of chunks) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
  }

  res.end("data: [DONE]\n\n");
}

function parseSseEvents(rawText) {
  return rawText
    .split(/\n\n+/)
    .map((packet) => packet.trim())
    .filter(Boolean)
    .map((packet) => {
      let eventName = "message";
      let dataText = "";

      for (const line of packet.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataText += line.slice(5).trim();
        }
      }

      return {
        event: eventName,
        data: dataText ? JSON.parse(dataText) : null,
      };
    });
}

function configureAiEnv(baseUrl) {
  process.env.RELAY_API_KEY = "test-key";
  process.env.RELAY_BASE_URL = baseUrl;
  process.env.RELAY_MODEL = "mock-model";
  delete process.env.RELAY_CHAT_PATH;
  delete process.env.RELAY_API_KEY_HEADER;
  delete process.env.RELAY_API_KEY_PREFIX;
}

async function withServers(aiHandlers, fn) {
  const mockAi = await startMockAiServer(aiHandlers);
  configureAiEnv(mockAi.url);
  const app = await startServer({ host: "127.0.0.1", port: 0 });

  try {
    return await fn({ app, mockAi });
  } finally {
    await app.close();
    await mockAi.close();
  }
}

test.after(() => {
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});

test("/api/schedule-actions/preview returns structured dry-run results", async () => {
  const app = await startServer({ host: "127.0.0.1", port: 0 });

  try {
    const response = await fetch(`${app.url}/api/schedule-actions/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-04-20",
        dayStart: "08:00",
        dayEnd: "18:00",
        scheduleBlocks: [{ type: "task", title: "Deep Work", start: "10:00", end: "11:00" }],
        actions: [{ type: "remove_block", matchTitle: "Deep Work" }],
      }),
    });

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.result.mode, "preview");
    assert.equal(body.result.summary.byStatus.applied, 1);
    assert.equal(body.result.summary.inputScheduleValid, true);
    assert.equal(body.result.results[0].status, "applied");
    assert.equal(body.result.nextSchedule.appliedCounts.tasks, 0);
  } finally {
    await app.close();
  }
});

test("/api/schedule-actions/apply returns the same shape with apply mode", async () => {
  const app = await startServer({ host: "127.0.0.1", port: 0 });

  try {
    const response = await fetch(`${app.url}/api/schedule-actions/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-04-20",
        dayStart: "08:00",
        dayEnd: "18:00",
        scheduleBlocks: [{ type: "task", title: "Deep Work", start: "10:00", end: "11:00" }],
        actions: [{ type: "move_block", matchTitle: "Deep Work", start: "15:00", end: "16:00" }],
      }),
    });

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.result.mode, "apply");
    assert.equal(body.result.summary.byStatus.applied, 1);
    assert.equal(body.result.nextSchedule.blocks.find((block) => block.title === "Deep Work").start, "15:00");
  } finally {
    await app.close();
  }
});

test("/api/schedule-actions/preview rejects invalid JSON bodies with 400", async () => {
  const app = await startServer({ host: "127.0.0.1", port: 0 });

  try {
    const response = await fetch(`${app.url}/api/schedule-actions/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"date":',
    });

    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.match(body.error, /valid JSON/i);
  } finally {
    await app.close();
  }
});

test("static file server rejects malformed and escaped paths", async () => {
  const app = await startServer({ host: "127.0.0.1", port: 0 });

  try {
    let response = await fetch(`${app.url}/%E0%A4%A`);
    assert.equal(response.status, 400);

    response = await fetch(`${app.url}/%2e%2e%5cserver%5cindex.js`);
    assert.equal(response.status, 403);
  } finally {
    await app.close();
  }
});

test("/api/schedule-actions endpoints return 400 on missing fields and invalid schedule blocks", async () => {
  const app = await startServer({ host: "127.0.0.1", port: 0 });

  try {
    let response = await fetch(`${app.url}/api/schedule-actions/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayStart: "08:00",
        dayEnd: "18:00",
        scheduleBlocks: [],
        actions: [],
      }),
    });
    let body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /date is required/i);

    response = await fetch(`${app.url}/api/schedule-actions/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-04-20",
        dayStart: "08:00",
        dayEnd: "18:00",
        scheduleBlocks: [{ type: "weird", title: "Bad Block", start: "09:00", end: "10:00" }],
        actions: [],
      }),
    });
    body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /unsupported type/i);

    response = await fetch(`${app.url}/api/schedule-actions/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-04-20",
        dayStart: "08:00",
        dayEnd: "18:00",
        scheduleBlocks: "not-an-array",
        actions: [],
      }),
    });
    body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /scheduleBlocks must be an array/i);

    response = await fetch(`${app.url}/api/schedule-actions/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-04-20",
        dayStart: "08:00",
        dayEnd: "18:00",
        scheduleBlocks: [{ type: "task", title: "Bad Time", start: "99:00", end: "10:00" }],
        actions: [],
      }),
    });
    body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /valid time range/i);
  } finally {
    await app.close();
  }
});

test("/api/chat endpoints reject missing messages with 400", async () => {
  const app = await startServer({ host: "127.0.0.1", port: 0 });

  try {
    for (const route of ["/api/chat", "/api/chat/stream"]) {
      const response = await fetch(`${app.url}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      });
      const body = await response.json();
      assert.equal(response.status, 400);
      assert.equal(body.ok, false);
      assert.match(body.error, /messages is required/i);
    }
  } finally {
    await app.close();
  }
});

test("/api/chat returns plain text when upstream has no actions", async () => {
  await withServers([({ res }) => sendChatJson(res, "Keep it simple tonight.")], async ({ app, mockAi }) => {
    const response = await fetch(`${app.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Give me a short pep talk." }],
        context: { planDate: "2026-04-20" },
      }),
    });

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.result.text, "Keep it simple tonight.");
    assert.deepEqual(body.result.actions, []);
    assert.equal(mockAi.calls.length, 1);
  });
});

test("/api/chat accepts RELAY_CHAT_PATH without a leading slash", async () => {
  await withServers([({ res }) => sendChatJson(res, "Path normalized.")], async ({ app, mockAi }) => {
    process.env.RELAY_CHAT_PATH = "chat/completions";

    try {
      const response = await fetch(`${app.url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Give me a short pep talk." }],
          context: { planDate: "2026-04-20" },
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.result.text, "Path normalized.");
      assert.equal(mockAi.calls[0].url, "/chat/completions");
    } finally {
      delete process.env.RELAY_CHAT_PATH;
    }
  });
});

test("/api/chat returns parsed actions when upstream includes a wrapper", async () => {
  await withServers(
    [
      ({ res }) =>
        sendChatJson(
          res,
          'Done.\n<SCHEDULE_ACTIONS_JSON>{"actions":[{"type":"add_task_block","title":"Review","start":"19:00","end":"19:30","category":"study","energy":"medium","priority":4}]}</SCHEDULE_ACTIONS_JSON>'
        ),
    ],
    async ({ app }) => {
      const response = await fetch(`${app.url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Add Review from 19:00 to 19:30 to my schedule." }],
          context: { planDate: "2026-04-20" },
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.result.text, "Done.");
      assert.equal(body.result.actions.length, 1);
      assert.equal(body.result.actions[0].type, "add_task_block");
      assert.equal(body.result.actions[0].title, "Review");
    }
  );
});

test("/api/chat derives an add action from clear Chinese scheduling text when upstream asks for clarification", async () => {
  await withServers(
    [
      ({ res }) => sendChatJson(res, "请告诉我任务或活动名称。"),
      ({ res }) => sendChatJson(res, "{\"actions\":[]}"),
    ],
    async ({ app }) => {
      const response = await fetch(`${app.url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "帮我把复习安排到今天19:00到19:30。" }],
          context: { planDate: "2026-04-20" },
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.match(body.result.text, /复习/);
      assert.equal(body.result.actions.length, 1);
      assert.equal(body.result.actions[0].type, "add_task_block");
      assert.equal(body.result.actions[0].title, "复习");
      assert.equal(body.result.actions[0].start, "19:00");
      assert.equal(body.result.actions[0].end, "19:30");
      assert.equal(body.result.actions[0].category, "study");
    }
  );
});

test("/api/chat stays stable when action payload parsing fails", async () => {
  await withServers(
    [
      ({ res }) => sendChatJson(res, "<SCHEDULE_ACTIONS_JSON>{not valid json}</SCHEDULE_ACTIONS_JSON>"),
      ({ res }) => sendChatJson(res, "{\"actions\":[}"),
    ],
    async ({ app, mockAi }) => {
      const response = await fetch(`${app.url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Move my study block to 19:00 tonight." }],
          context: { planDate: "2026-04-20" },
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.deepEqual(body.result.actions, []);
      assert.match(body.result.text, /could not be parsed safely/i);
      assert.equal(mockAi.calls.length, 2);
    }
  );
});

test("/api/chat/stream derives an add action from clear Chinese scheduling text", async () => {
  await withServers(
    [
      ({ res }) => sendChatStream(res, ["请告诉我任务或活动名称。"]),
      ({ res }) => sendChatJson(res, "{\"actions\":[]}"),
    ],
    async ({ app }) => {
      const response = await fetch(`${app.url}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "把英语作业安排到20:00-21:00。" }],
          context: { planDate: "2026-04-20" },
        }),
      });

      const events = parseSseEvents(await response.text());
      const done = events.find((event) => event.event === "done");
      assert.equal(response.status, 200);
      assert.ok(done);
      assert.match(done.data.result.text, /英语作业/);
      assert.equal(done.data.result.actions.length, 1);
      assert.equal(done.data.result.actions[0].type, "add_task_block");
      assert.equal(done.data.result.actions[0].title, "英语作业");
      assert.equal(done.data.result.actions[0].start, "20:00");
      assert.equal(done.data.result.actions[0].end, "21:00");
      assert.equal(done.data.result.actions[0].category, "study");
    }
  );
});

test("/api/chat/stream returns SSE done event when upstream has no actions", async () => {
  await withServers([({ res }) => sendChatStream(res, ["Focus ", "on one thing."])], async ({ app }) => {
    const response = await fetch(`${app.url}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Give me a short pep talk." }],
        context: { planDate: "2026-04-20" },
      }),
    });

    const events = parseSseEvents(await response.text());
    const done = events.find((event) => event.event === "done");
    assert.equal(response.status, 200);
    assert.ok(done);
    assert.equal(done.data.result.text, "Focus on one thing.");
    assert.deepEqual(done.data.result.actions, []);
  });
});

test("/api/chat/stream returns parsed actions from streamed output", async () => {
  await withServers(
    [
      ({ res }) =>
        sendChatStream(res, [
          "Done.\n",
          '<SCHEDULE_ACTIONS_JSON>{"actions":[{"type":"remove_block","matchTitle":"Email"}]}</SCHEDULE_ACTIONS_JSON>',
        ]),
    ],
    async ({ app }) => {
      const response = await fetch(`${app.url}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Remove Email from my schedule." }],
          context: { planDate: "2026-04-20" },
        }),
      });

      const events = parseSseEvents(await response.text());
      const done = events.find((event) => event.event === "done");
      assert.ok(done);
      assert.equal(done.data.result.text, "Done.");
      assert.equal(done.data.result.actions.length, 1);
      assert.equal(done.data.result.actions[0].type, "remove_block");
      assert.equal(done.data.result.actions[0].matchTitle, "Email");
    }
  );
});

test("/api/chat/stream stays stable when streamed action payload parsing fails", async () => {
  await withServers(
    [
      ({ res }) => sendChatStream(res, ["<SCHEDULE_ACTIONS_JSON>{not valid json}</SCHEDULE_ACTIONS_JSON>"]),
      ({ res }) => sendChatJson(res, "{\"actions\":[}"),
    ],
    async ({ app, mockAi }) => {
      const response = await fetch(`${app.url}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Move my study block to 19:00 tonight." }],
          context: { planDate: "2026-04-20" },
        }),
      });

      const events = parseSseEvents(await response.text());
      const done = events.find((event) => event.event === "done");
      assert.ok(done);
      assert.deepEqual(done.data.result.actions, []);
      assert.match(done.data.result.text, /could not be parsed safely/i);
      assert.equal(mockAi.calls.length, 2);
    }
  );
});

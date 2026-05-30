# AI Schedule Planner MVP

Local web MVP for schedule planning with fixed constraints, recurring tasks, weekly target assignment, visual calendar editing, reminders, and lightweight community.

## Run

```powershell
cd ~\ai-schedule-planner
node .\server\index.js
```

Open:

```text
http://localhost:3000
```

## Desktop App (Windows)

Install dependencies:

```powershell
npm install
```

Run as Windows desktop app:

```powershell
npm run desktop
```

Build a Windows installer:

```powershell
npm run dist:win
```

Run backend tests:

```powershell
npm test
```

Desktop runtime behavior:

- Electron starts the local server internally on `127.0.0.1` with a dynamic port.
- App config is copied to `%APPDATA%\\AI Schedule Planner\\.env` on first run.
- Backend writable data lives in `%APPDATA%\\AI Schedule Planner\\data`.
- Browser-side `localStorage` also stays inside the desktop app profile instead of the repo directory.

## Core Features

- Fixed events + recurring tasks day scheduling
- Weekly target assignment ("N times per week")
- Day view + week preview
- Drag/resize/edit blocks in calendar
- Context menu quick actions
- Night reminder generation
- Share card export (PNG)
- Local community post/like prototype
- Local manual override persistence by day (with rule fingerprint)
- AI chat assistant panel + `/api/chat` backend
- AI chat assistant streaming (`/api/chat/stream`) with auto fallback

## Acceptance Checklist

1. Click `Generate Week`, ensure week preview renders.
2. Right-click empty slot in day view, create one task block.
3. Drag the block to a new time, verify snap hint appears.
4. Force overlap with another block, verify warning/error hint appears.
5. Release drag on invalid range, verify save is blocked.
6. Edit a task block title/time, refresh browser.
7. Confirm local manual adjustment is restored after refresh.
8. Change a rule (e.g. wake time / fixed event), regenerate, verify old override does not incorrectly apply.
9. Open AI Assistant panel, send a message, verify response or clear config error.

## AI API Setup

Server endpoint: `POST /api/chat`

Expected request body:

```json
{
  "messages": [
    { "role": "user", "content": "Help me plan tonight in 2 hours" }
  ],
  "context": {
    "planDate": "2026-04-16",
    "wakeTime": "07:30",
    "bedtime": "23:30"
  }
}
```

Relay-first env vars:

- `RELAY_API_KEY` (required)
- `RELAY_BASE_URL` (required, e.g. `https://your-relay.example.com/v1`)
- `RELAY_MODEL` (required, depends on your relay/provider)
- `RELAY_CHAT_PATH` (optional, default `/chat/completions`)
- `RELAY_API_KEY_HEADER` (optional, default `Authorization`)
- `RELAY_API_KEY_PREFIX` (optional, default `Bearer `)
- `RELAY_TIMEOUT_MS` (optional, default `30000`, clamped to `1000`-`120000`)

Legacy fallback env vars are still supported:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`

PowerShell example:

```powershell
$env:RELAY_API_KEY="<your_relay_key>"
$env:RELAY_BASE_URL="https://your-relay.example.com/v1"
$env:RELAY_MODEL="<your_model_name>"
node .\server\index.js
```

For the desktop build, edit the generated `%APPDATA%\\AI Schedule Planner\\.env` file instead.

Streaming endpoint: `POST /api/chat/stream` (`text/event-stream`)

SSE event types:

- `meta`: provider/model metadata
- `token`: incremental text chunk (`{ "token": "..." }`)
- `done`: final payload (`{ "result": { "text": "...", "actions": [...] } }`)
- `error`: stream failure payload (`{ "error": "..." }`)

Schedule action endpoints:

- `POST /api/schedule-actions/preview`
- `POST /api/schedule-actions/apply`

Expected request body:

```json
{
  "date": "2026-04-16",
  "dayStart": "07:30",
  "dayEnd": "23:30",
  "scheduleBlocks": [
    { "type": "task", "title": "Deep Work", "start": "10:00", "end": "11:00" },
    { "type": "fixed", "title": "Class", "start": "13:00", "end": "14:00", "bufferMin": 15 }
  ],
  "actions": [
    { "type": "move_block", "matchTitle": "Deep Work", "start": "15:00", "end": "16:00" }
  ]
}
```

Response highlights:

- `normalizedActions`: normalized action inputs plus per-action normalization errors
- `results`: per-action validation result with `applied` / `skipped` / `ambiguous` / `conflict` / `invalid`
- `nextSchedule`: schedule snapshot after applying only successful actions in order

Contract notes:

- `preview` and `apply` are both stateless compute endpoints. They do not persist changes on the server.
- `apply` currently differs only by `mode: "apply"` and future extension space; it still returns a computed `nextSchedule`.
- `move_block` and `remove_block` execute only when `matchTitle` has exactly one exact title match in the current task blocks.
- Substring or fuzzy matches may be returned as diagnostics, but they are never used as the execution target.

## Implementation Notes

- Frontend chat history is stored in `localStorage` key: `asp.chatHistory`.
- Day-level manual overrides are stored in `asp.localDayOverrides`.
- Overrides are only reused when rule fingerprint matches current constraints/tasks.
- Backend AI client lives in `server/aiClient.js`.

## Near-Term Backend Order

Recommended next increments:

1. Finish backend action validation / dry-run polish and wire future clients to consume it.
2. Keep expanding backend tests around schedule rules and AI action edge cases.
3. Add chat memory scopes (today / this week / global preferences).
4. Defer frontend integration until the backend contract is stable enough to consume directly.

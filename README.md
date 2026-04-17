# AI Schedule Planner MVP

Local web MVP for schedule planning with fixed constraints, recurring tasks, weekly target assignment, visual calendar editing, reminders, and lightweight community.

## Run

```powershell
cd D:\Programming\ai-schedule-planner
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

## Implementation Notes

- Frontend chat history is stored in `localStorage` key: `asp.chatHistory`.
- Day-level manual overrides are stored in `asp.localDayOverrides`.
- Overrides are only reused when rule fingerprint matches current constraints/tasks.
- Backend AI client lives in `server/aiClient.js`.

## Next Step (AI Conversation UI)

Recommended next increments:

1. Add richer structured tool mode for schedule operations (e.g., stricter slot validation, conflict-aware edits).
2. Add chat memory scopes (today / this week / global preferences).
3. Add explicit "apply AI suggestion" safety checks (preview conflicts before commit).

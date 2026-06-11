# Security Stream

An AI dispatch coordinator for physical security operations. Guards carry GPS and wearable sensors, and patrol robots stream location/telemetry/alert data; an LLM agent monitors these event streams in real time, reasons about threats, and takes direct actions — messaging guards, broadcasting alerts, escalating to police, or redirecting a robot. The ops manager closes the loop by marking incident outcomes, which feed back into the AI's context for future decisions.

## Running

```bash
# Pick a scenario
npm run start:berghain      # nightclub, 4 guards, peak hours
npm run start:festival      # outdoor festival, 8000 capacity
npm run start:construction  # overnight construction patrol
npm run start:warehouse     # overnight logistics center, 2 guards + 2 patrol robots

# Frontend (separate terminal)
cd frontend && npm run dev
```

Requires a `.env` in `backend/`:
```
LLM_PROVIDER=claude          # or ollama
ANTHROPIC_API_KEY=sk-...     # if using claude
OLLAMA_MODEL=llama3.2        # if using ollama
```

Dashboard at `http://localhost:5173`, simulator at `http://localhost:5173/#/sim`.

## How it works

**Event pipeline:** Simulator emits GPS, wearable, message, and panic events for guards, plus `robot_gps`, `robot_telemetry`, and `robot_alert` events for patrol robots. Wearable events above threshold (HR > 160, running, fall) and all messages/panics trigger an AI decision for guards; robot telemetry that drops below 20% battery or reports a fault, plus all robot alerts, trigger an AI decision for robots. On boot, each guard and robot emits one initial GPS/telemetry reading at its starting zone — even while paused — so the map and shift panel show positions immediately.

**AI context per decision:** guard profile, recent wearable history, last GPS location, per-guard memo (AI-written, rewritten each decision), shift memo (overall shift state), venue history (persistent across shifts). Robots get an analogous context — model/capability profile, recent battery/status telemetry, last GPS location, and a per-robot memo.

**Actions the AI can take:** `message_guard`, `broadcast_alert`, `call_police`, `dispatch_robot`, `investigate`, `monitor`, `dismiss`. Message and broadcast actions are sent to guards in real time and appear in the Dispatch Log and Messages feed. `dispatch_robot` redirects a robot unit (via `dispatch_robot_id`) and logs the instruction the same way.

**Feedback loop:** Every dispatched action creates an open incident (orange dot in Dispatch Log). The ops manager marks outcomes — Resolved, False alarm, or Escalated — which writes a venue note into the AI's permanent context. Future decisions at the same venue include these outcomes.

**Memory layers:**
- Per-guard memo — behavioral assessment, rewritten after each decision for that guard
- Shift memo — overall shift state snapshot, rewritten after every decision
- Venue history — outcome notes that persist across shifts, read-only in AI context

## Stack

- **Backend:** Node.js, Fastify, SQLite (node:sqlite), SSE for real-time broadcast
- **Frontend:** React, Vite, Tailwind, shadcn/ui, Leaflet
- **AI:** Anthropic Claude (JSON schema tool use) or Ollama (local)
- **Routing:** wouter with hash routing (`/#/sim`)

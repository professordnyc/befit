# Decisions – Befit

This file captures key product and technical decisions over time.

## 2025-02-27

- Initialized Befit project structure (AGENTS.md, .goosehints, Befit recipe, env files).

## 2026-02-28

- Scaffolded Python FastAPI backend (`backend/`) wired to the `today_card` response shape.
  - `backend/schemas.py` – Pydantic models: `DetectedItem`, `RiskFlag`, `Action`, `TodayCard`, `ScanAndPlanRequest`.
  - `backend/main.py` – FastAPI app with `POST /scan-and-plan` and `GET /health` endpoints.
  - `backend/agents/planner.py` – Orchestrator implementing the AGENTS.md hierarchical pattern.
  - `backend/agents/vision_interpreter.py` – Multimodal LLM agent for item detection.
  - `backend/agents/context_interpreter.py` – LLM agent for parsing user intent.
  - `backend/agents/risk_checker.py` – Pure-Python rule-based risk flag generator (no LLM).
  - `backend/agents/plan_writer.py` – LLM agent for drafting the Today's Plan card.
  - `backend/agents/reflector.py` – LLM agent for safety and clarity review.
- Scaffolded responsive mobile-first web UI (`frontend/`):
  - `frontend/index.html` – Upload/camera, query input, optional context, Today's Plan card.
  - `frontend/style.css` – Warm, non-clinical design with full accessibility support.
  - `frontend/app.js` – Fetch pipeline, drag-and-drop, card rendering, reset flow.
- Added `env.example` for environment variable documentation.
- Added `start.bat` for one-click local dev launch.
- Chose OpenRouter + Anthropic Claude 3.5 Sonnet as default model (configurable via `BEFIT_MODEL`).
- Chose FastAPI + uvicorn as the backend framework (async-native, matches Python preference).
- Frontend is served as static files from the same FastAPI origin (no separate dev server required).

## 2026-03-03

- Removed `env.example` for environment variable documentation.
- Use `.env.example` for environment variable documentation with updated API details.
- Risk Checker subagent (risk_checker.py) remains deterministic over LLM-based risk reasoning for safety, auditability, and alignment.
- OpenRouter + Anthropic Claude Sonnet 4.6 as default model instead of deprecated model (Claude Sonnet 3.5).
- Goose Opus-4.6 Sonnet-4.6 Lead-Worker configuration disabled to conserve tokens until bug is patched in Goose v1.26.x.
- Deployment: Netlify and Render with Postgres.
- Run Befit locally with uvicorn (`uv run uvicorn backend.main:app --reload`); do not rely on platform-specific scripts like start.bat.

## 2026-03-04

### Fix: Agents now directly answer the user's literal question

**Problem observed:** A voice query "can I eat these raw or should I cook them first?" returned
micro-actions suggesting ways to add the detected items to meals, without ever answering the
question. The root cause was a data-flow gap across three agents:

1. **Context Interpreter** parsed the query into a structured intent (goal/person/constraints)
   but **discarded the verbatim question**, so downstream agents never saw what was actually asked.
2. **Plan Writer** generated 2-3 micro-actions tied to items and inferred goal, with no instruction
   to answer a concrete question first.
3. **Reflector** checked safety, grounding, and disclaimers but never verified whether the question
   was answered.

**Fix applied (four files):**
- `backend/agents/context_interpreter.py` – Added `user_question` field to the intent schema
  and to the fallback dict; `setdefault` ensures the verbatim query is always propagated.
- `backend/agents/plan_writer.py` – New "ANSWER THE QUESTION FIRST" rule in `SYSTEM_PROMPT`
  requires the first action to directly address `intent.user_question`; a worked raw-vs-cooked
  example is included.
- `backend/agents/reflector.py` – Accepts `intent: dict` (new parameter); includes
  `user_question` in its LLM payload; adds a 6th review check that the question is answered.
- `backend/agents/planner.py` – Passes `intent` to `reflector.run()`.

**Tests added:** `tests/test_question_answering.py` (5 tests, all passing):
- Unit: ContextInterpreter preserves user_question (happy path + JSON-parse fallback)
- Unit: PlanWriter first action contains raw/cook vocabulary
- Integration: full pipeline (fake client) produces a direct answer
- Guard: confirms a generic plan that ignores the question would fail the check

## 2026-03-05

### Feature: ElevenLabs TTS audio output with voice command control

**Rationale:** README.md specifies ElevenLabs for TTS; AGENTS.md assigns the Planner
responsibility for coordinating audio output (TTS) as part of the scan-and-plan flow;
LIMITATIONS.md documents "Audio output is for convenience only."

**Files changed (5):**

- `backend/main.py` – Added `POST /tts` endpoint. Accepts `{ text }`, proxies to
  ElevenLabs `eleven_turbo_v2`, returns `audio/mpeg`. `ELEVENLABS_API_KEY` and
  `ELEVENLABS_VOICE_ID` read server-side only; never sent to the browser. Text capped
  at 2500 chars (ElevenLabs free-tier per-request limit). Uses `httpx` (transitive dep
  of `openai`; no new packages). Route registered before static file mount to prevent
  404 shadowing.

- `frontend/index.html` – Added `#tts-bar` player bar inside `#today-card` with
  Listen / Pause / Stop / Restart buttons and an `aria-live` status span. Bar hidden
  until a plan renders; button visibility driven by JS state machine.

- `frontend/app.js` – Full TTS module added inline:
  - `buildTtsScript(card)` – narrates goal_summary + actions + why; limitations
    excluded (visual-only per LIMITATIONS.md).
  - `ttsPlay / ttsPause / ttsStop / ttsRestart / ttsReset` – `HTMLAudioElement`
    state machine backed by a Blob URL from `/tts` response.
  - `updateTtsUI(state)` – hidden | loading | playing | paused | idle.
  - Dedicated `cmdRecognition` instance (`continuous: true`, `interimResults: false`)
    for TTS voice commands, fully independent of the query mic. Activates on
    `ttsAudio.onplay`, deactivates on end/error/stop. Auto-restarts while TTS is active.
  - **Bug fixed:** voice commands failed during playback because the original design
    routed them through the query mic (`continuous: false`), which stopped after each
    utterance and was never restarted. Replaced with the dedicated continuous session.

- `frontend/style.css` – Rewrote file from clean source after a prior write corrupted
  it with viewer line-number prefixes, breaking all page CSS. TTS bar styles use
  existing design tokens; tap targets ≥ 44 px; icon-only labels below 420 px.

- `tests/test_tts_endpoint.py` – 5 tests: 200 happy path, 400 empty text, 503 missing
  key (patches module-level constant directly), 502 upstream error, 2500-char truncation.
  All passing.

**New env vars:** `ELEVENLABS_API_KEY` (required, server-side only), `ELEVENLABS_VOICE_ID` (optional, defaults to Rachel `21m00Tcm4TlvDq8ikWAM`).
**No new packages.** `httpx` 0.28.1 already present as a transitive dependency.

## 2026-03-04

### Feature: Live camera frame capture

**Rationale:** AGENTS.md Vision Interpreter spec states it must "take in uploaded or live video frame and mobile camera input." README.md lists live-frame handling as a key feature. This replaces the tap-to-upload area with an active camera feed that starts on page load.

**Files changed (3, frontend only — backend unchanged):**

- `frontend/index.html` – Replaced static upload area with a `<video>` live camera feed (`#camera-container`) plus a "Capture" button, a "Switch camera" button (shown only when multiple cameras are detected), a captured/uploaded preview block (`#preview-container`) with a "Retake" overlay button, a camera error banner, and an "Upload image" fallback label that is always visible.

- `frontend/app.js` – Added camera module:
  - `initCamera()` – enumerates videoinput devices, shows "Switch camera" if > 1, calls `startCamera()`.
  - `startCamera(deviceId)` – requests `facingMode: environment` (rear) by default; falls back to any camera if no deviceId given; sets `<video>.srcObject`.
  - `captureFrame()` – draws `<video>` frame onto an off-screen `<canvas>`, encodes as JPEG base-64 (quality 0.85), stops the stream, shows preview. Same `imageDataUri` path used by existing upload flow.
  - `retake()` – clears captured image and restarts camera.
  - File upload listener updated to stop stream before showing preview.
  - Full reset (`btn-reset`) now calls `initCamera()` to restart the feed.
  - No backend changes required; `/scan-and-plan` already accepts base-64 `image_url`.

- `frontend/style.css` – Appended camera-specific rules using existing design tokens: `.camera-container`, `.camera-feed`, `.camera-overlay`, `.camera-hint`, `.camera-controls`, `.btn-capture` (≥ 48 px tap target), `.btn-icon-sm` (switch camera, ≥ 44 px), `.preview-container`, `.btn-retake`, `.camera-error`, `.upload-toolbar`, `.btn-upload-label`.

**No new packages, no backend changes, no API key changes.**

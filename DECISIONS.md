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

## 2026-03-04

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

**Rationale:** AGENTS.md Vision Interpreter spec requires "live video frame and mobile camera
input." This replaces the static tap-to-upload area with an active camera feed on page load.

**Files changed (3, frontend only — backend unchanged):**

- `frontend/index.html` – Replaced upload area with `<video>` live feed (`#camera-container`),
  Capture button, Switch camera button (shown only when > 1 camera detected), captured/uploaded
  preview block (`#preview-container`) with Retake overlay button, camera error banner, and
  always-visible "Upload image" fallback.

- `frontend/app.js` – Added camera module:
  - `initCamera()` – enumerates videoinput devices; shows Switch button if > 1; calls `startCamera()`.
  - `startCamera(deviceId)` – requests `facingMode: environment` (rear) by default; sets `<video>.srcObject`.
  - `captureFrame()` – draws video frame to off-screen `<canvas>`, encodes JPEG base-64 (quality 0.85),
    stops stream, shows preview. Uses the same `imageDataUri` path as file upload.
  - `retake()` – clears capture and restarts camera.
  - Full reset (`btn-reset`) calls `initCamera()` to restart the feed.

- `frontend/style.css` – Appended camera rules using existing design tokens: hint pill (top-left,
  frosted glass), controls bar (bottom gradient scrim, Capture right-aligned, ≥ 48 px tap target),
  preview container, Retake overlay button, camera error banner, upload toolbar/fallback label.

**No new packages, no backend changes, no API key changes.**

### Fix: Camera hint and Capture button layout collision

**Problem:** Both the hint text and Capture button were positioned in the bottom area of the
camera feed, overlapping at narrow widths.

**Fix:** Moved hint text to a frosted-glass pill in the top-left corner. Camera controls bar
now spans the full bottom edge with a gradient scrim; Capture button is right-aligned inside it.
Also changed toggle focus ring from `:focus-within` to `:has(input:focus-visible)` so the
accent-colour outline only appears on keyboard navigation, not on page load or mouse focus.

**File changed:** `frontend/style.css` only.

### Fix: Voice input disabled after camera permission grant (Chromium)

**Problem:** `initSpeech()` and `initCamera()` were called in parallel at boot.
When `getUserMedia` resolved and Chromium updated the page's permission context,
any `SpeechRecognition` instance created before that moment was silently invalidated —
leaving the mic button unresponsive with no visible error.

**Fix:** Deferred `initSpeech()` until `initCamera()` resolves:

```js
// Before
initSpeech();
initCamera();

// After
initCamera().then(initSpeech);
```

**File changed:** `frontend/app.js` (boot section only).

### Diagnostic: camera-test.html (temporary, now removed)

A self-contained `/camera-test` page was added to diagnose camera and microphone permission
issues. It tested `getUserMedia` (video + audio), device enumeration, track state, and a live
`SpeechRecognition` round-trip. Confirmed working; route and file removed after testing.
`backend/main.py` route and `frontend/camera-test.html` both deleted before final commit.

### Fix: TTS voice commands broken after camera permission grant

**Problem:** The TTS command listener used a second `SpeechRecognition` instance
(`cmdRecognition`, `continuous: true`). Chromium will not run two recognition
instances concurrently — they share the same mic resource. When `ttsAudio.onplay`
called `cmdRecognition.start()`, Chromium silently blocked it because the query-mic
instance (`recognition`) had not fully released the mic. No error was raised; voice
commands simply never fired.

**Fix:** Removed `cmdRecognition` entirely. The single `recognition` instance is
now mode-switched by a `ttsListening` boolean:
- `ttsListening = false` → `onresult` routes to query textarea (normal input).
- `ttsListening = true`  → `onresult` routes to TTS command dispatch.
- `startCmdListener()` sets `ttsListening = true`, stops the query mic, then starts `recognition`.
- After each command the listener re-arms itself while audio is still active.
- `stopCmdListener()` clears the flag and stops recognition.

**File changed:** `frontend/app.js` — state declarations, `initSpeech`,
`startCmdListener`, `stopCmdListener`, `recognition.onresult`, `recognition.onend`.

### Feature: TTS player bar UI clarity + "listen" voice command

**Problem:** The UI gave no indication of which words could be spoken to control
playback, and the "Restart" button label did not match any intuitive spoken command.

**Changes:**
- `btn-tts-play` (resume): label → **Play**, icon → ▶️, aria-label includes *"say: play"*.
- `btn-tts-restart` (from beginning): label → **Listen**, class → `tts-btn--listen`
  (accent colour), aria-label includes *"say: listen"*.
- Pause / Stop aria-labels include *"say: pause"* / *"say: stop"*.
- Added `.tts-voice-hint` span: *"Say: listen • play • pause • stop"* always visible
  in the player bar; hidden on screens ≤ 420 px.
- Voice command `'listen'` (and legacy `'restart'`) both trigger `ttsRestart()`.

**Files changed:** `frontend/index.html`, `frontend/app.js`, `frontend/style.css`.
## 2026-03-04

### Feature: Auto-capture toggle for live camera

**Rationale:** Users needed a choice between manual capture (tap Capture button) and automatic
frame capture (hands-free). Caregivers and users holding items benefit from auto-capture.

**Changes (2 files, frontend only — backend unchanged):**

- `frontend/index.html` – Added `.upload-header` row containing the card title and a new
  "Auto-capture" toggle (`#toggle-auto-capture`) using the existing toggle design system.
  The toggle is positioned top-right of the camera section heading.

- `frontend/app.js` – Added auto-capture module:
  - `autoCapture` boolean mirrors the toggle state.
  - `startAutoCountdown()` – 3-second setInterval countdown; updates the camera hint pill
    (`#camera-hint`) each second ("Auto-capture in 3s…", "…2s…", "…1s…") then calls
    `captureFrame()`. Countdown resets whenever the camera restarts.
  - `cancelAutoCountdown()` – clears the interval and resets the hint text.
  - `toggleAutoCapture` change listener – enables/disables auto mode; hides the manual
    Capture button in auto mode; starts countdown immediately if camera is live.
  - Manual capture (`captureFrame`) and file upload both call `cancelAutoCountdown()` to
    prevent a race condition between user action and timer.
  - Full reset calls `initCamera()` which respects the current `autoCapture` state.

**No new packages, no backend changes, no API key changes.**

### Feature: WebSpeech API TTS fallback

**Rationale:** ElevenLabs credits can be exhausted; the app should remain fully functional
(including audio readout) without requiring an API key. WebSpeech API (`window.speechSynthesis`)
is available in all modern browsers at no cost.

**Trigger condition:** `POST /tts` returns HTTP 502 or 503 (ElevenLabs unavailable or key
not configured). The browser detects this and silently switches to WebSpeech.

**Changes (3 files):**

- `frontend/app.js` – Added `ttsUsingWebSpeech` boolean flag and four WebSpeech helpers:
  - `webSpeechPlay(text)` – creates `SpeechSynthesisUtterance`, wires `onstart/onend/onerror/
    onpause/onresume` to the existing `updateTtsUI` state machine and `startCmdListener`.
  - `webSpeechPause / webSpeechResume / webSpeechStop` – thin wrappers around
    `speechSynthesis.pause/resume/cancel`.
  - `ttsPlay` checks `res.status === 502 || 503` before throwing; on match it calls
    `webSpeechPlay(ttsText)` and returns early.
  - `ttsPause / ttsStop / ttsRestart / ttsReset` each branch on `ttsUsingWebSpeech` to
    route to the correct backend.
  - Voice commands re-arm correctly for both backends (`ttsAudio.ended` check extended
    with `|| ttsUsingWebSpeech`).

- `backend/main.py` – Updated `/tts` endpoint docstring to note the 503 → WebSpeech
  fallback contract so future developers understand why the 503 is meaningful.

- `.env.example` – Added `# ── TTS fallback` section documenting:
  - Default behaviour (503 → browser WebSpeech, no config required).
  - `FORCE_WEBSPEECH_TTS=false` placeholder for a future opt-in server flag.


## 2026-03-05

### Fix: Pydantic v1 compatibility — `.model_dump()` → `.dict()`

**Problem:** Three tests in `tests/test_question_answering.py` failed with:
```
AttributeError: 'DetectedItem' object has no attribute 'model_dump'
```
The project pins **Pydantic 1.10.15** (see `pyproject.toml`).
`.model_dump()` is a Pydantic **v2** API; Pydantic v1 exposes `.dict()`.
`plan_writer.py` and `reflector.py` were calling the v2 method, causing
`AttributeError` at runtime and in tests whenever a `DetectedItem` or
`RiskFlag` was serialised.

**Fix (2 files):**

- `backend/agents/plan_writer.py` – `items_payload` and `flags_payload`
  list-comprehensions changed from `.model_dump()` to `.dict()`.
- `backend/agents/reflector.py` – `detected_items` and `risk_flags`
  list-comprehensions in the payload dict changed from `.model_dump()` to `.dict()`.

**Result:** All 10 tests pass (`3 fixed + 7 previously passing`).
Ruff and Black checks remain clean.

### Fix: Render deployment — missing `--host` / `--port` in `render.yaml`

**Problem:** `render.yaml` `startCommand` was:
```
uv run uvicorn backend.main:app
```
Render requires the server to bind to `0.0.0.0` and the dynamic `$PORT`
environment variable it injects. Without these flags uvicorn defaults to
`127.0.0.1:8000`, which is unreachable from Render's load balancer, causing
the health check to time out and the deployment to fail.

The correct command was already documented in both `Procfile` and `DEPLOYMENT.md`
but had never been applied to `render.yaml`.

Additionally `preDeployCommand` was `uv sync` (runtime deps only); changed to
`uv sync --all-groups` so dev/test dependencies (pytest, ruff, black) are
available during Render's build step if CI is run there.

**Fix (1 file):**

- `render.yaml` – `startCommand` updated to:
  `uv run uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
  `preDeployCommand` updated to: `uv sync --all-groups`

**No new packages, no schema changes, no frontend changes.**

## 2026-03-05

### Fix: Pin Python 3.12 + upgrade to Pydantic v2 + modern dependency set

**Problem:** Render defaults to Python 3.14. All pinned packages — Pydantic 1.10.15,
FastAPI 0.104.1, uvicorn 0.24.0, openai 1.3.7, httpx 0.25.2 — have no Python 3.14
wheels and their C extensions do not compile on 3.14. Render's `PYTHON_VERSION`
env var in `render.yaml` is not respected by the `runtime: python` build system;
a `.python-version` file is required.

**Root error:** `pydantic.errors.ConfigError: unable to infer type for attribute "name"`
(Pydantic 1.10.15 C extension failing on Python 3.14 at import time.)

**Fix (5 files):**

- `.python-version` *(new)* — pins `3.12`; read by both `uv` and Render's build
  system before the venv is created. This is the canonical way to select the Python
  runtime when using `uv` on Render.
- `pyproject.toml` — upgraded all deps to Python 3.12-compatible versions with Pydantic v2:
  `pydantic 1.10.15 → 2.11.1`, `fastapi 0.104.1 → 0.115.12`, `uvicorn 0.24.0 → 0.34.0`,
  `openai 1.3.7 → 1.70.0`, `httpx 0.25.2 → 0.28.1`, `python-dotenv 1.0.0 → 1.1.0`,
  `pytest 7.4.3 → 8.3.5`, `pytest-asyncio 0.21.1 → 0.25.3`, `pytest-cov 4.1.0 → 6.1.0`,
  `black 23.12.0 → 25.1.0`, `ruff 0.7.0 → 0.11.2`. Added `asyncio_mode = "auto"`.
  Tightened `requires-python` to `>=3.10,<3.15`.
- `uv.lock` — regenerated for Python 3.12 + new dep set.
- `backend/agents/plan_writer.py`, `backend/agents/reflector.py` — restored
  `.model_dump()` (correct for Pydantic v2); removed stale v1 compatibility comment.

**All 10 tests pass on Python 3.12. Ruff + Black clean.**

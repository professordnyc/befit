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
- Use `.env.example` for environment variable documentation with updated API details
- Risk Checker subagent (risk_checker.py) remains deterministic over LLM‑based risk reasoning for safety, auditability, and alignment. 
- OpenRouter _ Anthropic Claude Sonnet 4.6 as default model instead of deprecated model (Claude Sonnet 3.5)
- Goose Opus-4.6 Sonnet-4.6 Lead-Worker configuration disabled to conserve tokens until bug is patched in Goose v1.26.x
- Deployment: Netlify and Render with Postgres
- Run Befit locally with uvicorn (uv run uvicorn backend.main:app --reload); do not rely on platform‑specific scripts like start.bat.



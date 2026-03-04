"""
main.py – Befit FastAPI backend.

Endpoints:
  POST /scan-and-plan  – run the full Befit agent pipeline, return TodayCard JSON
  GET  /health         – liveness check
  GET  /               – serve frontend index.html
  GET  /style.css      – serve frontend stylesheet
  GET  /app.js         – serve frontend script

Configuration is read from environment variables (or a .env file via python-dotenv):
  OPENAI_API_KEY   – required (use your OpenRouter key or OpenAI key)
  OPENAI_BASE_URL  – optional, defaults to https://openrouter.ai/api/v1
  BEFIT_MODEL      – optional, defaults to anthropic/claude-sonnet-4-6
  ALLOWED_ORIGINS  – optional comma-separated CORS origins, defaults to *
"""

from __future__ import annotations
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from openai import AsyncOpenAI

from .schemas import TodayCard, ScanAndPlanRequest
from .agents import planner

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY", "")
BASE_URL = os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
MODEL = os.getenv("BEFIT_MODEL", "anthropic/claude-sonnet-4-6")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

if not API_KEY:
    logger.warning("OPENAI_API_KEY is not set — LLM calls will fail at runtime.")

# ---------------------------------------------------------------------------
# OpenAI-compatible async client
# ---------------------------------------------------------------------------
client = AsyncOpenAI(api_key=API_KEY or "placeholder", base_url=BASE_URL)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Befit API",
    description="Goose-powered wellness assistant — scan and plan endpoint.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Frontend path
# ---------------------------------------------------------------------------
FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend")
)

# ---------------------------------------------------------------------------
# API routes  (must be declared BEFORE the catch-all static mount)
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Liveness check."""
    return {"status": "ok", "model": MODEL}


@app.post("/scan-and-plan", response_model=TodayCard)
async def scan_and_plan(body: ScanAndPlanRequest) -> TodayCard:
    """
    Run the full Befit agent pipeline and return a today_card JSON object.
    """
    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured on the server.",
        )

    try:
        card = await planner.run(
            client=client,
            image_url=body.image_url,
            user_query=body.user_query,
            user_context=body.user_context,
            model=MODEL,
        )
    except Exception as exc:
        logger.exception("scan-and-plan pipeline failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Pipeline error: {exc}") from exc

    return card


# ---------------------------------------------------------------------------
# Frontend static file routes
# Explicit named routes ensure correct MIME types; the StaticFiles mount
# below serves everything else (favicons, images, etc.)
# ---------------------------------------------------------------------------

if os.path.isdir(FRONTEND_DIR):
    logger.info("Serving frontend from %s", FRONTEND_DIR)

    @app.get("/", include_in_schema=False)
    async def root():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/style.css", include_in_schema=False)
    async def stylesheet():
        return FileResponse(
            os.path.join(FRONTEND_DIR, "style.css"),
            media_type="text/css",
        )

    @app.get("/app.js", include_in_schema=False)
    async def script():
        return FileResponse(
            os.path.join(FRONTEND_DIR, "app.js"),
            media_type="application/javascript",
        )

    # Remaining static assets (fonts, images, etc.)
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIR),
        name="assets",
    )
else:
    logger.warning("Frontend directory not found at %s", FRONTEND_DIR)

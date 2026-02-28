"""
main.py – Befit FastAPI backend.

Endpoints:
  POST /scan-and-plan  – run the full Befit agent pipeline, return TodayCard JSON
  GET  /health         – liveness check

Configuration is read from environment variables (or a .env file via python-dotenv):
  OPENAI_API_KEY   – required (use your OpenRouter key or OpenAI key)
  OPENAI_BASE_URL  – optional, defaults to https://openrouter.ai/api/v1
  BEFIT_MODEL      – optional, defaults to anthropic/claude-3-5-sonnet
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
MODEL = os.getenv("BEFIT_MODEL", "anthropic/claude-3-5-sonnet")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

if not API_KEY:
    logger.warning("OPENAI_API_KEY is not set — LLM calls will fail at runtime.")

# ---------------------------------------------------------------------------
# OpenAI-compatible async client
# ---------------------------------------------------------------------------
client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)

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
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Liveness check."""
    return {"status": "ok", "model": MODEL}


@app.post("/scan-and-plan", response_model=TodayCard)
async def scan_and_plan(body: ScanAndPlanRequest) -> TodayCard:
    """
    Run the full Befit agent pipeline:
      Vision Interpreter → Context Interpreter → Risk Checker →
      Plan Writer → Reflector → TodayCard

    Returns a today_card JSON object.
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
# Serve frontend static files (production convenience)
# ---------------------------------------------------------------------------
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

    @app.get("/")
    async def root():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

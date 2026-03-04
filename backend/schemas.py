"""
schemas.py – Pydantic models for Befit's today_card response shape.

Matches the shape documented in README.md and befit_scan_and_plan.yaml.
"""

from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class DetectedItem(BaseModel):
    """A single item identified by the Vision Interpreter."""

    name: str
    category: str
    notes: Optional[str] = None


class RiskFlag(BaseModel):
    """A single rule-based wellness flag from the Risk Checker."""

    level: str  # "info" | "warning" | "caution"
    message: str


class Action(BaseModel):
    """A single micro-action from the Plan Writer."""

    title: str
    description: str


# ---------------------------------------------------------------------------
# Root response shape
# ---------------------------------------------------------------------------


class TodayCard(BaseModel):
    """
    The canonical today_card response returned by the /scan-and-plan endpoint.

    All fields map 1-to-1 to the shape in README.md and befit_scan_and_plan.yaml.
    """

    items_detected: List[DetectedItem]
    goal_summary: str
    risk_flags: List[RiskFlag]
    actions: List[Action]
    why: str
    limitations: str


# ---------------------------------------------------------------------------
# Request body
# ---------------------------------------------------------------------------


class ScanAndPlanRequest(BaseModel):
    """
    Input accepted by POST /scan-and-plan.

    image_url  – publicly accessible URL or a base-64 data URI.
    user_query – natural language question from the user.
    user_context – optional JSON-serialisable dict with goal, person, constraints.
    """

    image_url: str
    user_query: str
    user_context: Optional[dict] = None

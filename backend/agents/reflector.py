"""
reflector.py – Reflector agent.

Reviews the Plan Writer's draft for safety, clarity, and alignment with
Befit's documented limitations before the card is returned to the user.

Constraints (from AGENTS.md):
  - When in doubt about safety, prefer to soften or remove advice.
  - Must ensure disclaimers are present and prominent.
  - Must not introduce new claims beyond what was detected and flagged.
"""

from __future__ import annotations
import json
import re
import logging
from typing import List

from openai import AsyncOpenAI
from ..schemas import DetectedItem, RiskFlag

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Befit Reflector — a safety and quality reviewer for wellness guidance.

You will receive:
  - A draft Today's Plan card (goal_summary, actions, why, limitations).
  - The detected items that informed the plan.
  - The risk flags raised by the Risk Checker.

Your job is to review and improve the draft so that:
  1. No action prescribes dosages, diagnoses conditions, or handles emergencies.
  2. All actions are grounded in the detected items (no invented ingredients).
  3. The "limitations" field is prominent and accurate.
  4. Language is warm, empathetic, and non-judgmental.
  5. Any over-confident or unsafe claims are softened or removed.

Return the REVISED draft as a JSON object with exactly the same keys:
  goal_summary, actions (each with title + description), why, limitations.

If the draft is already safe and clear, return it unchanged.
Return ONLY valid JSON — no markdown fences, no prose outside the JSON."""


async def run(
    client: AsyncOpenAI,
    draft: dict,
    items: List[DetectedItem],
    risk_flags: List[RiskFlag],
    model: str,
) -> dict:
    """
    Review and refine the Plan Writer draft.

    Returns the revised dict with the same shape as the draft.
    """
    logger.info("Reflector: reviewing draft plan")

    payload = json.dumps({
        "draft": draft,
        "detected_items": [i.model_dump() for i in items],
        "risk_flags": [f.model_dump() for f in risk_flags],
    }, indent=2)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": payload},
        ],
        max_tokens=1024,
        temperature=0.2,
    )

    raw = response.choices[0].message.content or "{}"
    raw = re.sub(r"```[a-zA-Z]*\n?", "", raw).strip().rstrip("`").strip()

    try:
        revised = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Reflector: could not parse JSON, returning original draft. Raw: %s", raw[:300])
        revised = draft

    logger.info("Reflector: review complete")
    return revised

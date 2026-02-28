"""
planner.py – Befit Planner (orchestrator).

Implements the hierarchical planner–worker–reflector pattern from AGENTS.md:

  1. Vision Interpreter  → DetectedItem list
  2. Context Interpreter → intent dict
  3. Risk Checker        → RiskFlag list   (pure Python, no LLM call)
  4. Plan Writer         → draft today_card fields
  5. Reflector           → refined today_card fields
  6. Assemble & return   → TodayCard

No agent calls another agent directly — all coordination happens here.
"""

from __future__ import annotations
import logging
from typing import Optional

from openai import AsyncOpenAI

from ..schemas import TodayCard, Action
from . import vision_interpreter, context_interpreter, risk_checker, plan_writer, reflector

logger = logging.getLogger(__name__)


async def run(
    client: AsyncOpenAI,
    image_url: str,
    user_query: str,
    user_context: Optional[dict],
    model: str,
) -> TodayCard:
    """
    Orchestrate the full Befit scan-and-plan workflow.

    Parameters
    ----------
    client       : Async OpenAI-compatible client.
    image_url    : Image path or URL for the Vision Interpreter.
    user_query   : Raw user question.
    user_context : Optional pre-structured context dict.
    model        : LLM model identifier.

    Returns
    -------
    TodayCard  – the canonical today_card response object.
    """
    logger.info("Planner: starting scan-and-plan workflow")

    # Step 1 – Vision Interpreter
    logger.info("Planner: step 1 – Vision Interpreter")
    items = await vision_interpreter.run(client, image_url, model)

    # Step 2 – Context Interpreter
    logger.info("Planner: step 2 – Context Interpreter")
    intent = await context_interpreter.run(client, user_query, user_context, model)

    # Step 3 – Risk Checker (synchronous, rule-based)
    logger.info("Planner: step 3 – Risk Checker")
    flags = risk_checker.run(items, intent)

    # Step 4 – Plan Writer
    logger.info("Planner: step 4 – Plan Writer")
    draft = await plan_writer.run(client, items, intent, flags, model)

    # Step 5 – Reflector
    logger.info("Planner: step 5 – Reflector")
    refined = await reflector.run(client, draft, items, flags, model)

    # Step 6 – Assemble TodayCard
    logger.info("Planner: step 6 – assembling TodayCard")

    # Parse actions safely
    raw_actions = refined.get("actions", draft.get("actions", []))
    actions = []
    for a in raw_actions:
        try:
            actions.append(Action(**a))
        except Exception as exc:
            logger.warning("Planner: skipping malformed action %s – %s", a, exc)

    today_card = TodayCard(
        items_detected=items,
        goal_summary=refined.get("goal_summary", draft.get("goal_summary", "")),
        risk_flags=flags,
        actions=actions,
        why=refined.get("why", draft.get("why", "")),
        limitations=refined.get("limitations", draft.get("limitations", "")),
    )

    logger.info("Planner: workflow complete")
    return today_card

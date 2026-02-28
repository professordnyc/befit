"""
plan_writer.py – Plan Writer agent.

Turns detected items, intent, and risk flags into a draft Today's Plan card
with 2-3 concrete micro-actions, a "Why" section, and limitations text.

Constraints (from AGENTS.md):
  - Avoid prescriptive dosing or diagnostic language.
  - Keep guidance specific to what was detected and user-stated goals.
  - Use empathetic, non-judgmental tone suited to women and caregivers.
"""

from __future__ import annotations
import json
import re
import logging
from typing import List

from openai import AsyncOpenAI
from ..schemas import DetectedItem, RiskFlag, Action

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Befit Plan Writer — an empathetic wellness assistant for women and caregivers.

Given:
  - A list of items detected at home (pantry, fridge, or medicine cabinet).
  - A parsed wellness intent (goal, person, constraints).
  - A list of risk flags from the Befit Risk Checker.

Your job is to produce a draft Today's Plan JSON object with these exact keys:
  - goal_summary: one sentence describing what this plan addresses (string)
  - actions: array of 2-3 objects, each with "title" (short label) and "description" (1-2 sentence actionable step)
  - why: 2-3 sentences explaining the rationale in plain, non-clinical language (string)
  - limitations: 1-2 sentences about what this plan does NOT cover (string)

Rules:
  - Base every action on items actually detected — never invent ingredients or products.
  - Do NOT prescribe dosages or diagnose conditions.
  - Do NOT handle emergencies — if any action could relate to an emergency, replace it with "Call your local emergency services."
  - Use warm, non-judgmental language. Avoid shame or diet-culture framing.
  - Keep actions simple and achievable for today.
  - Return ONLY valid JSON — no markdown fences, no prose outside the JSON.

Example output:
{
  "goal_summary": "Simple steps to support blood pressure using what you already have at home.",
  "actions": [
    {
      "title": "Choose the low-sodium soup",
      "description": "If you have both regular and low-sodium tomato soup, reach for the low-sodium version at lunch today. Every milligram of sodium saved adds up."
    },
    {
      "title": "Swap one sugary drink for water",
      "description": "Replace one soda or juice today with a glass of water or unsweetened herbal tea. Staying hydrated supports healthy blood pressure."
    }
  ],
  "why": "High sodium intake is one of the most modifiable risk factors for elevated blood pressure. Reducing it even slightly each day can make a meaningful difference over time.",
  "limitations": "This plan is based only on items visible in your image and your stated goal. It is not a medical treatment plan — please consult your doctor for personalised guidance."
}"""


async def run(
    client: AsyncOpenAI,
    items: List[DetectedItem],
    intent: dict,
    risk_flags: List[RiskFlag],
    model: str,
) -> dict:
    """
    Draft a Today's Plan card.

    Returns a dict with keys: goal_summary, actions, why, limitations.
    """
    logger.info("PlanWriter: drafting today's plan")

    items_payload = [i.model_dump() for i in items]
    flags_payload = [f.model_dump() for f in risk_flags]

    user_message = json.dumps({
        "detected_items": items_payload,
        "intent": intent,
        "risk_flags": flags_payload,
    }, indent=2)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=1024,
        temperature=0.4,
    )

    raw = response.choices[0].message.content or "{}"
    raw = re.sub(r"```[a-zA-Z]*\n?", "", raw).strip().rstrip("`").strip()

    try:
        draft = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("PlanWriter: could not parse JSON. Raw: %s", raw[:300])
        draft = {
            "goal_summary": intent.get("goal", "general health").capitalize() + " support.",
            "actions": [
                {
                    "title": "Review your pantry items",
                    "description": "Take a moment to check the items identified in your scan and consider which are most aligned with your wellness goal.",
                }
            ],
            "why": "We were unable to generate a detailed plan from the image at this time.",
            "limitations": "This plan is not a medical treatment. Please consult a healthcare professional for personalised advice.",
        }

    logger.info("PlanWriter: draft complete")
    return draft

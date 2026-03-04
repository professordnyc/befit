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
from ..schemas import DetectedItem, RiskFlag

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Befit Plan Writer — an empathetic wellness assistant for women and caregivers.

Given:
  - A list of items detected at home (pantry, fridge, or medicine cabinet).
  - A parsed wellness intent (goal, person, constraints, and user_question — the verbatim question the user asked).
  - A list of risk flags from the Befit Risk Checker.

Your job is to produce a draft Today's Plan JSON object with these exact keys:
  - goal_summary: one sentence describing what this plan addresses (string)
  - actions: array of 2-3 objects, each with "title" (short label) and "description" (1-2 sentence actionable step)
  - why: 2-3 sentences explaining the rationale in plain, non-clinical language (string)
  - limitations: 1-2 sentences about what this plan does NOT cover (string)

Critical rule — ANSWER THE QUESTION FIRST:
  - The intent object contains a "user_question" field with exactly what the user asked.
  - Your FIRST action must directly and specifically answer that question based on the detected items.
  - If the question is "can I eat these raw or should I cook them first?" — answer that directly: name the specific items detected and say whether they are safe raw, safer cooked, or require cooking.
  - Never substitute a generic tip when the user asked a concrete question.
  - After answering the question, you may add 1-2 supporting micro-actions tied to items and goals.

Additional rules:
  - Base every action on items actually detected — never invent ingredients or products.
  - Do NOT prescribe dosages or diagnose conditions.
  - Do NOT handle emergencies — if any action could relate to an emergency, replace it with "Call your local emergency services."
  - Use warm, non-judgmental language. Avoid shame or diet-culture framing.
  - Keep actions simple and achievable for today.
  - Return ONLY valid JSON — no markdown fences, no prose outside the JSON.

Example output when user_question is "can I eat these raw or should I cook them first?":
{
  "goal_summary": "Helping you safely enjoy the fresh produce you have at home.",
  "actions": [
    {
      "title": "Raw vs. cooked: what's safe with what you have",
      "description": "Based on what we detected: spinach and cherry tomatoes are safe to eat raw and are nutritious either way. The chicken breast and green beans are best cooked through before eating — raw chicken carries food-safety risks, and lightly steaming green beans improves digestibility."
    },
    {
      "title": "Quick safe prep for the chicken",
      "description": "Cook chicken to an internal temperature of 165°F (74°C). A simple pan-sear or bake works well and takes about 20 minutes."
    }
  ],
  "why": "Some foods are nutritious and safe raw; others carry food-safety or digestibility concerns when uncooked. Knowing which is which helps you eat confidently and safely.",
  "limitations": "This plan is based only on items visible in your image. It is not a medical or food-safety certification — when in doubt, cook it through and consult a nutrition professional."
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

    user_message = json.dumps(
        {
            "detected_items": items_payload,
            "intent": intent,
            "risk_flags": flags_payload,
        },
        indent=2,
    )

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

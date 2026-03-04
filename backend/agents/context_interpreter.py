"""
context_interpreter.py – Context Interpreter agent.

Parses the user's natural-language query (and optional structured context)
into a compact intent dict used by downstream agents.

Constraints (from AGENTS.md):
  - Do NOT assume medical history beyond what the user explicitly provides.
  - When information is missing, use conservative defaults and note them.
"""

from __future__ import annotations
import json
import re
import logging
from typing import Optional

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Befit Context Interpreter.
Given the user's question and any optional context, return a JSON object with:
  - goal: primary wellness goal (e.g. "blood pressure", "energy", "weight management", "general health")
  - person: who the advice is for ("self", "elder", "family", "unknown")
  - constraints: list of relevant constraints explicitly mentioned (e.g. ["vegetarian", "low-sodium"])
  - notes: any conservative assumptions you had to make because info was missing
  - user_question: the user's original question, copied verbatim (string)

Rules:
  - Do NOT invent medical history.
  - When unsure, set person to "unknown" and goal to "general health".
  - Return ONLY valid JSON — no markdown fences, no prose.

Example:
{
  "goal": "blood pressure",
  "person": "self",
  "constraints": ["low-sodium"],
  "notes": "No allergy info provided; assumed none.",
  "user_question": "What should I eat today to help my blood pressure?"
}"""


async def run(
    client: AsyncOpenAI,
    user_query: str,
    user_context: Optional[dict],
    model: str,
) -> dict:
    """
    Interpret the user's query into a structured intent object.

    Parameters
    ----------
    client       : Async OpenAI-compatible client.
    user_query   : Raw natural-language question from the user.
    user_context : Optional pre-structured dict (goal, person, constraints).
    model        : Model identifier.
    """
    logger.info("ContextInterpreter: parsing user query")

    context_snippet = ""
    if user_context:
        context_snippet = f"\n\nAdditional context provided by the app:\n{json.dumps(user_context, indent=2)}"

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"User question: {user_query}{context_snippet}",
            },
        ],
        max_tokens=512,
        temperature=0.2,
    )

    raw = response.choices[0].message.content or "{}"
    raw = re.sub(r"```[a-zA-Z]*\n?", "", raw).strip().rstrip("`").strip()

    try:
        intent = json.loads(raw)
        # Always preserve the verbatim user question so downstream agents can answer it directly
        intent.setdefault("user_question", user_query)
    except json.JSONDecodeError:
        logger.warning("ContextInterpreter: could not parse JSON, using defaults. Raw: %s", raw[:200])
        intent = {
            "goal": "general health",
            "person": "unknown",
            "constraints": [],
            "notes": "Could not parse intent; conservative defaults applied.",
            "user_question": user_query,
        }

    logger.info("ContextInterpreter: intent = %s", intent)
    return intent

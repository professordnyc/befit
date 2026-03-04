"""
vision_interpreter.py – Vision Interpreter agent.

Sends an image to a multimodal LLM and returns a structured list of
DetectedItem objects (name, category, optional notes).

Constraints (from AGENTS.md):
  - Mark uncertain items as "unknown" or "ambiguous".
  - Do NOT infer exact dosages or medical conditions from packaging.
"""

from __future__ import annotations
import json
import re
import logging
from typing import List

from openai import AsyncOpenAI
from ..schemas import DetectedItem

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Befit Vision Interpreter.
Your only job is to look at the provided image and return a JSON array of items
visible in the photo (fridge, pantry, medicine cabinet, or similar).

Each item must have:
  - name: short descriptive label (e.g. "canned tomato soup", "ibuprofen 200 mg bottle")
  - category: one of [whole grain, protein, dairy, produce, canned soup,
      canned vegetable, canned fruit, snack, sugary drink, beverage,
      cooking oil, condiment, spice, NSAID, antihistamine, vitamin/supplement,
      prescription medication, personal care, cleaning product, unknown]
  - notes: (optional) any salient observation such as "low-sodium", "expired", "many present"

Rules:
  - If you are uncertain, set category to "unknown" and add a note "ambiguous".
  - Do NOT infer medical diagnoses, exact dosages, or drug interactions.
  - Return ONLY valid JSON — no markdown fences, no prose.

Example output:
[
  {"name": "canned tomato soup", "category": "canned soup", "notes": "high-sodium label visible"},
  {"name": "ibuprofen bottle", "category": "NSAID", "notes": null}
]"""


async def run(client: AsyncOpenAI, image_url: str, model: str) -> List[DetectedItem]:
    """
    Call the multimodal model with the image and parse the response.

    Parameters
    ----------
    client    : Async OpenAI-compatible client (may point at OpenRouter).
    image_url : Public URL or base-64 data URI of the image.
    model     : Model identifier (e.g. "anthropic/claude-3-5-sonnet").
    """
    logger.info("VisionInterpreter: analysing image %s", image_url[:60])

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url},
                    },
                    {
                        "type": "text",
                        "text": "Please list every item you can identify in this image.",
                    },
                ],
            },
        ],
        max_tokens=1024,
        temperature=0.2,
    )

    raw = response.choices[0].message.content or "[]"

    # Strip accidental markdown fences
    raw = re.sub(r"```[a-zA-Z]*\n?", "", raw).strip().rstrip("`").strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning(
            "VisionInterpreter: could not parse JSON, returning empty list. Raw: %s", raw[:200]
        )
        data = []

    items = []
    for entry in data:
        try:
            items.append(DetectedItem(**entry))
        except Exception as exc:
            logger.warning("VisionInterpreter: skipping malformed item %s – %s", entry, exc)

    logger.info("VisionInterpreter: detected %d items", len(items))
    return items

"""
risk_checker.py – Risk Checker agent.

Applies simple, transparent rule-based checks to the detected items + intent
and returns a list of RiskFlag objects.

Constraints (from AGENTS.md):
  - Use only the knowledge rules defined here (no ad-hoc medical advice).
  - Be explicit about what is NOT assessed.
  - Never perform drug–drug interaction analysis.
"""

from __future__ import annotations
import logging
from typing import List

from ..schemas import DetectedItem, RiskFlag

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rule tables
# ---------------------------------------------------------------------------

# Categories that indicate high-sodium patterns when multiple are present
HIGH_SODIUM_CATEGORIES = {"canned soup", "canned vegetable", "condiment"}

# Categories that are NSAIDs / pain relievers
NSAID_CATEGORIES = {"NSAID"}

# Categories considered sugary / low-nutrient beverages
SUGARY_DRINK_CATEGORIES = {"sugary drink"}

# Minimum count to trigger a pattern flag
MULTI_THRESHOLD = 3  # e.g. 3+ canned soups → flag


def run(items: List[DetectedItem], intent: dict) -> List[RiskFlag]:
    """
    Apply rule-based checks and return flags.

    Parameters
    ----------
    items  : Structured list from Vision Interpreter.
    intent : Parsed intent dict from Context Interpreter.
    """
    flags: List[RiskFlag] = []

    # Count categories
    category_counts: dict[str, int] = {}
    for item in items:
        cat = (item.category or "").lower().strip()
        category_counts[cat] = category_counts.get(cat, 0) + 1

    # --- Rule 1: Multiple high-sodium canned/processed foods ---
    high_sodium_count = sum(category_counts.get(c, 0) for c in HIGH_SODIUM_CATEGORIES)
    if high_sodium_count >= MULTI_THRESHOLD:
        flags.append(
            RiskFlag(
                level="warning",
                message=(
                    f"We noticed {high_sodium_count} high-sodium items (canned soups, "
                    "vegetables, or condiments). If your goal involves blood pressure "
                    "or heart health, consider choosing low-sodium or no-salt-added versions."
                ),
            )
        )
    elif high_sodium_count >= 1 and intent.get("goal") in ("blood pressure",):
        flags.append(
            RiskFlag(
                level="info",
                message=(
                    "Some canned or processed items detected may be high in sodium. "
                    "Check labels if blood pressure is a concern."
                ),
            )
        )

    # --- Rule 2: Multiple NSAID products ---
    nsaid_count = sum(category_counts.get(c, 0) for c in NSAID_CATEGORIES)
    if nsaid_count >= 2:
        flags.append(
            RiskFlag(
                level="caution",
                message=(
                    f"{nsaid_count} NSAID/pain-reliever products detected. "
                    "Using multiple NSAIDs simultaneously can increase the risk of side effects. "
                    "Please consult a pharmacist or clinician before combining them."
                ),
            )
        )
    elif nsaid_count == 1:
        flags.append(
            RiskFlag(
                level="info",
                message=(
                    "An NSAID or pain reliever was detected. "
                    "Befit does not assess drug interactions — consult a pharmacist if you have questions."
                ),
            )
        )

    # --- Rule 3: Sugary beverages pattern ---
    sugary_count = sum(category_counts.get(c, 0) for c in SUGARY_DRINK_CATEGORIES)
    if sugary_count >= MULTI_THRESHOLD:
        flags.append(
            RiskFlag(
                level="warning",
                message=(
                    f"{sugary_count} sugary beverages detected. "
                    "High sugar-drink intake is linked to energy crashes, weight gain, and blood-sugar spikes. "
                    "Swapping one per day for water or unsweetened tea is a simple first step."
                ),
            )
        )

    # --- Rule 4: Unknown / ambiguous items note ---
    unknown_count = category_counts.get("unknown", 0)
    if unknown_count > 0:
        flags.append(
            RiskFlag(
                level="info",
                message=(
                    f"{unknown_count} item(s) could not be clearly identified from the image. "
                    "Befit has excluded them from recommendations."
                ),
            )
        )

    # --- Standing limitation flag (always present) ---
    flags.append(
        RiskFlag(
            level="info",
            message=(
                "Befit's risk check is rule-based and does not perform comprehensive "
                "drug–drug interaction analysis or medical diagnosis. "
                "Consult a qualified healthcare professional for personalised advice."
            ),
        )
    )

    logger.info("RiskChecker: %d flag(s) generated", len(flags))
    return flags

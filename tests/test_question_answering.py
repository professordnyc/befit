"""
tests/test_question_answering.py - Regression test for direct question answering.

Tests that a concrete user question like "can I eat these raw or should I cook them first?"
is directly answered in the first action of the Today's Plan, rather than being replaced
by generic wellness tips.

Root cause that prompted this test (2025):
  The Context Interpreter was discarding the verbatim user question; the Plan Writer and
  Reflector only received an inferred goal (e.g. "general health"), so specific questions
  were never answered directly.

Fix applied:
  - context_interpreter.py: preserves user_question in the intent dict
  - plan_writer.py:          SYSTEM_PROMPT requires first action to answer user_question
  - reflector.py:            receives intent + checks that user_question is answered
  - planner.py:              passes intent to reflector.run()
"""

from __future__ import annotations
import json
import types
import pytest


# ---------------------------------------------------------------------------
# Minimal async fake for the OpenAI client
# ---------------------------------------------------------------------------

def _make_fake_client(responses: list):
    """
    Return an async OpenAI-like client whose chat.completions.create()
    cycles through the provided response strings in order.
    """
    call_index = {"n": 0}

    async def fake_create(**kwargs):
        idx = call_index["n"] % len(responses)
        call_index["n"] += 1
        msg = types.SimpleNamespace(content=responses[idx])
        choice = types.SimpleNamespace(message=msg)
        return types.SimpleNamespace(choices=[choice])

    completions = types.SimpleNamespace(create=fake_create)
    chat = types.SimpleNamespace(completions=completions)
    return types.SimpleNamespace(chat=chat)


# ---------------------------------------------------------------------------
# Shared fixtures / constants
# ---------------------------------------------------------------------------

RAW_QUESTION = "can I eat these raw or should I cook them first?"

FAKE_ITEMS_JSON = json.dumps([
    {"name": "spinach",        "category": "produce", "notes": None},
    {"name": "chicken breast", "category": "protein", "notes": None},
    {"name": "green beans",    "category": "produce", "notes": None},
])

FAKE_INTENT_JSON = json.dumps({
    "goal":          "general health",
    "person":        "self",
    "constraints":   [],
    "notes":         "No specific constraints provided.",
    "user_question": RAW_QUESTION,
})

FAKE_PLAN_JSON = json.dumps({
    "goal_summary": "Helping you safely prepare the fresh items you have at home.",
    "actions": [
        {
            "title": "Raw vs. cooked: what's safe with what you have",
            "description": (
                "Spinach and washed raw vegetables are safe to eat raw. "
                "Chicken breast must be cooked to 165 F (74 C) before eating -- "
                "raw poultry carries serious food-safety risks. "
                "Green beans are best lightly steamed."
            ),
        },
        {
            "title": "Quick pan-cook for the chicken",
            "description": (
                "Season and pan-sear the chicken on medium-high heat "
                "for about 6-7 minutes per side until cooked through."
            ),
        },
    ],
    "why": (
        "Some foods are perfectly safe and nutritious raw; others pose food-safety "
        "risks if not cooked. Knowing which is which lets you eat confidently from "
        "what you already have."
    ),
    "limitations": (
        "This guidance is based on items visible in the image only. "
        "It is not a food-safety certification -- when in doubt, cook it through."
    ),
})

# Reflector echoes the plan unchanged (it already answers the question)
FAKE_REFLECTOR_JSON = FAKE_PLAN_JSON


# ---------------------------------------------------------------------------
# Unit test: ContextInterpreter preserves user_question
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_context_interpreter_preserves_user_question():
    """intent dict must contain user_question equal to the raw query."""
    from backend.agents import context_interpreter

    client = _make_fake_client([FAKE_INTENT_JSON])
    intent = await context_interpreter.run(client, RAW_QUESTION, None, "test-model")

    assert "user_question" in intent, (
        "context_interpreter.run() must include 'user_question' in the returned intent dict"
    )
    assert intent["user_question"] == RAW_QUESTION, (
        f"user_question should be the verbatim query; got: {intent['user_question']!r}"
    )


@pytest.mark.asyncio
async def test_context_interpreter_fallback_preserves_user_question():
    """Even on JSON parse failure, user_question must be set from the raw query."""
    from backend.agents import context_interpreter

    client = _make_fake_client(["not valid json at all"])
    intent = await context_interpreter.run(client, RAW_QUESTION, None, "test-model")

    assert intent.get("user_question") == RAW_QUESTION, (
        "Fallback intent must still carry user_question from the raw query"
    )


# ---------------------------------------------------------------------------
# Unit test: PlanWriter first action answers the question
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_plan_writer_first_action_answers_question():
    """
    The first action in the plan must contain language that directly addresses
    the user's specific question ('raw', 'cook', or 'cooked').
    """
    from backend.agents import plan_writer
    from backend.schemas import DetectedItem, RiskFlag

    items = [
        DetectedItem(name="spinach",        category="produce"),
        DetectedItem(name="chicken breast", category="protein"),
        DetectedItem(name="green beans",    category="produce"),
    ]
    intent = {
        "goal":          "general health",
        "person":        "self",
        "constraints":   [],
        "notes":         "",
        "user_question": RAW_QUESTION,
    }

    client = _make_fake_client([FAKE_PLAN_JSON])
    draft = await plan_writer.run(client, items, intent, [], "test-model")

    assert draft.get("actions"), "Plan must contain at least one action"
    first_action = draft["actions"][0]
    action_text = (
        first_action.get("title", "") + " " + first_action.get("description", "")
    ).lower()

    question_terms = {"raw", "cook", "cooked", "cooking"}
    matched = question_terms & set(action_text.split())
    assert matched, (
        f"First action should directly address 'raw vs. cooked' but got: {action_text!r}. "
        f"Expected at least one of {question_terms} in the text."
    )


# ---------------------------------------------------------------------------
# Integration test: full pipeline produces a direct answer
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pipeline_answers_question_directly():
    """
    End-to-end: with the fake client the final TodayCard's first action
    must directly answer the raw/cooked question -- not be a generic tip.
    """
    from backend.agents import planner

    # Fake client cycles: vision -> context -> plan -> reflector
    client = _make_fake_client([
        FAKE_ITEMS_JSON,       # vision_interpreter
        FAKE_INTENT_JSON,      # context_interpreter
        FAKE_PLAN_JSON,        # plan_writer
        FAKE_REFLECTOR_JSON,   # reflector
    ])

    card = await planner.run(
        client=client,
        image_url="data:image/png;base64,fake",
        user_query=RAW_QUESTION,
        user_context=None,
        model="test-model",
    )

    assert card.actions, "TodayCard must have at least one action"
    first = card.actions[0]
    action_text = (first.title + " " + first.description).lower()

    question_terms = {"raw", "cook", "cooked", "cooking"}
    matched = question_terms & set(action_text.split())
    assert matched, (
        f"Expected the first action to address raw/cook. Got: {action_text!r}"
    )


# ---------------------------------------------------------------------------
# Regression: generic-tip response must FAIL the check (guard test)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generic_tip_fails_question_check():
    """
    Confirms that a plan that ignores the question (old behaviour) would
    fail the direct-answer check -- i.e. our assertion is meaningful.
    """
    generic_plan = json.dumps({
        "goal_summary": "Simple steps to improve your general health.",
        "actions": [
            {
                "title": "Add spinach to your next meal",
                "description": (
                    "Toss some spinach into a smoothie or salad "
                    "for an easy nutrient boost."
                ),
            },
            {
                "title": "Include more protein",
                "description": (
                    "Chicken breast is a great lean protein -- "
                    "try it in a stir-fry tonight."
                ),
            },
        ],
        "why":         "Eating a variety of whole foods supports overall health.",
        "limitations": "This is not medical advice.",
    })

    from backend.agents import plan_writer
    from backend.schemas import DetectedItem

    items = [
        DetectedItem(name="spinach",        category="produce"),
        DetectedItem(name="chicken breast", category="protein"),
    ]
    intent = {
        "goal":          "general health",
        "person":        "self",
        "constraints":   [],
        "notes":         "",
        "user_question": RAW_QUESTION,
    }

    client = _make_fake_client([generic_plan])
    draft = await plan_writer.run(client, items, intent, [], "test-model")

    first_action = draft["actions"][0]
    action_text = (
        first_action.get("title", "") + " " + first_action.get("description", "")
    ).lower()

    question_terms = {"raw", "cook", "cooked", "cooking"}
    matched = question_terms & set(action_text.split())

    # This SHOULD be empty -- the generic plan does not answer the question
    assert not matched, (
        "Guard test: a generic plan should NOT contain raw/cook terms. "
        f"Found {matched} in {action_text!r} -- the guard test itself is wrong."
    )

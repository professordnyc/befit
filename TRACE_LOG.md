# TRACE_LOG.md – Befit

> **Purpose:** Captures illustrative traces of human–AI collaboration during Befit's development.
> Each trace shows the human prompt or decision, the AI action taken, and how the output
> was reviewed, accepted, or revised. Linked to EVIDENCE_LOG.md and DECISIONS.md for grounding.

---

## What is a trace?

A trace records one round of human–AI collaboration: the human's intent or prompt,
what Goose (the AI) produced, and what the human did next (accepted, revised, rejected,
or iterated). Traces show that the human remained in the loop at every meaningful step.

---

## Trace 1 — Project scaffolding (2026-02-28)

| Field | Detail |
|-------|--------|
| **Date** | 2026-02-28 |
| **Human intent** | Bootstrap the full Befit backend and frontend from an AGENTS.md spec and a recipe YAML |
| **Prompt (paraphrased)** | *"Scaffold a FastAPI backend with the six agents defined in AGENTS.md, a Pydantic schema for TodayCard, and a responsive mobile-first frontend"* |
| **AI action** | Generated `backend/main.py`, `backend/schemas.py`, all six agent files under `backend/agents/`, `frontend/index.html`, `frontend/style.css`, `frontend/app.js`, and `.env.example` in a single pass |
| **Human review** | Accepted the structure; decided to keep the Risk Checker deterministic (pure Python, no LLM) for auditability — recorded in DECISIONS.md |
| **Evidence** | DECISIONS.md § 2026-02-28; AGENTS.md agent list |

**Why this matters:** The AI turned a design document (AGENTS.md) into working code; the human made a deliberate safety trade-off (deterministic risk checker) that the AI did not propose on its own.

---

## Trace 2 — Bug: agents ignored the user's literal question (2026-03-04)

| Field | Detail |
|-------|--------|
| **Date** | 2026-03-04 |
| **Human intent** | Fix a data-flow gap where a voice query ("can I eat these raw or should I cook them first?") returned generic micro-actions without answering the question |
| **Human diagnosis** | Identified three root causes: Context Interpreter discarded the verbatim question; Plan Writer had no rule to answer it first; Reflector had no check that the question was answered |
| **Prompt (paraphrased)** | *"Fix the pipeline so the first action always directly answers the user's literal question. Add `user_question` to the intent schema, add an ANSWER THE QUESTION FIRST rule to PlanWriter, pass intent to Reflector, and add a question-answered check"* |
| **AI action** | Applied targeted edits to four files (`context_interpreter.py`, `plan_writer.py`, `reflector.py`, `planner.py`) and generated five tests in `tests/test_question_answering.py` |
| **Human review** | Ran tests; all 5 passed; accepted the fix |
| **Evidence** | DECISIONS.md § 2026-03-04 "Fix: Agents now directly answer the user's literal question"; EVIDENCE_LOG.md § run 2 (raw-vs-cooked scenario) |

**Why this matters:** The human observed unexpected behaviour in a real interaction, diagnosed the root cause across multiple agents, and directed a surgical multi-file fix — the AI executed the implementation.

---

## Trace 3 — Feature: ElevenLabs TTS with voice command control (2026-03-04)

| Field | Detail |
|-------|--------|
| **Date** | 2026-03-04 |
| **Human intent** | Add audio readout of the Today's Plan card with voice commands (listen, play, pause, stop); keep the API key server-side only |
| **Prompt (paraphrased)** | *"Add a POST /tts endpoint proxying ElevenLabs, a player bar in the frontend, and a dedicated continuous SpeechRecognition instance for voice commands"* |
| **AI action** | Added `/tts` endpoint in `backend/main.py`, `#tts-bar` UI in `index.html`, full TTS state machine + voice command dispatch in `app.js`, TTS bar styles in `style.css`, and five tests in `tests/test_tts_endpoint.py` |
| **Human review** | Tested; found that voice commands failed because `continuous: false` stopped after each utterance. Human identified the cause and asked AI to replace the dedicated instance with a single mode-switched recogniser (`ttsListening` boolean) |
| **Outcome** | AI refactored to shared-instance pattern; issue resolved |
| **Evidence** | DECISIONS.md § 2026-03-04 "Feature: ElevenLabs TTS" and "Fix: TTS voice commands broken after camera permission grant" |

**Why this matters:** The human caught a design flaw (two competing mic instances) through real-device testing and directed the architectural simplification — the AI implemented both the initial version and the corrected design.

---

## Trace 4 — Fix: CSS file corruption and camera layout collision (2026-03-04)

| Field | Detail |
|-------|--------|
| **Date** | 2026-03-04 |
| **Human intent** | Fix a broken page layout after `style.css` was corrupted with line-number prefixes from a viewer tool |
| **Human diagnosis** | Page CSS broke entirely; root cause was line-number artifacts inserted into the file by a tool |
| **Prompt (paraphrased)** | *"Rewrite style.css from clean source; move hint text to a top-left frosted-glass pill; camera controls bar to bottom edge; fix toggle focus ring to keyboard-only"* |
| **AI action** | Rewrote `frontend/style.css` from clean source; applied layout corrections; resolved hint/button collision in the same pass |
| **Human review** | Accepted |
| **Evidence** | DECISIONS.md § 2026-03-04 "Fix: Camera hint and Capture button layout collision" |

**Why this matters:** A tooling artifact (not an AI error) broke the file; the human caught it visually during testing and directed the repair.

---

## Trace 5 — Android TTS debugging cycle (2026-03-06)

| Field | Detail |
|-------|--------|
| **Date** | 2026-03-06 |
| **Human intent** | Resolve audio unavailable on Android 12 and dead voice commands on Android 16 after deployment |
| **Human input** | Real-device testing on Android 12 and 16; Perplexity-assisted research into Android Chrome gesture-token and recognition cool-down behaviour |
| **Iteration count** | 5 fix rounds (v1–v5) over one day |
| **AI actions per round** | Analysed execution paths, proposed targeted edits to `frontend/app.js`, updated tests in `tests/test_android_tts.html` |
| **Key human decisions** | (v3) Moved pre-unlock before `await runPipeline()` — human identified gesture-token window was being missed after network I/O; (v5) narrowed root cause to spurious synchronous `onend` from `recognition.stop()` on an already-idle instance — one-line `if (isListening)` guard was the definitive fix |
| **Evidence** | DECISIONS.md § 2026-03-06 v1–v5; EVIDENCE_LOG.md § 2026-03-06 v2–v5; RISK_LOG.md Android entries; LIMITATIONS.md Android TTS notes |

**Why this matters:** Five human-directed debugging iterations on real hardware; the AI acted as implementation and analysis partner in each round. The decisive diagnosis came from the human.

---

## Trace 6 — Safety guardrail: mandatory Reflector agent (design decision)

| Field | Detail |
|-------|--------|
| **Date** | 2026-02-28 (design); reinforced 2026-03-04 |
| **Human intent** | Ensure no user-facing wellness output bypasses a safety review |
| **Design choice** | Every plan must pass through the Reflector agent before being returned — not optional, not skippable |
| **AI role** | Implemented Reflector as the sixth agent; integrated mandatory call in `planner.py`; updated Reflector to also verify the user's question was answered (2026-03-04) |
| **Human guardrails added** | LIMITATIONS.md (no diagnoses, no dosing, no emergencies); RISK_LOG.md (known risks); Reflector checks: unsafe claims, missing disclaimers, unanswered questions |
| **Evidence** | AGENTS.md § Reflector; LIMITATIONS.md; DECISIONS.md § 2026-03-04 (Reflector updated to check question answered) |

**Why this matters:** Safety architecture was a deliberate human design choice, not an emergent AI property. The human specified what the Reflector must catch; the AI implemented it.

---

## Pattern summary

| Pattern | Traces |
|---------|--------|
| Human specifies architecture; AI implements | 1, 3, 6 |
| Human observes failure; AI diagnoses + fixes | 2, 4 |
| Human + AI iterate on real-device behaviour | 5 |
| Human makes safety trade-off AI did not propose | 1, 6 |

> All facts in this log are grounded in DECISIONS.md, EVIDENCE_LOG.md, RISK_LOG.md,
> and LIMITATIONS.md. No facts have been invented or inferred beyond what those files record.
